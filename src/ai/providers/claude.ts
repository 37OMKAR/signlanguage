import type { AiProvider, AiProviderConfig } from "./types";
import { proxyGlossify } from "./proxyClient";

export function createClaudeProvider(
  cfg: AiProviderConfig,
  variant: "sonnet" | "haiku" = "sonnet",
): AiProvider {
  const model = variant === "haiku" ? "claude-haiku-4-5" : "claude-sonnet-5";
  return {
    name: model,
    async glossify(text: string) {
      return proxyGlossify({ ...cfg, model }, text);
    },
  };
}
