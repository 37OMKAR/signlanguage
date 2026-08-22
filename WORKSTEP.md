# Work Steps — Path to "Ready to Test"

Live checklist. Each item marked as we finish. Bugs found during testing
get appended.

Legend: `[ ]` pending · `[~]` in progress · `[x]` done · `[!]` blocked

## Round 1 — Verify the current build in a real browser

- [x] 1.1 Start dev server, open in browser
- [x] 1.2 Type "hello you" → gloss ["HELLO", "YOU"], 3 frames loaded ✓
- [x] 1.3 Console confirms full pipeline runs without errors
- [x] 1.4 Caption overlay renders correctly ("HELLO\nnext: YOU · THANK-YOU")
- [x] 1.5 Found: canvas sized 300×150 (huge layout bug — 3D view invisible)

## Round 2 — Fix bugs found in Round 1

- [x] 2.1 Section min-height added so grid child gets real dimensions
- [x] 2.2 CSS `canvas { width:100%; height:100% }` forces display size
- [x] 2.3 `useKickResize` hook fires window resize post-mount so r3f
       WebGL viewport syncs to real container size
- [x] 2.4 Fixed: canvas now renders at 1368×856 draw / 912×571 CSS
       (browser-testing pane can't composite frames, but real browser tabs will)

## Round 3 — Real 3D hand model

- [x] 3.1 User dropped rigged_hand/ (Elena FF, CC-BY-SA-4.0) — copied to public/
- [x] 3.2 Inspected glTF: 5 fingers × 3 phalanges, bone names decoded
- [x] 3.3 Built canonical→rig bone map (thumb_01.R_08, index_01.R_017, etc.)
- [x] 3.4 New RiggedHand.tsx component: useGLTF, per-instance clone,
       drives bones from SignFrame quaternions with slerp, eases back to
       rest pose when queue empties
- [x] 3.5 Left hand rendered as mirrored clone (scale.x = -1)
- [x] 3.6 Suspense fallback so app doesn't hang while GLTF loads
- [x] 3.7 Attribution added to README, docs/LICENSING.md, LICENSE-DATA.md

## Round 4 — Cross-check tests + build

- [x] 4.1 `npx tsc --noEmit` clean
- [x] 4.2 `npm test` all 15 pass
- [x] 4.3 `npm run build` clean (1.44 MB / 439 KB gzip)

## Round 5 — Commit + push + declare ready

- [ ] 5.1 Commit and push to GitHub
- [ ] 5.2 Tell user: ready to test, with concrete demo inputs

## Known caveats for the user to know before testing

- The rigged hand is right-hand-only in the source. Left is mirrored, so
  chirality-sensitive signs (rare) may look odd. Fixable later by using a
  separate L rig or bone-name remap.
- Hand rest position is placed near y=1.15 world; two hands are offset
  ±0.15 on X. If they look mispositioned in your window, tweak
  `groupProps.position` in `RiggedHand.tsx`.
- Some quaternions in the dictionary use rotation axes that assume a
  simple "X-axis flexion" curl. The real rig's finger bones may bend on
  a different local axis — visual tweak may be needed after first look.
