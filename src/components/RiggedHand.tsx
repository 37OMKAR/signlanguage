import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import type { SignFrame, Vec3 } from "../types";

interface Props {
  frames: SignFrame[];
  speed: number;
  reducedMotion: boolean;
  side: "R" | "L";
}

// Canonical bone name -> Elena FF rig bone name.
// R hand is the model as-shipped. L is the same model mirrored via scale.x=-1
// so the same bone map still applies.
const BONE_MAP: Record<string, string> = {
  palm:    "hand.R_02",
  thumb0:  "thumb_01.R_08",
  thumb1:  "thumb_02.R_09",
  index0:  "index_01.R_017",
  index1:  "index_02.R_018",
  index2:  "index_03.R_019",
  middle0: "middle_01.R_025",
  middle1: "middle_02.R_026",
  middle2: "middle_03.R_027",
  ring0:   "ring_01.R_033",
  ring1:   "ring_02.R_034",
  ring2:   "ring_03.R_035",
  pinky0:  "pinky_01.R_041",
  pinky1:  "pinky_02.R_042",
  pinky2:  "pinky_03.R_043",
};

const MODEL_URL = "/rigged-hand/scene.gltf";

// Preload so the first sign doesn't stutter.
useGLTF.preload(MODEL_URL);

export function RiggedHand({ frames, speed, reducedMotion, side }: Props) {
  const { scene } = useGLTF(MODEL_URL);
  const cloned = useMemo(() => {
    // Fresh clone per instance so L/R can coexist without sharing state.
    const c = scene.clone(true);
    return c;
  }, [scene]);

  // Index the bones we care about, once.
  const bones = useRef<Record<string, THREE.Object3D>>({});
  const rest = useRef<Record<string, { q: THREE.Quaternion; p: THREE.Vector3 }>>({});
  useEffect(() => {
    bones.current = {};
    rest.current = {};
    cloned.traverse((obj) => {
      // check each map entry
      for (const [canonical, rigName] of Object.entries(BONE_MAP)) {
        if (obj.name === rigName) {
          bones.current[canonical] = obj;
          rest.current[canonical] = {
            q: obj.quaternion.clone(),
            p: obj.position.clone(),
          };
        }
      }
    });
  }, [cloned]);

  const start = useRef<number | null>(null);
  useMemo(() => {
    start.current = null;
  }, [frames]);

  useFrame(({ clock }) => {
    if (!frames || frames.length === 0) {
      // Ease back to rest.
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
      const key = `${side}_${canonical}`;
      const qa = a.bones[key] ?? a.bones[canonical];
      if (!qa) continue;
      const qb = (b?.bones[key] ?? b?.bones[canonical]) ?? qa;
      obj.quaternion.copy(new THREE.Quaternion(qa[0], qa[1], qa[2], qa[3]))
        .slerp(new THREE.Quaternion(qb[0], qb[1], qb[2], qb[3]),
          THREE.MathUtils.clamp(t, 0, 1));
    }
    // Palm position offset if provided.
    const palmKey = `${side}_palm`;
    const palm = bones.current.palm;
    if (palm && a.positions?.[palmKey]) {
      const pa = a.positions[palmKey] as Vec3;
      const pb = (b?.positions?.[palmKey] as Vec3 | undefined) ?? pa;
      const restP = rest.current.palm?.p;
      if (restP) {
        palm.position.set(
          restP.x + THREE.MathUtils.lerp(pa[0], pb[0], t),
          restP.y + THREE.MathUtils.lerp(pa[1], pb[1], t),
          restP.z + THREE.MathUtils.lerp(pa[2], pb[2], t),
        );
      }
    }
  });

  // Position + mirror. Model rest bounding box roughly y in [0.09, 1.57].
  // We shift it down so the wrist ends up around y=1.1 in world coords, and
  // scale-flip for L.
  const groupProps = side === "R"
    ? { position: [0.15, 0.4, 0.2] as Vec3, scale: [1, 1, 1] as Vec3 }
    : { position: [-0.15, 0.4, 0.2] as Vec3, scale: [-1, 1, 1] as Vec3 };

  return <primitive object={cloned} {...groupProps} />;
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

