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

## Round 6 — Godette full-body avatar

- [x] 6.1 User dropped multiple model formats — scanned folder
- [x] 6.2 Picked `godette_rigged (1).glb` (smaller of the two GLBs, same rig)
- [x] 6.3 Copied to `public/godette/godette.glb` (1.66 MB)
- [x] 6.4 Inspected: 227 skinned joints, full body + face + 5 fingers × 3
       phalanges × 2 hands = 30 finger bones
- [x] 6.5 Built `Godette.tsx` component:
       - useGLTF, per-instance clone, bone name regex map
       - drives 30 finger bones + 2 palms from SignFrame data
       - applies pose ON TOP of rest orientation (multiply, not overwrite)
       - eases to rest between signs
- [x] 6.6 Replaced pair of Elena hands + placeholder head with single Godette
- [x] 6.7 Cleaned up duplicate/source files from repo root
- [x] 6.8 Type-check clean, 15 tests pass, prod build clean (1.44 MB / 439 KB gzip)

## Round 7 — Diagnose "static model" report

- [x] 7.1 Confirmed all 30 canonical bones map to real skinned skeleton bones
       (`isInSkeleton: true` for every one). Skinning is correctly wired.
- [x] 7.2 Confirmed useFrame IS firing: a diagnostic probe moved R_index0
       quaternion visibly over 1.5s intervals.
- [x] 7.3 FOUND BUG: playback code was writing bone **positions** during
       sign playback. Skinned meshes bake bone rest positions into
       inverseBindMatrices — moving bones at runtime shears the mesh.
       Removed the palm-position code entirely; only rotations now.
- [x] 7.4 Camera framing was on the chest (0, 1.2, 0.1). Godette's rest
       T-pose has hands at the hips, so finger animations were happening
       out of frame. Moved camera to (0, 0.9, 1.0) targeting (0, 0.9, 0)
       so hands are prominent.
