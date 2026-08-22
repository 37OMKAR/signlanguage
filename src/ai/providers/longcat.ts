import type { AiProvider, AiProviderConfig } from "./types";
import { proxyGlossify } from "./proxyClient";

export function createLongCatProvider(cfg: AiProviderConfig): AiProvider {
  return {
    name: "longcat-2.0",
    async glossify(text: string) {
      return proxyGlossify({ ...cfg, model: "longcat-2.0" }, text);
    },
  };
}
