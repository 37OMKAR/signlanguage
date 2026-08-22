import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import type { SignFrame, Vec3 } from "../types";

interface Props {
  frames: SignFrame[];
  speed: number;
  reducedMotion: boolean;
}

const MODEL_URL = "/godette/godette.glb";
useGLTF.preload(MODEL_URL);

// Godette bone naming decoded from her glTF hierarchy:
//   Finger_1 = index, Finger_2 = middle, Finger_3 = ring, Finger_4 = pinky
//   Bones look like "Thumb.R_178", "Finger_1.R.001_164", etc. — a base name
//   plus a trailing "_<id>". We match by regex, ignoring the id suffix.
//
// Canonical key (used in our SignFrame data) -> regex matching Godette bone name.
const BONE_PATTERNS: Record<string, RegExp> = {
  // palms
  R_palm:    /^Hand\.R(_\d+)?$/,
  L_palm:    /^Hand\.L(_\d+)?$/,

  // thumbs (2 segments authored, model has 3 — use base + tip)
  R_thumb0:  /^Thumb\.R(_\d+)?$/,
  R_thumb1:  /^Thumb\.R\.001(_\d+)?$/,
  L_thumb0:  /^Thumb\.L(_\d+)?$/,
  L_thumb1:  /^Thumb\.L\.001(_\d+)?$/,

  // index = Finger_1
  R_index0:  /^Finger_1\.R(_\d+)?$/,
  R_index1:  /^Finger_1\.R\.001(_\d+)?$/,
  R_index2:  /^Finger_1\.R\.002(_\d+)?$/,
  L_index0:  /^Finger_1\.L(_\d+)?$/,
  L_index1:  /^Finger_1\.L\.001(_\d+)?$/,
  L_index2:  /^Finger_1\.L\.002(_\d+)?$/,

  // middle = Finger_2
  R_middle0: /^Finger_2\.R(_\d+)?$/,
  R_middle1: /^Finger_2\.R\.001(_\d+)?$/,
  R_middle2: /^Finger_2\.R\.002(_\d+)?$/,
  L_middle0: /^Finger_2\.L(_\d+)?$/,
  L_middle1: /^Finger_2\.L\.001(_\d+)?$/,
  L_middle2: /^Finger_2\.L\.002(_\d+)?$/,

  // ring = Finger_3
  R_ring0:   /^Finger_3\.R(_\d+)?$/,
  R_ring1:   /^Finger_3\.R\.001(_\d+)?$/,
  R_ring2:   /^Finger_3\.R\.002(_\d+)?$/,
  L_ring0:   /^Finger_3\.L(_\d+)?$/,
  L_ring1:   /^Finger_3\.L\.001(_\d+)?$/,
  L_ring2:   /^Finger_3\.L\.002(_\d+)?$/,

  // pinky = Finger_4
  R_pinky0:  /^Finger_4\.R(_\d+)?$/,
  R_pinky1:  /^Finger_4\.R\.001(_\d+)?$/,
  R_pinky2:  /^Finger_4\.R\.002(_\d+)?$/,
  L_pinky0:  /^Finger_4\.L(_\d+)?$/,
  L_pinky1:  /^Finger_4\.L\.001(_\d+)?$/,
  L_pinky2:  /^Finger_4\.L\.002(_\d+)?$/,
};

