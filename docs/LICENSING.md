# Licensing

## Our code
MIT — see `LICENSE` at the repo root.

## Dependency policy

Green (allowed): MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC,
Unlicense, CC0-1.0, MPL-2.0.

Red (never link into shipped bundle): GPL v2/v3, LGPL v2/v3, AGPL,
CC BY-NC, CC BY-SA, any "research only" clause.

Enforced by `npm run license:check` (uses `license-checker`).

## Sign-data provenance

Every entry in `data/gloss_dictionary.json` carries `provenance` and
`commercial_safe`. Full ledger in `data/LICENSE-DATA.md`. CI test
`no shipped sign is commercially unsafe` fails the build if a
research-only entry sneaks in.

## Third-party tools we DO NOT bundle

- **VLibras** (LGPL) — architectural inspiration only; no code copied.
- **OpenPose** (non-commercial for the tool itself) — we don't bundle
  the executable. Consuming pre-extracted keypoint JSON is fine because
  the numeric output isn't derived from OpenPose's copyright.
- **How2Sign** (CC BY-NC) — for prototype experimentation only, never
  in a shipped commercial dictionary.

## 3D model asset

The rigged hand mesh in `public/rigged-hand/` is
["Rigged hand" by Elena FF](https://sketchfab.com/3d-models/rigged-hand-eae97cc2a742413cb5338ab942b12c1e),
CC-BY-SA-4.0. Commercial use is permitted. Two obligations:

1. **Attribution.** README carries the credit line; keep it visible in any
   downstream fork or product page.
2. **ShareAlike on modifications.** Any edits to the mesh, textures, or
   rigging must be released under CC-BY-SA-4.0 as well. Our project code
   stays MIT because we do not modify the model; we drive its bones at
   runtime through a normal glTF skeleton API. Runtime pose data is not a
   derivative of the model geometry.

If you replace this model with a proprietary one, remove the credit and
update this section.

## Third-party tools/data that ARE OK

- **Three.js**, **React**, **Vite**, **Tailwind**: MIT.
- **compromise.js**: MIT.
- **@react-three/fiber**, **@react-three/drei**: MIT.
- **Kaggle Google ASL Signs** dataset: permissive Kaggle terms; use
  for prototype and validate current terms before commercial launch.
- **Ready Player Me** avatars (when integrated later): free commercial
  tier per their ToS; keep an alternative (Mixamo, Adobe free license)
  tested and swappable.

## AI providers

The runtime AI calls (Gemini / Claude / DeepSeek) happen against paid
provider APIs and are your responsibility to secure and pay for. Rules:

- Never put an API key in the browser bundle.
- Always route through the server proxy at `scripts/ai-proxy/`.
- Rate-limit and cache aggressively (§13 in PLAN.md).

## First-launch checklist before commercial ship

1. `npm run license:check` — green.
2. `npm run test` — green (includes commercial-safety audit).
3. Every dictionary entry has `commercial_safe: true` and
   `provenance` not equal to `wlasl-derived`.
4. AI proxy runs on your own infra with your own keys.
5. Signer consent forms on file for every `self-recorded` entry.

## Full-body avatar ("Godette")

The avatar in `public/godette/godette.glb` has **no confirmed author or
licence recorded yet**. Identify the source, record the licence and credit
line here and in the README, or replace the model, before any public release
or commercial use.
