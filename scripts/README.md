# Scripts

Offline tooling. Not shipped in the browser bundle.

## `ai-proxy/` — Node/Fastify AI proxy

Runs on your own server (Cloud Run, Fly, a $5 VPS, whatever). Accepts
`POST /api/gloss {model, text}` from the browser, forwards to the
chosen provider with the key from `process.env`, returns
`{gloss: string[]}`.

Never bundle keys in the browser.

```
cd scripts/ai-proxy
npm install
GEMINI_API_KEY=... node server.js
```

## `data-prep/` — Python data preparation

Converters that turn public datasets (Kaggle Google ASL Signs, WLASL,
iSign) into our `AuthoredEntry` JSON format.

- `extract_mediapipe.py` — take webcam / video → MediaPipe holistic → JSON
- `convert_kaggle.py` — Kaggle parquet landmarks → our format
- `convert_wlasl.py` — WLASL body-keypoint JSON → our format (prototype only)

Requires Python 3.11+ and `pip install -r requirements.txt`.
