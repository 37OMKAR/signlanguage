# Sign Data Provenance & Licensing

Every sign in `gloss_dictionary.json` is tracked here so we know before
commercial launch that nothing carries a research-only license.

## Legend
- **hand-authored** — we authored the pose ourselves in code/Blender. MIT, commercial-safe.
- **self-recorded** — we recorded a signer + extracted with MediaPipe. Commercial-safe with signer consent on file.
- **kaggle-google-asl** — derived from Google's Kaggle ASL Signs dataset. Prototype-safe under competition terms; verify before commercial ship.
- **wlasl-derived** — derived from WLASL pose files. **Prototype only.** Must be replaced before commercial launch.

## Current entries

All 57 entries are `hand-authored` and `commercial_safe: true`. See
`gloss_dictionary.json` directly for the full list (26 letters + 31 words).
15 entries (NICE, HAPPY, WANT, EAT, LIKE, FRIEND, WATER, MOTHER, FATHER,
SAD, TIRED, HUNGRY, AGAIN, FINE, DEAF) are flagged in their own `notes`
field as **best-effort approximations, not verified by an ASL signer** —
authored by reasoning about the handshape/motion from written descriptions,
not from real motion capture or a fluent signer's review. Licensing is
clean (we wrote the rotation values ourselves), but linguistic accuracy
should be checked by a native/fluent ASL signer before relying on them
for real communication.

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
