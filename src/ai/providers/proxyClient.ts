import type { AiProviderConfig } from "./types";

// Small fetch wrapper. The server proxy accepts {model, text} and returns
// {gloss: string[]}. Never call an AI provider directly from the browser
// with an API key.
export async function proxyGlossify(
  cfg: AiProviderConfig,
  text: string,
): Promise<string[]> {
  const controller = new AbortController();
  const timer = window.setTimeout(
    () => controller.abort(),
    cfg.timeoutMs ?? 8000,
  );
  try {
    const res = await fetch(cfg.proxyUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: cfg.model, text }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Proxy ${res.status}`);
    const data = (await res.json()) as { gloss?: unknown };
    if (!Array.isArray(data.gloss)) throw new Error("Bad proxy response");
    return data.gloss.map(String);
  } finally {
    window.clearTimeout(timer);
  }
}