export function Godette({ frames, speed, reducedMotion }: Props) {
  const { scene } = useGLTF(MODEL_URL);
  const cloned = useMemo(() => scene.clone(true), [scene]);

  const bones = useRef<Record<string, THREE.Object3D>>({});
  const rest = useRef<Record<string, { q: THREE.Quaternion; p: THREE.Vector3 }>>({});

  useEffect(() => {
    bones.current = {};
    rest.current = {};
    cloned.traverse((obj) => {
      for (const [canonical, pattern] of Object.entries(BONE_PATTERNS)) {
        if (pattern.test(obj.name)) {
          bones.current[canonical] = obj;
          rest.current[canonical] = {
            q: obj.quaternion.clone(),
            p: obj.position.clone(),
          };
        }
      }
    });
    // eslint-disable-next-line no-console
    console.log(
      "[godette] mapped bones:",
      Object.keys(bones.current).length, "/", Object.keys(BONE_PATTERNS).length,
    );
  }, [cloned]);

  const start = useRef<number | null>(null);
  useMemo(() => { start.current = null; }, [frames]);

  const _qa = useMemo(() => new THREE.Quaternion(), []);
  const _qb = useMemo(() => new THREE.Quaternion(), []);

  useFrame(({ clock }) => {
    if (!frames || frames.length === 0) {
      // Ease to rest.
      for (const [name, obj] of Object.entries(bones.current)) {
        const r = rest.current[name];
        if (!r) continue;
        obj.quaternion.slerp(r.q, 0.15);
        obj.position.lerp(r.p, 0.15);
      }
      return;
    }
    if (start.current === null) start.current = clock.elapsedTime;
    const rate = reducedMotion ? 1 / 1.5 : Math.max(speed, 0.1);
    const elapsedMs = (clock.elapsedTime - start.current) * 1000 * rate;
    const [a, b, t] = pickPair(frames, elapsedMs);
    if (!a) return;

    for (const [canonical, obj] of Object.entries(bones.current)) {
      const qa = a.bones[canonical];
      if (!qa) {
        // No data for this bone in this frame — ease toward rest.
        const r = rest.current[canonical];
        if (r) obj.quaternion.slerp(r.q, 0.1);
        continue;
      }
      const qb = b?.bones[canonical] ?? qa;
      _qa.set(qa[0], qa[1], qa[2], qa[3]);
      _qb.set(qb[0], qb[1], qb[2], qb[3]);
      // Apply on top of rest orientation so the model's rest pose is respected.
      const r = rest.current[canonical];
      if (r) {
        obj.quaternion.copy(r.q).multiply(_qa.clone().slerp(_qb, THREE.MathUtils.clamp(t, 0, 1)));
      } else {
        obj.quaternion.copy(_qa).slerp(_qb, THREE.MathUtils.clamp(t, 0, 1));
      }
    }
    // Palm position offset (relative to rest).
    for (const palmKey of ["R_palm", "L_palm"] as const) {
      const obj = bones.current[palmKey];
      const pa = a.positions?.[palmKey] as Vec3 | undefined;
      if (obj && pa) {
        const pb = (b?.positions?.[palmKey] as Vec3 | undefined) ?? pa;
        const r = rest.current[palmKey];
        if (r) {
          obj.position.set(
            r.p.x + THREE.MathUtils.lerp(pa[0], pb[0], t),
            r.p.y + THREE.MathUtils.lerp(pa[1], pb[1], t),
            r.p.z + THREE.MathUtils.lerp(pa[2], pb[2], t),
          );
        }
      }
    }
  });

  // Godette rest bounding is roughly hip-centred at origin. Push her back so
  // the camera at (0, 1.4, 2.4) frames her upper body. Fine tuning per model.
  return <primitive object={cloned} position={[0, 0, 0]} scale={[1, 1, 1]} />;
}

function pickPair(
  frames: SignFrame[],
  elapsedMs: number,
): [SignFrame | null, SignFrame | null, number] {
  if (frames.length === 0) return [null, null, 0];
  if (elapsedMs <= frames[0].t_ms) return [frames[0], frames[0], 0];
  for (let i = 1; i < frames.length; i++) {
    if (frames[i].t_ms >= elapsedMs) {
      const prev = frames[i - 1];
      const next = frames[i];
      const span = Math.max(1, next.t_ms - prev.t_ms);
      return [prev, next, (elapsedMs - prev.t_ms) / span];
    }
  }
  return [frames[frames.length - 1], frames[frames.length - 1], 1];
}
