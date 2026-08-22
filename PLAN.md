# Text → Sign Language Web App — Project Plan

> Web-first, video-free, 3D-avatar-driven translator that turns typed text into
> animated sign language on a rigged humanoid avatar, with full accessibility
> features (captions, TTS, high contrast, keyboard navigation).
>
> **Phase 1**: English → ASL (proof of pipeline)
> **Phase 2**: Grow ASL dictionary + smoother transitions
> **Phase 3**: Indian Sign Language (ISL) + Hindi/regional input

---

## 1. Vision & Scope

### 1.1 What we are building

A browser app where a user types a sentence and a 3D avatar signs it in real
time, with a large caption overlay for hearing users and a spoken audio track
for blind/low-vision users. Runs on any modern laptop or phone. No download.
No video playback anywhere in the pipeline — everything is skeletal animation
driven by JSON pose data.

### 1.2 What we are NOT building

- Not a video-clip stitcher. We never play recorded video of a signer.
- Not a webcam sign recognizer (that is the reverse problem, out of scope).
- Not a fluent grammar-perfect translator on day one. Fluent sign language
  translation is a research-grade problem; we ship a useful subset first.

### 1.3 Success criteria (MVP)

- Type any English sentence, avatar signs it within 1 second of pressing Enter.
- Full A–Z fingerspelling works.
- At least 50 common ASL words play as proper signs (not fingerspelling).
- Captions render synchronously.
- TTS reads the input text aloud for blind users.
- Runs at 60 fps on an integrated-GPU laptop and on a mid-range Android phone.
- WCAG 2.2 AA compliance for the surrounding UI.

---

## 2. Architecture

```
                 ┌──────────────────────┐
User types  ───► │  Text input (React)  │
                 └──────────┬───────────┘
                            │ plain text
                 ┌──────────▼───────────┐
                 │  NLP / Gloss layer   │  ── rule-based (MVP)
                 │  text → gloss tokens │     LLM-backed (later)
                 └──────────┬───────────┘
                            │ ["HELLO","HOW","YOU"]
                 ┌──────────▼───────────┐
                 │  Sign dictionary     │  ── local JSON file
                 │  lookup              │     one entry per gloss
                 └──────────┬───────────┘
                            │ pose-frame arrays
                 ┌──────────▼───────────┐
                 │  Retargeter          │  ── keypoints → bone rotations
                 │  keypoints → bones   │     angle-based, quaternion math
                 └──────────┬───────────┘
                            │ bone quaternions per frame
                 ┌──────────▼───────────┐
                 │  Three.js player     │  ── SkinnedMesh + AnimationMixer
                 │  60fps avatar render │     smooth blend between signs
                 └──────────┬───────────┘
                            │
              ┌─────────────┼──────────────┐
              ▼             ▼              ▼
          Captions      TTS audio     High-contrast
          overlay       (blind UX)    keyboard nav
```

**Every arrow is code and JSON. Zero video files anywhere in production.**

---

## 3. Technology Stack

### 3.1 Frontend
| Layer | Choice | License | Why |
|---|---|---|---|
| Bundler | Vite | MIT | Fast dev server, tiny prod bundle |
| Framework | React + TypeScript | MIT | Familiar, good a11y ecosystem |
| 3D | Three.js + @react-three/fiber + @react-three/drei | MIT | Industry standard, huge community |
| Avatar | Ready Player Me (GLB) | RPM SDK ToS | Free tier permits commercial use; verify at ship time |
| Animation math | gl-matrix / three internals | MIT | Quaternion helpers |
| NLP (browser-side) | compromise.js | MIT | Lightweight POS tagging |
| TTS | Web Speech API | Built-in | No dependency, works offline |
| Styling | Tailwind CSS | MIT | Accessibility utilities |

### 3.2 Backend (optional, only if we add an LLM gloss step)
| Layer | Choice | License | Why |
|---|---|---|---|
| Runtime | Node.js + Fastify | MIT | Simple, fast |
| LLM client | Anthropic Claude SDK | MIT | For high-quality text→gloss (phase 2+) |

MVP has no backend. Everything runs in the browser.

### 3.3 Tooling & data prep (offline, Python)
| Tool | License | Purpose |
|---|---|---|
| Python 3.11 | PSF | Data prep scripts |
| MediaPipe | Apache 2.0 | Extract keypoints from any reference footage we record ourselves |
| Blender | GPL — but only used as a *tool*, output files are ours | Author fingerspelling handshapes, tweak signs |
| numpy | BSD | Number crunching |

