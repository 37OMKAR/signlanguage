# Sign Data Provenance & Licensing

Every sign in `gloss_dictionary.json` is tracked here so we know before
commercial launch that nothing carries a research-only license.

## Legend
- **hand-authored** — we authored the pose ourselves in code/Blender. MIT, commercial-safe.
- **self-recorded** — we recorded a signer + extracted with MediaPipe. Commercial-safe with signer consent on file.
- **kaggle-google-asl** — derived from Google's Kaggle ASL Signs dataset. Prototype-safe under competition terms; verify before commercial ship.
- **wlasl-derived** — derived from WLASL pose files. **Prototype only.** Must be replaced before commercial launch.

## Current entries

| Gloss   | Provenance     | Commercial? |
|---------|----------------|-------------|
| A       | hand-authored  | ✅ yes      |
| B       | hand-authored  | ✅ yes      |
| HELLO   | hand-authored  | ✅ yes      |

## Rule

No commercial release may include any entry marked `commercial_safe: false`
or with provenance `wlasl-derived`. CI should enforce this before build.
