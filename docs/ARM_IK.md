# Arm IK and body anchors

Sign language is about **where** the hands are as much as what shape they
take. Early versions of this project could only rotate the wrist, which meant
every sign landed in exactly the same spot (measured: identical to the
millimetre across eight different signs). Arm IK fixes that.

## Authoring

A frame can name a body anchor for either wrist:

```jsonc
"MOTHER": {
  "frames": [
    { "t_ms": 0,   "R_at": "chin", "curls": { ... } },
    { "t_ms": 500, "R_at": { "at": "chin", "off": [0, 0.01, 0] }, "curls": { ... } }
  ]
}
```

- `R_at` / `L_at` is either an anchor name or `{ "at": name, "off": [x, y, z] }`.
- `off` is in metres, written for the **right** hand. For the left hand the
  x component is mirrored automatically, so a two-handed sign can use the
  same value on both sides.
- An anchor stays in force until a later frame names another one, so you
  only write `R_at` where the hand moves.
- Signs with no `R_at` / `L_at` keep the old generic arm lift
  (`armReach`), so existing data still works.

## Anchors

Defined in [`src/signs/armIK.ts`](../src/signs/armIK.ts) as offsets from the
head bone, in metres. They are **wrist** targets, not contact points: the
hand extends roughly 0.09 m beyond the wrist, so the wrist sits lower than
the spot being touched.

| Name | Where |
|---|---|
| `forehead`, `temple`, `ear` | Upper head |
| `cheek`, `mouth`, `chin` | Lower face |
| `neck` | Throat |
| `chest`, `chestLow` | Torso |
| `space` | Neutral signing space, in front of the shoulder |
| `center` | In front of the sternum, on the midline |
| `forward` | Arm extended toward the viewer |

## Solver

`solveArm()` is a standard two-bone solver:

1. Reset the upper arm and forearm to their rest rotation and read the
   shoulder, elbow and wrist world positions and the two segment lengths.
2. Clamp the target distance to what the arm can reach, so unreachable
   targets stretch toward the point instead of producing NaNs.
3. Place the elbow on the circle of valid positions. A **pole vector**
   (down and out, slightly back) picks the natural one.
4. Rotate the upper arm so the shoulder→elbow direction matches, then the
   forearm so elbow→wrist points at the target. Rotations are shortest-arc
   in world space, which preserves bone roll.
5. Blend from the rest rotation by an ease-in/out weight, so the arm rises
   and lowers smoothly.

At runtime (`src/components/Godette.tsx`) the wrist target is also smoothed
exponentially so moving between two signs glides, and when a sign ends the
arm lowers from its last IK pose rather than snapping to a default.

The rig's bones run along local +Y (down the limb), so no per-rig axis
constants are needed. The solver is covered by `tests/armIK.test.ts`
(reaches the target, preserves segment lengths, clamps, weight 0 = rest,
left/right mirroring).

## Limits and next steps

- Anchor offsets were tuned by eye on one avatar. A signer should review
  them, and a different avatar needs its anchors re-measured.
- Palm orientation is still authored as an offset from the forearm, so some
  signs may need their palm angles revisited now that the forearm points
  somewhere meaningful.
- There is no hand-to-hand contact yet: two-handed signs reach the same
  anchor on both sides rather than touching each other.
- Only 35 signs have anchors so far.
