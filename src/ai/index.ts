import type { AiProvider, AiProviderConfig } from "./providers/types";
import { createGeminiProvider } from "./providers/gemini";
import { createClaudeProvider } from "./providers/claude";
import { createDeepSeekProvider } from "./providers/deepseek";

export type ProviderKey = "gemini" | "claude-sonnet" | "claude-haiku" | "deepseek";

// Factory. Reads env at build time (Vite exposes import.meta.env.VITE_*).
export function makeProvider(
  key: ProviderKey,
  overrides?: Partial<AiProviderConfig>,
): AiProvider {
  const cfg: AiProviderConfig = {
    proxyUrl:
      overrides?.proxyUrl ??
      (import.meta.env.VITE_AI_PROXY_URL as string | undefined) ??
      "/api/gloss",
    model: overrides?.model ?? "gemini-2.5-flash",
    timeoutMs: overrides?.timeoutMs ?? 8000,
  };
  switch (key) {
    case "gemini":       return createGeminiProvider(cfg);
    case "claude-sonnet":return createClaudeProvider(cfg, "sonnet");
    case "claude-haiku": return createClaudeProvider(cfg, "haiku");
    case "deepseek":     return createDeepSeekProvider(cfg);
  }
}

export type { AiProvider, AiProviderConfig };
