# Sign Dictionary Data Format

The dictionary is a single JSON file at `data/gloss_dictionary.json`. Keys
are UPPERCASE gloss tokens; values are `AuthoredEntry`.

## Schema

```ts
type AuthoredEntry = {
  gloss: string;                // must match the key
  duration_ms: number;          // total sign duration
  provenance:
    | "hand-authored"
    | "self-recorded"
    | "kaggle-google-asl"
    | "wlasl-derived";
  commercial_safe: boolean;     // false = must not ship in commercial build
  notes?: string;
  handshape_start?: string;
  handshape_end?: string;
  frames: AuthoredFrame[];
};

type AuthoredFrame = {
  t_ms: number;                                    // 0-based, monotonic
  curls?: Partial<Record<FingerName, number[]>>;   // degrees per joint
  R_palm_deg?: [number, number, number];           // Euler XYZ deg
  L_palm_deg?: [number, number, number];
  R_palm_pos?: [number, number, number];           // meters
  L_palm_pos?: [number, number, number];
  blendshapes?: Record<string, number>;            // 0..1 face weights
};

type FingerName =
  | "R_thumb" | "R_index" | "R_middle" | "R_ring" | "R_pinky"
  | "L_thumb" | "L_index" | "L_middle" | "L_ring" | "L_pinky";
```

## Finger curl convention

- `curls.R_index = [MCP, PIP, DIP]` (three values for non-thumbs)
- `curls.R_thumb = [CMC, MCP]` (two values for thumbs)
- Each value is degrees around the local X axis. `0` = straight, `90` =
  fully bent.
- Sign is negated during compile so positive = closing the hand.

## Rules

- `frames` must have at least one entry, and `t_ms` must be monotonically
  non-decreasing.
- The final frame's `t_ms` should equal `duration_ms`.
- Bones not present in a frame inherit from the previous frame (via slerp
  between adjacent frames the player already handles).
- Set only bones you actually want to move — untouched bones sit at rest.

## Provenance rules

- `hand-authored`: safe to ship commercially.
- `self-recorded`: safe when the signer signed consent (log in
  `data/LICENSE-DATA.md`).
- `kaggle-google-asl`: prototype-safe under Kaggle competition terms;
  verify latest terms before commercial ship.
- `wlasl-derived`: **never ship commercially.** Re-record before launch.

CI script `npm run test` runs `auditCommercialSafety()` — any entry that
is not commercial-safe fails the audit.

## Example

```json
"K": {
  "gloss": "K",
  "duration_ms": 450,
  "provenance": "hand-authored",
  "commercial_safe": true,
  "notes": "Index and middle up in a V, thumb between them.",
  "frames": [
    {
      "t_ms": 0,
      "curls": {
        "R_thumb":  [20, 30],
        "R_index":  [0, 0, 0],
        "R_middle": [0, 20, 30],
        "R_ring":   [85, 90, 70],
        "R_pinky":  [85, 90, 70]
      }
    },
    { "t_ms": 450, "curls": { ... } }
  ]
}
```