**Note on Blender licensing**: GPL applies to Blender the program, not to the
GLB/JSON assets it exports. Exported assets are freely usable commercially.

---

## 4. Data — the "sign language code" format

### 4.1 Master format we author and ship

`data/gloss_dictionary.json` — one file, our source of truth.

```json
{
  "HELLO": {
    "gloss": "HELLO",
    "duration_ms": 800,
    "frames": [
      {
        "t_ms": 0,
        "joints": {
          "RightShoulder": [0.12, 0.05, 0.03],
          "RightElbow":    [-0.20, 0.10, 0.00],
          "RightWrist":    [0.30, 0.00, 0.00],
          "RightHand":     [/* 21 finger joint quaternions */]
        }
      },
      { "t_ms": 33, "joints": { "...": "..." } }
    ],
    "handshape_start": "B",
    "handshape_end":   "B",
    "notes": "Palm-out wave near temple"
  }
}
```

Numbers are **bone rotations as XYZ Euler in radians** (or quaternions —
final choice locked during retargeter design). All coordinates are relative
to the avatar's rest pose, not to a specific signer's body dimensions. This
is what makes it retarget-safe across avatars of different heights.

### 4.2 Where the data comes from

Three sources, ordered from easiest to hardest:

**A. Fingerspelling (26 handshapes)** — we hand-author in Blender in one
afternoon. 100% ours. Zero license issue.

**B. Common signs (50 for MVP, 500 by Phase 2)** — two-track plan:
  1. **Prototype track**: extract from WLASL pose keypoints (public research
     data) to prove the pipeline. Disclose in README.
  2. **Commercial track**: record our own signer(s), run MediaPipe to extract
     keypoints, encode into our JSON. 100% ours to license.

**C. Continuous / grammatical signing (Phase 3+)** — requires a trained
model or a much larger custom dataset. Deferred.

### 4.3 Public reference datasets we consult (not necessarily bundle)

| Dataset | Language | License | Our use |
|---|---|---|---|
| WLASL | ASL | Research; poses derived from public YouTube | **Prototype only**; regenerate for commercial |
| How2Sign | ASL | CC BY-NC 4.0 | Research reference only, not for commercial ship |
| iSign / CISLR | ISL | Verify per file | Prototype for Phase 3; re-record for commercial |
| ISLTranslate | ISL text pairs | Research | Training data for gloss model later |

---

## 5. NLP layer — text → gloss

### 5.1 MVP (rule-based, in browser)

For English → ASL gloss:
1. Tokenize with compromise.js.
2. Drop articles: `a`, `an`, `the`.
3. Drop copulas: `is`, `am`, `are`, `was`, `were`.
4. Move time expressions to front: `"i went yesterday"` → `"YESTERDAY I GO"`.
5. Uppercase everything, strip punctuation.
6. Any word not in the sign dictionary → fingerspell letter by letter.

This is not linguistically perfect ASL, but it is honest, transparent, and
gives readable output for common sentences. Documented as such.

### 5.2 Phase 2 (LLM-backed)

Server-side call to Claude with a prompt template that reorders and glosses
correctly. Falls back to rule-based on failure.

### 5.3 Phase 3 (Indian languages)

Add tokenizers for Hindi, Tamil, Bengali (use IndicNLP or spaCy models).
Add ISL-specific reordering rules. Same architecture, different rules module.

---

## 6. Retargeter — the technically hardest piece

### 6.1 What it does

Take joint keypoints from the dictionary (which live in one coordinate frame)
and produce bone rotations for the Ready Player Me skeleton (which has its
own T-pose and bone lengths).

### 6.2 Approach

- **Angle-based, not position-based.** Compute the angle between joints
  (e.g., shoulder→elbow→wrist) and set the bone's quaternion to reproduce that
  angle. Avatar size drops out of the math.
- Use **quaternions**, not Euler angles, to avoid gimbal lock.
- Precompute a **bone name map**: `MediaPipe.RightShoulder →
  RPMSkeleton.RightArm`, etc.
- Fingers are the hardest: MediaPipe gives 21 hand landmarks; RPM has ~15
  finger bones per hand. Interpolate.
