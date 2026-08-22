# Architecture

## One-line summary
`text → NLP gloss → dictionary lookup (JSON keyframes) → retargeter → Three.js hand+head render`

Zero video files anywhere in production. All motion is numeric bone rotations.

## Layers

### 1. Text input
`src/components/TextInput.tsx`. Standard `<textarea>`; Ctrl/Cmd+Enter submits.
No submission scrubbing on the client — the input travels only to the local
NLP layer or the same-origin AI proxy.

### 2. NLP → gloss
`src/nlp/index.ts` is the single entry point.

- Default: `ruleBasedGloss()` (compromise.js POS tagging + hand-crafted
  transformations). Fast, offline, deterministic. Handles articles,
  copulas, pronouns, negation, wh-questions, and time topicalization.
- When `VITE_AI_PROXY_URL` is set, we first call an AI provider (Gemini /
  Claude / DeepSeek) through the server proxy, using the prompt in
  `src/ai/prompt.ts`. Fallback to rule-based on any error.
- Results are cached in a `Map` per-tab so identical inputs are free.

### 3. Sign dictionary
`data/gloss_dictionary.json` — authored in a human-friendly format:

```json
"HELLO": {
  "gloss": "HELLO",
  "duration_ms": 900,
  "provenance": "hand-authored",
  "commercial_safe": true,
  "frames": [
    { "t_ms": 0, "curls": { "R_index": [0, 0, 0], ... }, "R_palm_deg": [...] }
  ]
}
```

`src/signs/compile.ts` compiles this at load time into runtime `SignFrame`
objects whose `bones` map is `Record<boneName, [x,y,z,w]>` quaternions.

### 4. Loader
`src/signs/loader.ts` looks up a gloss. If missing, it fingerspells the
letters by concatenating each letter's frames with a small inter-letter
gap. Cache-per-gloss keeps hot glosses free.

### 5. Player / retargeter
`src/components/PlaceholderHands.tsx` is both today. In each `useFrame`
tick, we:

1. Convert `clock.elapsedTime` → `elapsedMs`, scaled by `speed` and
   `reducedMotion`.
2. `pickPair(frames, elapsedMs)` returns `[prev, next, t]`.
3. For every bone that appears in `prev`, we `slerp(prev, next, t)` into
   the corresponding `THREE.Object3D` we registered under that bone name.
4. Same for palm positions using `lerp`.

Bones are registered by name via a `Map<string, Object3D>` populated by
React refs during render. This is our poor-man's retargeter: a `bone-name
map` between the JSON's canonical names and the actual scene objects.

The **real** retargeter (Phase 2) will consume MediaPipe landmark JSON and
compute the same bone quaternions from anatomical angles, so it can drive
either this placeholder rig or a proper rigged GLB.

### 6. Captions & TTS
`CaptionOverlay` mirrors the current gloss and up to 6 upcoming glosses.
`speak()` in `src/a11y/tts.ts` uses the Web Speech API; silent no-op on
unsupported browsers.

### 7. Accessibility controls
`ControlsPanel` mutates a single `PlayerSettings` object held in `App`.
Every setting propagates via props; no global state.

## Data flow diagram

```
   TextInput ─────┐
                  ▼
             nlp/index.ts ── cache ──┐
              │        │             │
              │        └── ai/index.ts ── /api/gloss (proxy) ── Gemini/Claude/DeepSeek
              ▼
           ["HELLO","YOU","QUESTION"]
                  │
                  ▼
        signs/loader.ts (compile + fallback fingerspell)
                  │
                  ▼
        SignFrame[]  (bones + positions per t_ms)
                  │
                  ▼
       PlaceholderHands  (slerp between frames, per useFrame)
                  │
                  ▼
        Three.js scene → user
```

## Extension points

- **Swap the rig**: replace `PlaceholderHands` with a proper GLB avatar.
  Keep the `bone-name map` compatible and everything above still works.
- **Add languages**: add rules modules under `src/nlp/rules-<lang>.ts` and
  a token-language detector.
- **Add signs**: append entries to `data/gloss_dictionary.json`. Every
  entry must include `provenance` and `commercial_safe`.
- **Swap the AI**: add another file under `src/ai/providers/` implementing
  `AiProvider`.
