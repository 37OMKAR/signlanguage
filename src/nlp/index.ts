import { ruleBasedGloss } from "./glossRules";
import { makeProvider, type ProviderKey } from "../ai";

// Public entry. When VITE_AI_PROXY_URL is set at build time, we try the AI
// first and fall back to the rule-based path on any failure. Otherwise the
// rule-based path runs alone.
const AI_ENABLED = Boolean(import.meta.env.VITE_AI_PROXY_URL);
const AI_PROVIDER_KEY: ProviderKey =
  (import.meta.env.VITE_AI_PROVIDER as ProviderKey | undefined) ?? "gemini";

// In-memory cache: same input in this tab, same gloss.
const cache = new Map<string, string[]>();

export async function textToGloss(text: string): Promise<string[]> {
  const key = text.trim().toLowerCase();
  if (!key) return [];
  const hit = cache.get(key);
  if (hit) return hit;

  let gloss: string[];
  if (AI_ENABLED) {
    try {
      const provider = makeProvider(AI_PROVIDER_KEY);
      gloss = await provider.glossify(text);
      if (!gloss.length) gloss = ruleBasedGloss(text);
    } catch (err) {
      // Log once for debug, fall back silently.
      // eslint-disable-next-line no-console
      console.warn("AI gloss failed; using rule-based:", err);
      gloss = ruleBasedGloss(text);
    }
  } else {
    gloss = ruleBasedGloss(text);
  }

  cache.set(key, gloss);
  return gloss;
}
