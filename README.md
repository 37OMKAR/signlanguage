# Text → Sign Language

Type a sentence. A 3D avatar signs it. Web-based, accessibility-first, no
video playback anywhere in the pipeline.

> **Status**: v0.1 scaffold. Placeholder hands render, rule-based gloss layer
> works end-to-end. Real hand mesh (MANO) and expanded sign dictionary land
> in the next milestones. See [`PLAN.md`](PLAN.md) for the full roadmap.

---

## What this is

- **Input**: typed English (Hindi/Indian languages in Phase 3)
- **Output**: 3D hands + head avatar signing the sentence, with captions,
  TTS, and every accessibility control you'd expect
- **Runs on**: any modern browser, any laptop, most phones
- **Never plays video**. All motion is JSON keyframes driving bone rotations.

## Architecture in one line

`text → NLP gloss → dictionary lookup (JSON keypoints) → retargeter → Three.js avatar`

Full architecture, risk register, licensing plan and timeline live in
[`PLAN.md`](PLAN.md).

## Quick start

```bash
npm install
npm run dev
```

Open http://localhost:5173, type "hello", press Ctrl+Enter, watch the
placeholder hand animate.

## Stack

- Vite + React + TypeScript + Tailwind
- Three.js + `@react-three/fiber` + `@react-three/drei`
- `compromise` for rule-based NLP (browser-side)
- Web Speech API for TTS
- MIT licensed. All runtime dependencies MIT / Apache 2.0 / BSD.

## Repo layout

See [`PLAN.md § 9`](PLAN.md).

## Contributing / roadmap

Read [`PLAN.md`](PLAN.md) end to end before opening a PR. Phase, risk, and
license expectations are all documented there.

## License

MIT for the code we wrote. Individual sign-data provenance is tracked in
[`data/LICENSE-DATA.md`](data/LICENSE-DATA.md).