- Use **Three.js AnimationMixer** with `Quaternion.slerp` between adjacent
  frames for smoothness.

### 6.3 Reference implementations we can study (do not fork wholesale)

- `bandinopla/three-mediapipe-rig` — MIT, MediaPipe → Three.js bones,
  angle-based
- `upf-gti/retargeting-threejs` — quaternion-based retargeting solver

We READ these to learn the math, then write our own module.

---

## 7. Player — Three.js render loop

- Load RPM avatar as GLB via `GLTFLoader`.
- Use `SkeletonUtils.clone` if we need multiple avatars.
- Feed retargeted quaternions into `AnimationMixer` clips built at runtime.
- **Co-articulation handling**: for a smooth stream of signs, blend the last
  30% of sign N with the first 30% of sign N+1 using `CrossFadeAction`.
  Documented caveat: some sign pairs lose meaning when blended (research
  finding); we mark those in the dictionary and skip blending for them.
- Caption overlay is HTML text positioned over the canvas, updated per-sign.

---

## 8. Accessibility features

| Feature | Implementation | Standard |
|---|---|---|
| Large captions overlay | HTML text, adjustable size 16–48pt | WCAG 1.4.4 |
| Screen-reader labels | ARIA on every control | WCAG 4.1.2 |
| TTS of input text | Web Speech API | WCAG 1.2.1 |
| Keyboard-only nav | Focus rings, tab order | WCAG 2.1.1 |
| High-contrast mode | CSS variables, toggle button | WCAG 1.4.11 |
| Font size slider | 100–200% | WCAG 1.4.4 |
| Dyslexia-friendly font | OpenDyslexic optional | WCAG 1.4.8 |
| Playback speed 0.5×–2× | AnimationMixer.timeScale | WCAG 2.2.2 |
| Reduced-motion mode | Skip blend, hold each sign longer | WCAG 2.3.3 |

---

## 9. Repository layout

```
text-to-sign-language/
├── README.md
├── PLAN.md                       ← this document
├── LICENSE                       ← MIT for our code
├── .gitignore
├── package.json
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.ts
├── public/
│   └── avatars/
│       └── default.glb           ← Ready Player Me avatar
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── components/
│   │   ├── TextInput.tsx
│   │   ├── AvatarStage.tsx       ← react-three-fiber canvas
│   │   ├── CaptionOverlay.tsx
│   │   ├── ControlsPanel.tsx     ← contrast, size, speed
│   │   └── A11ySettings.tsx
│   ├── nlp/
│   │   ├── tokenize.ts
│   │   ├── glossRules.ts
│   │   └── index.ts              ← text → gloss[]
│   ├── signs/
│   │   ├── loader.ts             ← fetch + cache dictionary
│   │   ├── retarget.ts           ← keypoints → bone quaternions
│   │   └── player.ts             ← queue + AnimationMixer driver
│   ├── a11y/
│   │   ├── tts.ts
│   │   └── theme.ts
│   └── types.ts
├── data/
│   ├── gloss_dictionary.json     ← shipped dictionary
│   ├── fingerspell/
│   │   ├── A.json ... Z.json     ← hand-authored handshapes
│   └── LICENSE-DATA.md           ← per-sign attribution
├── scripts/                      ← Python data prep
│   ├── requirements.txt
│   ├── extract_mediapipe.py      ← video → keypoints JSON
│   ├── convert_wlasl.py          ← WLASL JSON → our format
│   └── author_handshape.py       ← Blender helper
├── docs/
│   ├── ARCHITECTURE.md
│   ├── DATA_FORMAT.md
│   ├── RETARGETING.md
│   ├── ACCESSIBILITY.md
│   └── LICENSING.md
└── tests/
    ├── nlp.test.ts
    ├── retarget.test.ts
    └── player.test.ts
```

---

## 10. Milestones & timeline

### Phase 0 — Setup (Week 1)
- Repo init, Vite + React + TS scaffold
- Three.js hello-world, load default RPM avatar
- CI (GitHub Actions: lint + test)
- License headers, README skeleton

### Phase 1 — Fingerspelling MVP (Week 2)
- Author A–Z handshape JSON (26 files)
- Retargeter v1: static pose → bone quaternions
- Player v1: queue letters, play sequentially
- Text input → uppercase letters → fingerspell
- Basic captions overlay
- **Deliverable**: type "HELLO", avatar fingerspells H-E-L-L-O

