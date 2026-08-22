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

## Round 11 — Long paragraph test, animation smoothing, studio lighting

- [x] 11.1 Tested a real long paragraph (10 sentences, 66 gloss tokens) end
       to end via the live app. Found a real bug: the whole paragraph was
       treated as ONE run-on sentence, so every wh-word/question marker
       from every sentence got shoved to the very end together instead of
       staying with its own sentence (e.g. "how" from sentence 1 ending up
       next to "what" from sentence 3).
- [x] 11.2 Fixed: `ruleBasedGloss` now splits on `.`/`!`/`?` into
       sentences first (`splitSentences`), glosses each one independently,
       then concatenates. Verified live: "How are you today? What is your
       name? I am not happy." now correctly glosses as
       `TODAY HOW ... WHAT ... NO` with each marker staying next to its
       own sentence, not bunched at the end.
- [x] 11.3 Added 2 new tests locking in the sentence-split behavior
       (17/17 tests passing total).
- [x] 11.4 Tested all 41 dictionary entries (26 letters + 15 words)
       programmatically via the live loader: zero errors, zero
       zero-frame results, commercial-safety audit clean.
- [x] 11.5 Fixed animation jerkiness at its real cause: bones were
       hard-copying their target quaternion every frame instead of
       easing toward it. Replaced `.copy(target)` with
       `.slerp(target, SMOOTH_ALPHA)` in the main sign-driving loop.
       Verified via bone-delta sampling across a real A->B fingerspell
       transition: per-frame rotation delta now shows a clean exponential
       decay (21 deg -> 20 deg -> 11.7 deg -> 1.4 deg -> 0.5 deg -> 0.1 deg)
       instead of one instant snap-then-zero, confirming the transition is
       genuinely spread across several frames now.
- [x] 11.6 Replaced the flat navy background with a gradient "photo
       studio sweep" backdrop (CanvasTexture, dark cool top fading to
       lighter warm grey bottom).
- [x] 11.7 Replaced the single ambient+directional light with real
       three-point studio lighting: warm key light (front-right, casts
       shadows), cool fill light (opposite side, low intensity), rim/back
       light (behind her, separates her from the backdrop), plus a
       dedicated soft spotlight aimed at chest/hand height for extra
       sparkle on the signing hands. Fixed a real bug in the first pass:
       SpotLight's `target-position` JSX shorthand doesn't reliably attach
       to the scene graph — switched to the proper pattern (explicit
       `<primitive object={target}>` child + `lightRef.current.target =`).
       Confirmed via screenshot: dramatic visual improvement, proper
       depth/shading on face and hair.
- [x] 11.8 Type-check clean, 17/17 tests pass, prod build 1.44MB/440KB gzip.

## Round 12 — Head shake toned down, dead position-only sign data fixed

- [x] 12.1 Found the real cause of "head shaking too much": the negation
       head-shake ran at 6Hz (six full oscillations per second) with a
       hard instant `.copy()` snap every frame, not smoothed. A real human
       "no" shake is ~2 turns/sec, smooth. Fixed: 2Hz, amplitude 0.12 ->
       0.07 rad, and switched to `.slerp(target, 0.25)` instead of
       `.copy()` so it eases like the rest of the rig instead of
       twitching.
- [x] 12.2 Softened the constant idle head sway too (0.03 -> 0.018 rad,
       0.12 -> 0.1 Hz) since it stacks with everything else going on in
       the face/head.
- [x] 12.3 Investigated "hand orientation not proper" for the YOU sign
       live. Rigorously confirmed via bone-quaternion measurement (not
       just visual impression) that the finger-curl mechanism itself is
       CORRECT: index stays at 0 deg from rest (extended) while middle
       curls 84.7 deg, exactly matching the authored data. An earlier
       "looks fully fisted" reading was contaminated by leftover
       debug-interval overrides from prior testing, confirmed by redoing
       the check cleanly after a full reload.
- [x] 12.4 Found and fixed the REAL orientation bug: YOU, ME, SORRY, HELP,
       and NAME relied entirely on `R_palm_pos` (a position offset) to
       convey their pointing/motion direction. We deliberately stopped
       applying bone positions during playback (Round 7 -- correct, since
       moving a skinned bone shears the mesh), which silently made these
       five signs' direction/motion data completely inert -- they had
       real curl data (correct handshape) but ZERO wrist rotation, so
       nothing indicated *which way* the hand was oriented. Replaced the
       dead position data with real `R_palm_deg` rotations approximating
       each sign's intended direction (YOU/ME point via wrist rotation,
       SORRY/HELP/NAME approximate their circular/lift/tap motions as
       wrist tilts). Documented in each entry's `notes` field, with a
       pointer to why position offsets don't work, for future reference.
