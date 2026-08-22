# Retargeting

> Status: **implemented and validated** for finger curls as of
> `scripts/data-prep/retarget_include.py`. Converts real MediaPipe hand
> landmarks (from the AI4Bharat INCLUDE dataset, repackaged on Kaggle) into
> our curl-degree format via the angle-based method below. Currently used
> for one sign (HELLO's finger curls) as a proof of concept — see
> `data/LICENSE-DATA.md` for provenance and the commercial-safety caveat.
> Wrist orientation/position retargeting is not yet implemented; signs
> still use hand-authored `R_palm_deg`/`R_palm_pos` for that part.

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

Confirmed empirically, not just theoretically: retargeting the same sign
(HELLO) from 3 independent INCLUDE takes produced consistent curl values
at most sampled frames, but individual frames occasionally showed one
finger spike to 60-120deg with no support from neighboring frames —
motion blur or brief self-occlusion mid-gesture, not real motion. A
5-frame median filter (`median_smooth_curl` in `retarget_include.py`)
removes isolated single-frame spikes cleanly. It does NOT fix a take
where tracking fails across several consecutive frames (seen once, in
take MVI_0029) — that requires picking a different, cleaner take rather
than trusting the filter to save bad source data. Always cross-check 2-3
takes of the same sign before trusting any one of them.

Planned, not yet needed at this scale (one sign):
1. **Snap to canonical handshapes.** Maintain a set of ~20 canonical
   handshape targets (A-Z + variants). Snap noisy MediaPipe curls to the
   nearest canonical shape by minimum L2 distance in curl-degree space.

## Reference implementations

We READ these to steal the math. We do not fork.

- `bandinopla/three-mediapipe-rig` (MIT) — angle-based binding of
  MediaPipe landmarks to a Three.js rig.
- `upf-gti/retargeting-threejs` — quaternion retargeting solver with
  correspondence.