### Phase 2 — Word signs & smoothing (Week 3–4)
- Retargeter v2: multi-frame pose → animation clip
- Player v2: cross-fade between signs
- Add 50 common signs (subset of WLASL keypoints, prototype-marked)
- Rule-based gloss layer
- **Deliverable**: type "hello how are you", proper signs + fingerspell fallback

### Phase 3 — Accessibility & polish (Week 5)
- All a11y features listed in §8
- Playback speed, reduced-motion
- Mobile responsive
- Lighthouse a11y score ≥ 95
- **Deliverable**: shippable v0.1 demo

### Phase 4 — Grow dictionary (Week 6–8)
- Record our own signer for 100–200 common English words
- Extract with MediaPipe, encode into our JSON
- Replace any WLASL-derived entries → 100% our IP
- **Deliverable**: commercial-clean English MVP

### Phase 5 — ISL & Indian languages (Month 3+)
- Hindi tokenizer (IndicNLP)
- ISL sign dictionary (partner with ISLRTC or record with local signer)
- ISL grammar rules module
- **Deliverable**: bilingual English/Hindi → ASL/ISL

---

## 11. Risks, bottlenecks, mitigations

### 11.1 Technical risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| **Skeleton retargeting looks broken** (uncanny arms, twisted wrists) | High | High | Study `three-mediapipe-rig` + `retargeting-threejs` first. Use quaternion slerp. Ship a debug view that draws bone axes. Budget 1 full week for this alone. |
| **Fingers are the hardest joints** — MediaPipe hand landmarks are noisy, RPM finger rigs are limited | High | Medium | Hand-author the 26 fingerspell handshapes cleanly. For words, snap noisy finger data to nearest of ~20 canonical handshapes. |
| **Co-articulation destroys meaning** for some sign pairs | Medium | Medium | Research finding: mark sensitive signs in dictionary, skip blending for them. Add a "no-blend flag". |
| **RPM T-pose quirks** — fingers in a line vs splayed | Medium | Low | One-time calibration on avatar load. |
| **Web Speech API browser gaps** — Safari, some Android | Medium | Low | Feature-detect, fall back to muting TTS. |
| **Bundle size explodes** with big dictionary | Low | Medium | Lazy-load signs on demand from `/data/signs/<gloss>.json` via HTTP; only ship the index in the bundle. |
| **Mobile GPU can't handle full skeleton at 60fps** | Low | Low | RPM meshes are already low-poly. Drop to 30fps target on mobile. |

### 11.2 Data risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| **WLASL/iSign non-commercial terms bite us** at product launch | High | High | Prototype-only marking. Timeline commits to replacing before commercial ship (Phase 4). |
| **Recording our own signer is expensive** in time or money | Medium | Medium | Start with A–Z + 20 signs recorded on a webcam. College deaf-support cells often help pro bono. |
| **ISL data thinner than ASL** | High | Medium | Accept that Phase 3 is a smaller dictionary. Focus on high-frequency vocabulary. |
| **Sign quality varies across dataset entries** | High | Medium | Curate manually. A small clean dictionary beats a large noisy one. |

### 11.3 Linguistic risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| **Rule-based gloss is not fluent ASL** | Certain | Medium | Be honest in the README. Frame as "accessible glossing" not "translation". Deaf users still get intelligible output. |
| **English word ≠ single ASL sign** — polysemy, classifiers | Certain | Medium | Dictionary entries can list multiple sign options; pick contextually with LLM in Phase 2. |
| **Missing signs default to fingerspelling** — slow and boring | Medium | Low | Grow dictionary steadily. Measure "% of common words with real sign" as a KPI. |
| **Facial expression grammar ignored** | High | Medium | Document as known limitation. RPM has blendshapes; add basic eyebrow raise for questions in Phase 4. |

### 11.4 Legal & IP risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| **Accidentally linking GPL/LGPL code** | Low | High | Package-lock audit in CI (`npx license-checker --failOn "GPL"`). |
| **RPM ToS changes** | Low | Medium | Keep an alternate avatar (Mixamo) tested and swappable. |
| **Someone claims copyright on sign motion data** | Low | Medium | Re-record all shipped signs (Phase 4). Documented provenance per sign. |
| **User inputs offensive text** | Medium | Low | Optional profanity filter toggle. |