- [x] 7.5 Enabled pan in OrbitControls so viewer can drag to reframe.
- [x] 7.6 Removed diagnostic probe and IK-target manipulation
       (Blender IK constraints don't survive glTF export anyway).
- [!] 7.7 Cannot 100%-verify animation visually here: the test browser
       pane runs with document.visibilityState=hidden, which blocks
       requestAnimationFrame entirely (framesFired=0). Verification
       requires a real browser tab.

## Round 8 — REAL root cause of "frozen statue" found and fixed

- [x] 8.1 Instrumented the render loop with a debug bridge (`window.__godette`,
       `window.__r3f`) to inspect live Three.js state independent of rAF.
- [x] 8.2 Confirmed all 30 bones are correctly wired to the skinned skeleton
       (isInSkeleton, correct parent/children links — the earlier "detached
       bone" theory was ruled out).
- [x] 8.3 **FOUND THE ACTUAL BUG**: `Godette.tsx` built the render clone with
       `scene.clone(true)`. Three.js's `SkinnedMesh.copy()` (see
       `node_modules/three/src/objects/SkinnedMesh.js:96`) does
       `this.skeleton = source.skeleton` — a **reference copy**, not a
       rebind. This means the cloned mesh's skeleton still pointed at the
       ORIGINAL, un-cloned bone hierarchy. Every bone we found and rotated
       (via traversing the *clone*) had zero effect on what was actually
       rendered, because the visible mesh was still skinned against the
       untouched original bones. This is why the model looked perfectly
       frozen no matter what the animation code did — a textbook Three.js
       gotcha that has a dedicated fix upstream.
- [x] 8.4 Fixed: replaced `scene.clone(true)` with
       `clone as cloneSkeletal` from
       `three/examples/jsm/utils/SkeletonUtils.js`, which properly rebinds
       `skeleton.bones` to the new clone.
- [x] 8.5 Verified the fix mechanically: manually rotated 7 different bones
       (fingers, head, spine) by 90°, force-rendered, and diffed
       `skeleton.boneMatrices` before/after — all changed as expected. Also
       diffed rendered canvas PNG bytes before/after — confirmed different.
- [x] 8.6 Re-verified against the **production build** (`npm run build` +
       `npm run preview`), not just the dev server — same result, all
       bones update correctly.
- [x] 8.7 Added a subtle idle-motion system (breathing sway on spine/head,
       independent sine waves per bone) so she's never perfectly static
       even when no sign is playing, addressing "not a stone statue".
- [x] 8.8 Type-check clean, 15/15 tests pass, prod build clean (1.44MB /
       439KB gzip).

## Round 9 — Arm lift, face life, LongCat provider

- [x] 9.1 Confirmed via user screenshot report: hands ARE moving (Round 8
       fix holds in the user's real browser).
- [x] 9.2 Identified new gap: only the wrist rotated per sign; the whole
       arm stayed at the hip, so signs were nearly invisible in frame.
- [x] 9.3 Added R_armUp/R_armLo/L_armUp/L_armLo bone tracking + a
       per-side "lift to signing height" pose, eased in/out, active only
       for the hand(s) a given sign's data actually uses (checked via
       `handUsage` scan of R_/L_ prefixed keys in the sign's frames).
- [x] 9.4 Tuned lift rotation values through 5 rounds of live
       screenshot iteration (not guessed): first attempt swung the arm
       sideways past the shoulder; second overshot forward and curled the
       hand down to the hip; final values (upper arm ~20-25° lateral +
       ~105° forward, forearm ~-35°) bring the hand up clearly in front
       of the face/chest.
- [x] 9.5 Verified one-handed (HELLO, only right arm lifts) and
       two-handed (LOVE, both arms lift) signs both look correct.
- [x] 9.6 Added idle smile via bone-driven lip-corner lift (mesh has no
       morph targets — checked at runtime, confirmed bone rig instead).
- [x] 9.7 Added periodic eye blink (~180ms pulse every 4s), verified by
       sampling eyelid bone rotation offset every 200ms over 4s — a
       single non-zero spike confirmed the blink fires correctly.
- [x] 9.8 Reframed camera twice based on live screenshots: first pass
       showed only her hips (way too low), second pass (post face-only
       zoom) clipped the lifted hands out of frame entirely; final
       framing shows face + chest + both hands when raised.
- [x] 9.9 Added LongCat V2 as a fourth AI provider (Gemini/Claude/
       DeepSeek/LongCat), verified against the live API: correct gloss
       output for two different test sentences including proper
       wh-word-to-end ASL ordering.
- [x] 9.10 Security: LongCat API key placed only in
       `scripts/ai-proxy/.env` (git-ignored, verified with
       `git check-ignore -v` and a full `git log --all -p` grep showing
       zero occurrences of the key in history before pushing).
- [x] 9.11 Type-check clean, 15/15 tests pass, prod build 1.44MB/440KB
       gzip. Pushed to GitHub.

## Round 10 — Real root cause: blink and smile bones had zero/weak influence

User reported blink and smile "not there" despite Round 9 claiming both
verified. Re-investigated from scratch, live in the browser:

- [x] 10.1 Checked actual vertex-weight influence of every facial bone via
       skinIndex/skinWeight attributes (the check that should have been
       done in Round 9 instead of trusting a bone-rotation diff alone).
       **Found: `eyelidUpperL`/`eyelidUpperR` (`Eyelid_Control_Upper.L/R`)
       have ZERO vertex weight.** They are pure IK-style control bones —
       rotating them was mechanically "working" (the quaternion genuinely
       changed) but had **no visual effect whatsoever**, because no mesh
       vertex is bound to them. This is exactly why the blink was
       invisible; the Round 9 verification method (checking the bone's
       own rotation) could never have caught this class of bug.
- [x] 10.2 Found the real deforming eyelid rig: 20 "spoke" bones per eye
       (`Eyelid_L0..19` / `Eyelid_R0..19`), all sharing one pivot at the
       eye center, each with real vertex weight (~10-11 verts each).
       Replaced the dead control-bone patterns with all 40 real bones.
- [x] 10.3 Verified the fix live: forced all 40 bones to a closed-eye
       delta via a debug hook and screenshotted — both eyes visibly,
       convincingly closed with eyelash geometry folding correctly.
- [x] 10.4 Smile (`lipCornerL/R`) DID have real vertex weight (12 verts
       each) so the mechanism was never broken, but at the original 0.16
       rad amplitude the effect was too subtle to notice — consistent
       with the user's report. Increased amplitude, but first accidentally
       overshot to 0.42 rad which **visibly broke the mesh** (a huge
       spike/tear across the face, confirmed via screenshot). Backed off
       to 0.18 rad — clean, visible smile, no distortion, confirmed by
       screenshot.
- [x] 10.5 Eyebrow raise/furrow: original 0.35 rad, then 0.5 rad, produced
       no mesh distortion but was nearly invisible in a screenshot A/B.
       Raised the multiplier to 1.1 — now clearly visible (arched brows on
       raise) with zero distortion, confirmed both directions.
- [x] 10.6 Bone count: 45 -> 83 (added 40 eyelid spokes, removed 2 dead
       control bones).
- [x] 10.7 Added temporary debug hooks (`window.__forceBlinkAmount`,
       `window.__forceEyebrowAmount`) used only for this verification —
       harmless no-ops when unset, left in place since they're useful for
       any future facial-rig debugging (same pattern as the existing
       `window.__godette` bridge).
- [x] 10.8 Type-check clean, 15/15 tests pass, prod build 1.44MB/440KB gzip.

**Lesson learned, written down so it isn't repeated**: for ANY new bone
added to this rig, always check its actual `skinIndex`/`skinWeight`
vertex influence before trusting that rotating it will be visible.
A bone can have a perfectly normal, changeable quaternion and still be
mechanically inert on screen if it carries zero skin weight — this rig
has both deforming bones and IK/FK control bones with identical-looking
names, and only the vertex-weight check tells them apart.

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
