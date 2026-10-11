# Audit: code quality and sign accuracy

Performed on the first import of the repository (v0.1), by reading the code,
running the suite, inspecting the dictionary programmatically and exercising
the app in a browser.

Baseline: type-check clean, 30 / 30 tests passing, dev server and production
build working.

## 1. Code findings

| # | Finding | Severity | Status |
|---|---|---|---|
| C1 | Repeating a word ("yes yes yes") froze the queue: the cached sign was the same array object, so React saw no change and the finish timer never re-armed. Reproduced in the browser. | High | **Fixed** |
| C2 | `handleSignFinished` ran side effects (speech, loading) inside a `setState` updater, which StrictMode invokes twice in dev. | Medium | **Fixed**: queue now lives in a ref |
| C3 | A sign that finished loading after the user started a new translation could overwrite the new one. | Low | **Fixed** (stale-load guard) |
| C4 | `npm run lint` failed: no ESLint config for ESLint 9. CI did not run lint. | Medium | **Fixed**: flat config + CI step |
| C5 | Two dictionary notes contained mojibake ("â€”"). | Low | **Fixed** |
| C6 | `npm audit`: 12 advisories (9 high), all in dev tooling transitive dependencies (`braces`, `js-yaml`, `esbuild`, `source-map-js`). | Low | Open: not in the shipped bundle; `audit fix --force` risks breaking the build |
| C7 | 48 entries have `duration_ms` that disagrees with their last frame; about 600 finger-curl values fall outside a plausible range (< -20 or > 110 deg). | Medium | Open: clamp or re-extract |
| C8 | AI proxy defaults to `Access-Control-Allow-Origin: *` and has no rate limit. Fine locally, must be locked down before exposure. | Medium | Open: documented in the proxy header |
| C9 | Debug hooks on `window` (`__godette`, `__r3f`, `__forceBlinkAmount`, ...) are always on. | Low | Open |
| C10 | Tests cover compile, NLP, loader and classifier logic but nothing checks that a sign looks right. | Medium | Partly: arm IK tests added; per-sign pose tests still open |

## 2. Sign-accuracy findings

| # | Finding | Status |
|---|---|---|
| S1 | Hand **location** was not modelled: `R_palm_pos` is authored but intentionally ignored at runtime (moving a skinned bone shears the mesh), so all signs ended at the same point. | **Fixed for 35 signs** with body-anchored two-bone IK ([ARM_IK.md](ARM_IK.md)) |
| S2 | 237 ISL signs carry finger curls only (wrist rotation and position are all zero) from a single recording each. Words such as BIG or TALL depend on location and motion, so they do not read as the sign. | Open |
| S3 | The default "Any" language mode silently fills ASL gaps with ISL signs. | Open: default to a single language, label fallbacks |
| S4 | All 74 hand-authored entries are unverified guesses (their notes say "not verified by an ASL signer"). Several diverge from the real sign, for example WHEN, WHO, WANT, FRIEND, HOT, COLD; THANK-YOU uses a bent thumb instead of a flat hand. | Open: needs signer review |
| S5 | Hand model has one rotation axis per joint: no finger spread, thumb opposition or wrist twist. U and V are identical, as are G / L / Q and K / P; R cannot cross fingers; M, N, S, T, E are approximate. About 15 of 26 letters are close. | Open |
| S6 | No hand-to-hand contact (LOVE, HELP, NAME, WORK are two hands near each other, not touching). | Open |
| S7 | Authored face `blendshapes` are never applied; only eyebrows (questions) and a head shake (negation) are driven, and the avatar always smiles. | Open |
| S8 | No blending between signs and the arm lowers and re-raises between words. | Open |
| S9 | Grammar rules are shallow: no classifiers, spatial pronouns or plural reduplication. | Open |
| S10 | Palm orientation was authored for the old fixed arm lift and may be off now that the forearm follows IK. EAT lands near the eye (wrist at the mouth, fingers extend up). | Open |

## 3. Licensing findings

- The Godette avatar (`public/godette/godette.glb`) has no confirmed author
  or licence in the repo. Resolve this before any public release.
- `data/LICENSE-DATA.md` entry counts were stale (320 / 246); updated to
  329 / 237.
- INCLUDE-derived ISL entries remain `commercial_safe: false`.

## 4. Suggested order of work

1. Anchors for the remaining location signs; fix EAT, THANK-YOU palm and fingers.
2. Richer hand model (spread, thumb rotation, wrist twist), then re-author letters.
3. Replace or verify hand-authored words with a signer; import more SignMatic-style data that includes wrist pose.
4. Co-articulation between signs and hand contact.
5. Per-sign pose regression tests and a dictionary linter for C7.
