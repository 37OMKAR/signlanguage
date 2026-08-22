import type { AiProvider, AiProviderConfig } from "./types";
import { proxyGlossify } from "./proxyClient";

export function createGeminiProvider(cfg: AiProviderConfig): AiProvider {
  return {
    name: "gemini-2.5-flash",
    async glossify(text: string) {
      return proxyGlossify({ ...cfg, model: "gemini-2.5-flash" }, text);
    },
  };
}
