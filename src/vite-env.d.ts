/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AI_PROXY_URL?: string;
  readonly VITE_AI_PROVIDER?: "gemini" | "claude-sonnet" | "claude-haiku" | "deepseek";
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
