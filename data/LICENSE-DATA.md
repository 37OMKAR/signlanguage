# Sign Data Provenance & Licensing

Every sign in `gloss_dictionary.json` is tracked here so we know before
commercial launch that nothing carries a research-only license.

## Legend
- **hand-authored** — we authored the pose ourselves in code/Blender. MIT, commercial-safe.
- **self-recorded** — we recorded a signer + extracted with MediaPipe. Commercial-safe with signer consent on file.
- **kaggle-google-asl** — derived from Google's Kaggle ASL Signs dataset. Prototype-safe under competition terms; verify before commercial ship.
- **kaggle-include-isl** — real motion retargeted from the AI4Bharat INCLUDE dataset (see below). **Not commercial-safe until license-verified** — the Kaggle repackaging is tagged MIT, but that may not clear the underlying original dataset's own terms.
- **signmatic-asl** — real motion retargeted from the SignMatic ASL Keypoint Dataset (Lebanese International University contributors, Kaggle: `joesarkis/signmatic-asl-keypoint-dataset-50-words-and-idle`). **CC BY 4.0, commercial-safe WITH attribution** — must credit "SignMatic ASL Keypoint Dataset by Joseph Sarkis et al." wherever the derived motion is used.

## Reference datasets on disk but NOT yet retargeted

These are pulled to `kaggle-data/` (all git-ignored) as raw source
material we may retarget later. Nothing in them ships in the compiled
dictionary today.

- **AslgPc12** (`thedevastator/unlocking-the-power-of-cross-cultural-language-i`, 13 MB, **CC0 public domain**). English↔ASL gloss parallel corpus, 263 K rows. Text-only, no motion. Currently used only as offline reference for the lemmatizer patterns in `src/nlp/glossRules.ts` (`lemmatize()` and its irregular-verb table). The raw derived word→gloss map is saved to `scripts/data-prep/aslgpc12_word_map.json`.

- **FLEURS-ASL** (`googleai/fleurs-asl`, ~26 GB, **CC BY-SA 4.0**). Google's ASL extension of the FLORES/FLEURS multilingual benchmark. 1,749 sentence-video pairs across 5 signers, 97 MP4 files, avg 15s per sentence. This is raw video, NOT landmarks — using it for our text→motion pipeline requires first running MediaPipe over ~30 h of video to extract landmarks. Deferred until we have a batch landmark-extraction pipeline; noted here so we don't re-download or re-evaluate.

- **Motion-S** (`antonygithinji/motion-s-sign-language-motion-dataset`, ~14 GB, **CC BY-NC 4.0 — non-commercial**). SMPL-X mocap in BVH format, 12,468 text↔gloss↔motion samples, 6,075-word vocabulary. The only Kaggle dataset with real text→sign-motion pairs. **Prototype-only until commercial licensing is negotiated** — would produce entries with the same `commercial_safe: false` posture as INCLUDE.
- **wlasl-derived** — derived from WLASL pose files. **Prototype only.** Must be replaced before commercial launch.

## Current entries

**320 total entries.** 74 hand-authored (`commercial_safe: true`) and
246 retargeted from the AI4Bharat INCLUDE dataset via
`scripts/data-prep/batch_retarget_include.py`
(`kaggle-include-isl`, `commercial_safe: false`). The batch runs the
same angle-based retargeter that produced HELLO across every extracted
INCLUDE word folder in `kaggle-data/extracted/keypoints/`, taking one
"best" take per word (largest file = most frames for the median
smoother). Hand-authored entries covering the same gloss are skipped
by default, so this expansion adds vocabulary without clobbering
manually tuned poses.

Wrist rotation/position of the 246 mocap-derived entries are
placeholders (0,0,0) — only the finger curl values come from real
motion. Wrist retargeting from landmarks is a separate not-yet-done
step (see docs/RETARGETING.md).

