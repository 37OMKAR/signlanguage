import type { AiProvider, AiProviderConfig } from "./types";
import { proxyGlossify } from "./proxyClient";

export function createDeepSeekProvider(cfg: AiProviderConfig): AiProvider {
  return {
    name: "deepseek-v3",
    async glossify(text: string) {
      return proxyGlossify({ ...cfg, model: "deepseek-v3" }, text);
    },
  };
}
