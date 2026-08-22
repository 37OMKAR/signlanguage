export interface AiProvider {
  name: string;
  glossify(text: string): Promise<string[]>;
}

export interface AiProviderConfig {
  // The URL of our own server-side proxy. NEVER put a raw API key in the
  // browser — the proxy adds it server-side.
  proxyUrl: string;
  // Which model the proxy should call. The proxy validates.
  model: "gemini-2.5-flash" | "claude-sonnet-5" | "claude-haiku-4-5" | "deepseek-v3";
  // Optional client-side timeout in ms.
  timeoutMs?: number;
}
