// Small AI proxy. Runs on your own server. NEVER expose to the internet
// without: rate limiting, an allowlist of origins, and a KV cache.

import Fastify from "fastify";
import cors from "@fastify/cors";

// Load scripts/ai-proxy/.env (git-ignored) if present. Node 20.6+ built-in;
// harmless no-op in production where real env vars are injected instead.
try {
  process.loadEnvFile();
} catch {
  // no .env file — fine, rely on real environment variables
}

const app = Fastify({ logger: true });
await app.register(cors, {
  origin: process.env.ALLOWED_ORIGIN ?? "*",
  methods: ["POST", "OPTIONS"],
});

const SYSTEM = `You convert English sentences into ASL gloss.
Return a JSON array of UPPERCASE gloss tokens, nothing else.
Drop articles and copulas. Move time expressions to front.
Map I/me to ME, you to YOU. Wh-words go last. Negation is NO.
Yes/no questions append QUESTION. Multi-word signs use hyphens.`;

const PROVIDERS = {
  "gemini-2.5-flash": callGemini,
  "claude-sonnet-5": callClaude,
  "claude-haiku-4-5": callClaude,
  "deepseek-v3": callDeepSeek,
  "longcat-2.0": callLongCat,
};

app.post("/api/gloss", async (req, reply) => {
  const { model, text } = req.body ?? {};
  if (typeof text !== "string" || !text.trim()) {
    return reply.code(400).send({ error: "Missing text" });
  }
  const call = PROVIDERS[model];
  if (!call) return reply.code(400).send({ error: "Unknown model" });
  try {
    const gloss = await call(text.trim(), model);
    return { gloss };
  } catch (err) {
    req.log.error(err);
    return reply.code(502).send({ error: "Upstream failure" });
  }
});

// Batch endpoint: translate many sentences in ONE call. This is where a
// large-context model like LongCat-2.0 (1M tokens) actually earns its
// keep — a document, a chat transcript, or a whole lesson's worth of
// sentences can go in a single request instead of one round-trip per
// sentence. Only wired for models whose adapter supports it.
const BATCH_PROVIDERS = {
  "longcat-2.0": callLongCatBatch,
};

app.post("/api/gloss-batch", async (req, reply) => {
  const { model, texts } = req.body ?? {};
  if (!Array.isArray(texts) || texts.length === 0) {
    return reply.code(400).send({ error: "texts must be a non-empty array" });
  }
  if (texts.length > 2000) {
    return reply.code(400).send({ error: "Max 2000 sentences per batch" });
  }
  const call = BATCH_PROVIDERS[model];
  if (!call) return reply.code(400).send({ error: "Model has no batch adapter" });
  try {
    const results = await call(texts.map(String));
    return { results };
  } catch (err) {
    req.log.error(err);
    return reply.code(502).send({ error: "Upstream failure" });
  }
});

const port = Number(process.env.PORT ?? 8787);
await app.listen({ port, host: "0.0.0.0" });

// ---- Provider adapters. Wire each with your own key. ----

async function callGemini(text) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY not set");
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM }] },
        contents: [{ role: "user", parts: [{ text }] }],
        generationConfig: { responseMimeType: "application/json" },
      }),
    },
  );
  const j = await res.json();
  const raw = j?.candidates?.[0]?.content?.parts?.[0]?.text ?? "[]";
  return safeArray(raw);
}

async function callClaude(text, model) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY not set");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 200,
      system: SYSTEM,
      messages: [{ role: "user", content: text }],
    }),
  });
  const j = await res.json();
  const raw = j?.content?.[0]?.text ?? "[]";
  return safeArray(raw);
}

async function callDeepSeek(text) {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) throw new Error("DEEPSEEK_API_KEY not set");
  const res = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: text },
      ],
      response_format: { type: "json_object" },
    }),
  });
  const j = await res.json();
  const raw = j?.choices?.[0]?.message?.content ?? "[]";
  return safeArray(raw);
}

async function callLongCat(text) {
  const key = process.env.LONGCAT_API_KEY;
  if (!key) throw new Error("LONGCAT_API_KEY not set");
  // OpenAI-compatible endpoint: https://longcat.chat/platform/docs/api/chat.html
  const res = await fetch("https://api.longcat.chat/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: "LongCat-2.0",
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: text },
      ],
    }),
  });
  const j = await res.json();
  const raw = j?.choices?.[0]?.message?.content ?? "[]";
  return safeArray(raw);
}

const BATCH_SYSTEM = `You convert MANY English sentences into ASL gloss at once.
Input: a JSON array of sentences, each with an "id" and "text".
Output: a JSON array, same length and order, each item
{"id": <same id>, "gloss": [<UPPERCASE gloss tokens>]}.
Apply per sentence: drop articles/copulas, move time expressions to front,
map I/me to ME and you to YOU, wh-words go last, negation is NO, yes/no
questions append QUESTION, multi-word signs use hyphens.
Return ONLY the JSON array. No prose, no code fences.`;

async function callLongCatBatch(texts) {
  const key = process.env.LONGCAT_API_KEY;
  if (!key) throw new Error("LONGCAT_API_KEY not set");
  const payload = texts.map((text, id) => ({ id, text }));
  const res = await fetch("https://api.longcat.chat/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: "LongCat-2.0",
      messages: [
        { role: "system", content: BATCH_SYSTEM },
        { role: "user", content: JSON.stringify(payload) },
      ],
    }),
  });
  const j = await res.json();
  const raw = j?.choices?.[0]?.message?.content ?? "[]";
  if (process.env.DEBUG_AI_PROXY) {
    console.log("[longcat-batch] raw response:", raw.slice(0, 2000));
  }
  let parsed;
  try {
    parsed = JSON.parse(stripCodeFence(raw));
  } catch (e) {
    if (process.env.DEBUG_AI_PROXY) console.log("[longcat-batch] parse failed:", e.message);
    parsed = [];
  }
  if (!Array.isArray(parsed)) return texts.map(() => []);
  // Reassemble in original order by id; fall back to [] for anything
  // the model dropped or malformed.
  const byId = new Map();
  for (const item of parsed) {
    if (item && typeof item.id === "number" && Array.isArray(item.gloss)) {
      byId.set(item.id, item.gloss.map(String));
    }
  }
  return payload.map((p) => byId.get(p.id) ?? []);
}

// Strip ```json ... ``` or ``` ... ``` fences some models wrap JSON in
// despite being told not to.
function stripCodeFence(raw) {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1] : trimmed;
}

function safeArray(raw) {
  try {
    const parsed = JSON.parse(stripCodeFence(raw));
    if (Array.isArray(parsed)) return parsed.map(String);
    if (Array.isArray(parsed?.gloss)) return parsed.gloss.map(String);
    return [];
  } catch {
    return [];
  }
}