### 11.5 Team & project risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| **Retargeting rabbit hole eats all time** | High | High | Time-box: if retargeter is not visibly working by end of Week 2, fall back to hand-authoring everything in Blender and exporting GLB clips (simpler, less scalable, still ships). |
| **Scope creep to "fluent translation"** | High | High | This PLAN is the contract. Fluent grammar is Phase 5+, not MVP. |
| **Cross-browser bugs** | Medium | Low | Test in Chrome, Firefox, Safari, Edge from Week 3. |

---

## 12. Non-goals for v1

To keep the project shippable:
- No real-time webcam sign recognition (reverse problem).
- No cloud storage of user input.
- No user accounts.
- No multi-signer avatar chooser (single default avatar).
- No offline PWA install (add later).
- No native mobile app (web is enough).

---

## 13. Licensing & commercial-use plan

### 13.1 Our repo license: **MIT**

### 13.2 Dependency license audit — allowed list

**Green (permissive, commercial-safe)**:
MIT, Apache 2.0, BSD-2-Clause, BSD-3-Clause, ISC, Unlicense, CC0.

**Yellow (case-by-case)**:
MPL 2.0 (weak copyleft, usually fine), CC BY 4.0 for data (attribute).

**Red (avoid entirely)**:
GPL v2/v3, LGPL v2/v3, AGPL, CC BY-NC, CC BY-SA, any "research only".

### 13.3 CI enforcement

Add to `package.json` scripts:
```
"license:check": "license-checker --production --onlyAllow 'MIT;Apache-2.0;BSD-2-Clause;BSD-3-Clause;ISC;Unlicense;CC0-1.0;MPL-2.0'"
```
Run in CI. Fail build on violation.

### 13.4 Per-sign provenance

`data/LICENSE-DATA.md` lists every sign in the dictionary with:
- Source (self-recorded / WLASL-derived / hand-authored)
- License
- Signer credit if applicable
- Whether it is commercial-ship-safe

Before commercial launch (Phase 4), zero entries may be marked
"prototype-only".

### 13.5 Third-party assets we do NOT bundle

- No VLibras code (LGPL, plus culturally specific to LIBRAS anyway).
- No OpenPose binaries (non-commercial license).
- Consuming pre-extracted keypoint JSON is fine; the JSON is data, not the
  OpenPose executable.

---

## 14. Immediate next actions (before writing feature code)

1. Confirm the three MVP decisions:
   - Framework: React + Vite (recommended) or plain HTML?
   - Gloss layer: rule-based (recommended MVP) or LLM-backed?
   - Avatar: Ready Player Me (recommended) or Mixamo?
2. Initialize repo, push this `PLAN.md`, `README.md`, and `.gitignore`.
3. Scaffold Vite + React + TS + Tailwind.
4. Load an RPM avatar in a Three.js canvas. Verify it renders on
   Chrome/Firefox/Safari/mobile.
5. Prototype the retargeter on ONE bone (e.g., rotate right shoulder from a
   test JSON). Prove the math before scaling.
6. Author the letter "A" fingerspell handshape as our first data file.
7. Ship an end-to-end demo: type "A", avatar makes the A handshape.
8. Only after step 7 works, expand to B–Z and the word dictionary.

---

## 15. Open questions to resolve with the team

- Which ASL / ISL signer(s) will we record for the commercial-clean dictionary?
- Do we have institutional access to an ISL expert (e.g., through the college
  accessibility office) to review signs for correctness?
- Target hosting for the demo — GitHub Pages, Vercel, or Netlify?
- Do we want a public roadmap issue tracker on GitHub from day one?

---

## 16. References consulted while writing this plan

**Existing sign-avatar systems**
- VLibras (Brazilian, LGPL, Unity-based, LIBRAS only)
- SiGML / JASigning (UEA, academic, multi-language)

**Datasets**
- WLASL — https://dxli94.github.io/WLASL/
- How2Sign — https://how2sign.github.io/ (CC BY-NC)
- iSign — https://exploration-lab.github.io/iSign/
- ISLTranslate

**Retargeting**
- bandinopla/three-mediapipe-rig (MIT) — MediaPipe → Three.js bones
- upf-gti/retargeting-threejs — quaternion retargeting solver

**Research on avatar quality**
- Enhancing Portuguese Sign Language Animation with Dynamic Timing and
  Mouthing (arXiv 2307.06124) — co-articulation & mouthing