33 word entries (NICE, HAPPY, WANT, EAT, LIKE, FRIEND, WATER, MOTHER,
FATHER, SAD, TIRED, HUNGRY, AGAIN, FINE, DEAF, GOODBYE, MORE, NEED,
UNDERSTAND, KNOW, WAIT, STOP, FINISH, HOT, COLD, SICK, BATHROOM, DRINK,
WORK, HOME, WHO, WHY, WHEN) are flagged in their own `notes` field as
**best-effort approximations, not verified by an ASL signer** — authored
by reasoning about the handshape/motion from written descriptions, not
from real motion capture or a fluent signer's review. Licensing is clean
(we wrote the rotation values ourselves), but linguistic accuracy should
be checked by a native/fluent ASL signer before relying on them for real
communication.

## HELLO: first real motion-capture retargeting (proof of concept)

HELLO's **finger curl values only** (not wrist position/rotation, which
remain our own hand-authored approximation) were replaced with real
motion data via `scripts/data-prep/retarget_include.py`:

- **Source**: AI4Bharat's INCLUDE dataset, repackaged as MediaPipe
  Holistic landmarks by Kaggle user "swaptr"
  (`swaptr/indian-sign-language-mediapipe-holistic-landmarks`), tagged
  MIT on Kaggle. 262 ISL words, 4,284 takes, 553 landmarks/frame.
- **Take used**: `keypoints/greetings/hello/MVI_0031.parquet`, right hand.
- **Method**: angle-based retargeting (joint angle between consecutive
  bone segments, scale-invariant across hand sizes — see
  `docs/RETARGETING.md`) with a 5-frame median filter to remove
  MediaPipe tracking-noise spikes (confirmed present in raw data:
  isolated single-frame jumps to 60-120deg with no support from
  neighboring frames).
- **Validated, not just extracted**: cross-checked against 2 other
  independent takes of the same sign (MVI_0029, MVI_0030) before use.
  MVI_0029 showed a *sustained* tracking failure across several
  consecutive frames on ring/pinky that the median filter could not
  fix — discarded that take rather than trust the filter to save bad
  source data. MVI_0030 and MVI_0031 were consistent with each other;
  MVI_0031 was used.
- **Why `commercial_safe: false` despite the MIT tag**: the Kaggle
  *repackaging* is MIT-licensed, but the underlying AI4Bharat INCLUDE
  dataset (the original signer recordings) may carry its own, more
  restrictive terms that a repackager cannot unilaterally override.
  Flagged unsafe until a human verifies the actual license chain back to
  AI4Bharat's own terms. `auditCommercialSafety()` correctly catches this
  (see `tests/loader.test.ts`).
- **kaggle-data/** (the downloaded dataset, ~2.6GB) is git-ignored — never
  committed, and we don't redistribute it.

The second batch (GOODBYE through WHEN) was prompted by a user-shared
YouTube video ("50 Basic ASL Conversational Signs") — we could not watch
the video or pull its transcript, so rather than guess at its specific
content we compared our dictionary against the standard beginner ASL
conversational vocabulary that's consistent across virtually every ASL
101 resource (Lifeprint, Start ASL, Gallaudet materials) and filled the
real gaps that turned up.

## Vocabulary source note

The choice of *which* words to add (this batch of 15) was guided by
Microsoft's MS-ASL dataset class list (`archive/MSASL_classes.json`,
licensed under C-UDA v0.1 — see `archive/README.md`). We used only the
**list of English words** as a prioritization aid — a plain list of common
words is not copyrightable content we need a license for. We did NOT use
any video, pose, or keypoint data from that dataset; MS-ASL only ships
YouTube URLs + timestamps, not usable motion data, and C-UDA's
"Computational Use" restriction plus YouTube's own ToS make that dataset's
actual video content prototype-only at best — deliberately not used here.

## Third-party assets shipped

- `public/rigged-hand/*` — "Rigged hand" by Elena FF
  (https://sketchfab.com/3d-models/rigged-hand-eae97cc2a742413cb5338ab942b12c1e),
  CC-BY-SA-4.0. Attribution required. Modifications must stay CC-BY-SA.

## Rule

No commercial release may include any entry marked `commercial_safe: false`
or with provenance `wlasl-derived`. CI should enforce this before build.
