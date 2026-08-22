# Retargeting

> Status: the current build uses a simplified in-tree retargeter (curl
> degrees → bone quaternions at compile time). The full MediaPipe-to-bone
> retargeter lives in Phase 2 and is documented here for the design record.

## What retargeting means

Given motion data from ANY source (a MediaPipe landmark stream, a WLASL
JSON file, a hand-authored curl set), produce bone rotations for OUR rig
in a way that:

- Preserves the geometric meaning of the sign (finger curl, wrist orientation).
- Works across avatars of different bone lengths and rest poses.
- Is stable when the source data is noisy.

## Angle-based, not position-based

Never blit landmark XYZ positions onto bones — that only works for one
specific body size. Instead:

1. Compute the **angle** between adjacent joints in the source (shoulder →
   elbow → wrist gives an elbow angle; wrist → MCP → PIP gives an MCP
   angle).
2. Set the corresponding bone's quaternion to reproduce that angle.
3. The avatar's bone LENGTH is irrelevant — only its rest orientation matters.

## Bone-name map

A JSON map of `{sourceJointA, sourceJointB, sourceJointC} → targetBoneName`.
Lives in `src/signs/retarget.map.json` (planned). Editable by anyone with
Blender knowledge, no code changes needed.

## Quaternions, not Euler

Every rotation stored and interpolated as `[x, y, z, w]`. Euler is used
only in authored JSON for human readability (degrees), then converted at
compile time. Never Euler at runtime — gimbal lock will bite you the
one time it counts.

## Interpolation

`THREE.Quaternion.slerp` between adjacent frames. Linear for positions.
The player currently does this per-frame in `useFrame`.

## Cross-fade between signs (planned)

When queueing sign N+1, blend the last 25% of N with the first 25% of N+1.
This gives natural co-articulation. Some sign pairs lose meaning when
blended — flag them with `noBlendAfter` or `noBlendBefore` in the
dictionary entry. The player must respect these flags and hold rest pose
between the two signs instead.

## Finger noise handling

MediaPipe hand landmarks are noisy in ~10% of frames. Two mitigations:

1. **Snap to canonical handshapes.** Maintain a set of ~20 canonical
   handshape targets (A-Z + variants). Snap noisy MediaPipe curls to the
   nearest canonical shape by minimum L2 distance in curl-degree space.
2. **Low-pass filter** across ~3 adjacent frames before snapping.

## Reference implementations

We READ these to steal the math. We do not fork.

- `bandinopla/three-mediapipe-rig` (MIT) — angle-based binding of
  MediaPipe landmarks to a Three.js rig.
- `upf-gti/retargeting-threejs` — quaternion retargeting solver with
  correspondence.