- Sign Language Avatars: Animation and Comprehensibility

**Standards**
- WCAG 2.2 — https://www.w3.org/TR/WCAG22/
- W3C Web Speech API

---

*Document version: 0.1 — initial planning draft. Update before every phase
transition.*

---

# ADDENDUM v0.2 — Architectural shift: Hands + Head, not full body

After research into available datasets and existing avatar systems, the plan
changes on three points. Everything above still applies unless overridden here.

## A. Avatar scope: hands + head, not full body

**Change**: Instead of a full RPM humanoid, render a floating pair of hands
plus a simple head with basic facial blendshapes.

**Why**:
- Signs are ~80% hands, ~15% face, ~5% torso position. Hands+head covers 95%.
- Full-body skeleton retargeting was the #1 identified risk (§11.1). Hand-only
  retargeting maps 21 landmarks per hand instead of 33+ body joints — an
  order-of-magnitude smaller problem.
- Runs on any phone; no shoulder/torso mesh weight-painting to debug.
- Distinctive look — most sign avatars look uncanny at full body; a clean
  hands+head presentation is honest and readable.

**Trade-off accepted**: Loses body-position signs (e.g., "me" points at chest,
"think" near forehead). Head is present so those anchors still work; we lose
only lower-body location references, which are rare in common vocabulary.

## B. Primary data source: Kaggle Google ASL Signs dataset

**Change**: Bootstrap the dictionary from Google's Kaggle ASL Signs dataset,
not WLASL.

**Why**:
- Already in **MediaPipe landmark format** — matches our runtime format.
  Zero format-conversion work.
- 250 curated signs, ~100,000 samples, multiple signers per sign (better
  averaging).
- Kaggle competition license is permissive for research + demo.
- WLASL remains a Phase-2 source for expanding beyond 250 signs.

## C. Timeline compression

MVP moves from 4 weeks to **2–3 weeks** because:
- No full-body retargeting week
- No format-conversion week (Kaggle data is already MediaPipe format)
- Hands+head model is a smaller GLB, faster to load and iterate

## D. Updated tech-stack additions

| Layer | Choice | License | Purpose |
|---|---|---|---|
| Hand model | MANO (or a MANO-compatible GLB) | Research free; commercial needs check | 3D hand mesh + skeleton |
| Alt hand model | Custom low-poly rigged hand in Blender | Ours, MIT | Commercial-clean fallback |
| Head model | Ready Player Me head-only crop, or simple sculpt | RPM ToS / MIT | Face for expressions |
| AI gloss | Gemini 2.5 Flash (default) via server proxy | Google API terms | Cheap runtime translation |
| Provider abstraction | `src/ai/providers/` (Gemini, Claude, DeepSeek adapters) | Ours, MIT | Swap models via env var |

## E. Updated retargeter scope

- **Input**: MediaPipe hand landmarks (21 per hand) + face landmarks (subset)
- **Output**: Bone rotations for our hand rig + head blendshape weights
- Body joints ignored entirely.
- This is the single biggest engineering simplification in the plan.

## F. Updated risk register

| Risk | v0.1 | v0.2 |
|---|---|---|
| Full-body retargeting fails | High/High | **Removed** — no full body |
| Fingers noisy in retarget | High/Medium | Medium/Medium (still real) |
| Missing body-location signs | not tracked | Low/Low (documented limitation) |
| Face expressions missing | High/Medium | Medium/Medium (we now have a head) |

## G. Updated feasibility score

- Feasibility: 8.0 → **9.0 / 10**
- Uniqueness (India ISL): 9.0 (unchanged)
- Time to MVP: 4 weeks → **2–3 weeks**
- Overall project score: 8.0 → **8.7 / 10**

## H. New immediate next actions (supersedes §14)

1. Scaffold Vite + React + TS + Tailwind. ← doing now
2. Add Three.js + `@react-three/fiber` + `@react-three/drei`.
3. Load a placeholder hand mesh (basic geometry until we drop in MANO).
4. Stub NLP layer (rule-based gloss).
5. Stub AI proxy with provider abstraction (Gemini default).
6. Seed `data/gloss_dictionary.json` with fingerspell A + B as first entries.
7. End-to-end demo: type "A", placeholder hand plays the A handshape frame.
8. Only after step 7, download Kaggle ASL Signs data and expand.

*Version 0.2 — hands+head shift. Live and being executed.*
