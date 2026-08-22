# AI Proxy

Small Fastify server. Sits between the browser and the LLM providers so
API keys never touch the client bundle.

## Run locally

```bash
cd scripts/ai-proxy
npm install
GEMINI_API_KEY=your_key node server.js
# or
ANTHROPIC_API_KEY=your_key node server.js
# or
DEEPSEEK_API_KEY=your_key node server.js
```

Then in the app root:
```
VITE_AI_PROXY_URL=http://localhost:8787/api/gloss npm run dev
```

## Env vars

Copy `.env.example` to `.env` in this folder (git-ignored — never commit it).

- `PORT` (default `8787`)
- `ALLOWED_ORIGIN` (default `*`; set to your site origin for prod)
- `GEMINI_API_KEY` / `ANTHROPIC_API_KEY` / `DEEPSEEK_API_KEY` /
  `LONGCAT_API_KEY` — whichever provider(s) you want available.

LongCat uses the OpenAI-compatible endpoint at
`https://api.longcat.chat/openai/v1/chat/completions` with model
`LongCat-2.0`. See https://longcat.chat/platform/docs/api/chat.html.

## What it does NOT do (yet)

- No rate limiting → add `@fastify/rate-limit` before shipping.
- No KV cache → add Redis or an edge KV in front for production.
- No auth on the proxy endpoint → protect with a shared token or JWT before
  exposing publicly.