- [x] 12.5 Confirmed all 41 dictionary entries still load without errors
       after the data changes (same programmatic sweep as Round 11).
- [x] 12.6 Attempted live oscillation verification of the new head-shake
       via interval sampling; hit the same rAF-throttling wall as prior
       rounds (this harness's clock only ticked once per ~2 real seconds
       during the sample window, confirmed by reading
       `window.__r3f.clock.elapsedTime` directly -- not a code bug, an
       environment limitation already documented in earlier rounds).
       The formula itself (2Hz sine, 0.07 rad, slerp-smoothed) is
       mechanically identical in structure to the already-verified idle
       head sway, just gentler -- no further live confirmation attempted
       given the known harness constraint.
- [x] 12.7 Type-check clean, 17/17 tests pass, prod build 1.44MB/441KB gzip.

**Known remaining limitation, stated honestly**: the ARM_LIFT generic pose
and each sign's own hand-orientation data are authored in different
reference frames and composed by multiplication -- they don't always
produce an anatomically ideal combined pose (e.g., a pointing finger may
end up partially foreshortened from the camera's angle depending on which
sign is playing). This is an architectural simplification, not a bug in
any one sign; a full fix would mean re-authoring every sign's rotation
data relative to the lifted-arm frame, which is future work.

## Round 13 — More elbow bend, real "I love you" sign

- [x] 13.1 Measured the elbow articulation directly: at the previous
       ARM_LIFT constants, the shoulder rotated 101 deg while the elbow
       only bent 33 deg -- mechanically working, but the shoulder swing
       dominated the visual impression so the arm read as nearly rigid,
       matching the "not bending the elbows" complaint.
- [x] 13.2 Rebalanced ARM_LIFT so shoulder and elbow contribute more
       evenly. Iterated live via screenshot: first pass (78/-78) gave a
       clearly bent elbow but dropped the hand too low (world Y 1.03,
       partly out of frame); second pass (95/-70) confirmed via
       screenshot showing a natural, clearly visible bent-elbow pose with
       the hand back in frame.
- [x] 13.3 Tested "I love you" live: found it glossed as three separate
       signs (ME, LOVE, YOU) instead of the single, iconic ASL "I-LOVE-YOU"
       handshape (thumb+index+pinky extended, middle+ring folded) --
       a real, well-known dedicated sign, not three signs strung together.
- [x] 13.4 Added "I-LOVE-YOU" as a proper dictionary entry, and a phrase
       detector (`collapseILYPhrase` in glossRules.ts) that recognizes
       "I love you" / "I loved you" / "I do love you" (tolerating a
       dropped word like "do" in between) and collapses it to the single
       idiom token before the normal per-word gloss pipeline runs, so
       normal reordering rules can't split it apart.
- [x] 13.5 Added 2 tests locking in the phrase collapse and confirming it
       does NOT fire for unrelated sentences like "You love me" (19/19
       tests passing, up from 17).
- [x] 13.6 Re-ran the full dictionary sweep after adding the new entry:
       all 42 signs (up from 41) load without errors, commercial-safety
       audit clean.
- [x] 13.7 Attempted live visual confirmation of the ILY handshape and
       the reworked elbow pose across several tries; hit the same
       unpredictable multi-second round-trip latency documented in prior
       rounds -- even a sign artificially slowed to ~2.8s (via the
       playback-speed control) had already finished by the time each
       script began executing. Did not force further live visual
       confirmation given this is a known, repeatedly-confirmed
       environment constraint, not a code issue; relied on the mechanical
       verification already done (compiled dictionary data inspected
       directly, gloss collapse tested both via unit tests and the live
       console, elbow/shoulder rotation measured numerically) instead.
- [x] 13.8 Type-check clean, 19/19 tests pass, prod build 1.44MB/441KB gzip.

## Round 14 — Dial back overshoot, slow default pace, add body engagement

User reported (after Round 13's elbow rebalance): hand/elbow bending in
the wrong-looking direction, head wiggling excessively, signs too fast,
and not enough full-body involvement.

- [x] 14.1 Elbow: Round 13 pushed the elbow bend from -35 to -70deg to
       fix "not bending" — likely overshot past a natural-looking range,
       which reads as "wrong direction" even though the rotation axis
       itself didn't change sign. Dialed back to a middle ground
       (shoulder 95->85deg, elbow -70->-50deg) — still a real, visible
       bend, less extreme.
- [x] 14.2 Wrist: the R_palm_deg values added to YOU/ME in Round 13 were
       tuned (by reasoning, not live visual confirmation — documented at
       the time) against the OLD arm-lift geometry, then the arm-lift
       geometry itself changed in the same round. Halved their magnitude
       to reduce the risk of a mismatched, anatomically-odd wrist angle
       compounding with the new arm pose.
- [x] 14.3 Head/spine wiggle: cut idle sway amplitudes further across the
       board (spine1 0.02->0.008, spine2 0.015->0.006, head 0.018->0.007
       rad) and slowed their frequencies slightly. Also softened the
       negation head-shake again (0.07->0.05 rad, 2->1.6Hz).
- [x] 14.4 Pace: default playback speed changed from 1.0x to 0.7x
       (`src/App.tsx`) so signs and fingerspelling read at a calmer pace
       out of the box. Users can still speed up via the existing slider.
- [x] 14.5 Full-body involvement: added a small forward torso lean
       (spine1 6deg, spine2 4deg, split across both joints) that eases in
       while actively signing and eases back to neutral when idle — real
       interpreters engage their whole upper body, not just the arm; a
       perfectly static torso during signing was a fair complaint.
- [x] 14.6 Re-ran the full 42-sign dictionary sweep after all data/code
       changes: zero errors, commercial-safety audit clean.
- [x] 14.7 Type-check clean, 19/19 tests pass, prod build 1.44MB/441KB gzip.

**Verification honesty**: live screenshot/numeric confirmation of the
retuned elbow angle and new lean was attempted but blocked by the same
unpredictable round-trip latency documented in Rounds 11-13 — signs kept
finishing before each check script's wait completed, even at reduced
speed. These are parameter changes to an already mechanically-verified
system (same rotation axes and application code as previous rounds, only
magnitudes changed), not new untested logic, so risk is low, but the
user should treat this round's visual result as "reasoned + math-checked"
rather than "screenshot-confirmed" and report back if it's still off.

## Round 15 — Full paragraph re-test, MS-ASL archive evaluation, vocab growth

- [x] 15.1 Ran a comprehensive 12-sentence paragraph exercising every
       feature built so far (time-fronting, wh-questions, yes/no
       questions, negation, the I-LOVE-YOU idiom, two-handed signs,
       fingerspell fallback). Zero JS errors. Confirmed the queue
       genuinely progresses (not stuck) by sampling captions over a 4s
       window and seeing them advance.
- [x] 15.2 User pointed at `archive/` (Microsoft's MS-ASL dataset).
       Inspected it fully before using anything from it:
       - It's **metadata only** — YouTube URLs + timestamps + labels, no
         video/pose/keypoint data actually included.
       - License is C-UDA v0.1: permits "Computational Use" only: same
         category as our existing WLASL/iSign prototype-only entries in
         docs/LICENSING.md, not a general commercial-use license.
       - Bulk-downloading the referenced YouTube videos would also raise
         YouTube's own ToS concerns, independent of C-UDA.
       - Read the full C-UDA PDF (not just skimmed) before concluding this.
- [x] 15.3 Decision (user deferred to our judgment): use ONLY the plain
       English word list (`MSASL_classes.json`, 1000 words) as a
       prioritization aid for which signs to add next -- a word list
       isn't copyrightable content requiring a license, and this avoids
       every licensing/ToS risk of the actual dataset content.
- [x] 15.4 Cross-referenced MS-ASL's top-60 most frequent words against
       our 42-word dictionary; found 15 high-value gaps and hand-authored
       all of them: NICE, HAPPY, WANT, EAT, LIKE, FRIEND, WATER, MOTHER,
       FATHER, SAD, TIRED, HUNGRY, AGAIN, FINE, DEAF.
- [x] 15.5 Each new entry's `notes` field honestly flags it as a
       "best-effort approximation, not verified by an ASL signer" --
       authored by reasoning about the described handshape/motion, not
       from real motion capture or native-signer review. Licensing is
       clean (we wrote every rotation value), linguistic accuracy is
       unverified and should be checked by a fluent signer before
       relying on these for real communication.
- [x] 15.6 Added `archive/` to .gitignore with a comment explaining why
       (C-UDA + YouTube ToS mean we should not redistribute it, and we
       don't need to -- only the word list informed our own work, and
       that's already fully captured in our own hand-authored data).
- [x] 15.7 Updated data/LICENSE-DATA.md documenting the vocabulary-source
       decision and the approximation caveat for the new 15 signs.
- [x] 15.8 Full dictionary sweep: all 57 signs (42 previous + 15 new)
       load without errors, commercial-safety audit clean.
- [x] 15.9 Type-check clean, 19/19 tests pass, prod build 1.45MB/442KB gzip.

## Round 16 — Natural ease-in/ease-out for the arm raise/lower

User reported the arm raise looked "forceful", like she's being yanked
into position rather than reaching up naturally.

- [x] 16.1 Diagnosed the real cause: the arm-lift amount was driven by a
       plain per-frame exponential lerp (`lerp(current, target, 0.12)`).
       That curve has its LARGEST step on the very first frame after a
       sign starts (since the gap to target is biggest then), then decays
       — i.e. it eases OUT but never eases IN. The very first instant of
       every raise was its fastest, most sudden motion: exactly what
       reads as "forceful" / "yanked".
- [x] 16.2 Replaced it with a proper two-stage curve: a time-based LINEAR
       ramp (`rampToward`, a fixed amount per second so a transition
       always takes the same real time regardless of frame rate) feeding
       into a `smoothstep` shaping function (3x^2 - 2x^3) before the
       result is used to drive the arm rotation. Smoothstep has ZERO
       velocity at both x=0 and x=1 — genuine ease-in AND ease-out.
       Applied the same treatment to the signing-lean amount for
       consistency.
- [x] 16.3 Verified the shape mathematically (not just visually, given
       this harness's known live-timing constraints): simulated 26 frames
       of a 0.4s raise at 60fps and printed the per-frame velocity
       (frame-to-frame change). Confirmed velocity starts small (0.0051),
       rises smoothly to a peak at the midpoint (0.0624 at frame ~11-12),
       then decreases symmetrically back to small (0.0051) before
       settling — a textbook slow-fast-slow curve, replacing the old
       curve's instant-fast-then-decay shape.
- [x] 16.4 Re-ran the full dictionary sweep after the code change: all
       57 signs load without errors.
- [x] 16.5 Answered the user's other question ("what is the sign where
       she touches her head and crosses her hands") by grepping our own
       sign notes: it isn't one sign, it's FATHER (thumb taps forehead)
       immediately followed by LOVE (both fists cross at chest) — whatever
       sentence was typed must have contained both words back to back.
- [x] 16.6 Type-check clean, 19/19 tests pass, prod build 1.45MB/442KB gzip.

## Round 17 — "50 Basic ASL Conversational Signs" video gap-fill

- [x] 17.1 User shared a YouTube link and asked "why don't we have this".
       Tried to fetch it; got only the video title ("50 Basic ASL
       Conversational Signs"), no transcript or description content
       available through WebFetch/WebSearch. Said so plainly rather than
       guessing at what the video specifically shows.
- [x] 17.2 Instead did something concretely useful: compared our
       dictionary against the standard beginner ASL conversational
       vocabulary set that's consistent across essentially every ASL 101
       resource (not just this one video) and found 37 real gaps.
- [x] 17.3 Hand-authored 18 of the highest-value gaps: GOODBYE, MORE,
       NEED, UNDERSTAND, KNOW, WAIT, STOP, FINISH, HOT, COLD, SICK,
       BATHROOM, DRINK, WORK, HOME, WHO, WHY, WHEN. The last three are
       wh-question words that previously had no real sign at all (the
       gloss pipeline already uppercases them correctly via WH_WORDS in
       glossRules.ts -- they were just fingerspelling before because no
       dictionary entry existed).
- [x] 17.4 Verified live: `hasSign("WHO"|"WHY"|"WHEN")` all true after a
       fresh page load (a stale Vite module cache falsely reported false
       immediately after the edit -- confirmed real after reload, not a
       code bug).
- [x] 17.5 Full dictionary sweep: all 75 signs (57 previous + 18 new)
       load without errors, commercial-safety audit clean, bone count
       unchanged at 83/83 (no new bones needed -- pure data addition).
- [x] 17.6 Type-check clean, 19/19 tests pass, prod build 1.46MB/443KB gzip.

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
