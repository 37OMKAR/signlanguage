import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { clone as cloneSkeletal } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { SignFrame } from "../types";

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
// Three.js's GLTFLoader strips the `.` and `_` separators inside a name, so
// `Finger_1.L.001_134` becomes `Finger_1L001_134`. Match the collapsed form.
// The trailing `_<id>` (unique per node) is optional in the pattern.
const D = "[._]?"; // Optional separator that may be present, stripped, or `_`.
const ID = "(_\\d+)?"; // Optional trailing "_123" id.
const re = (s: string) => new RegExp(`^${s}${ID}$`);

const BONE_PATTERNS: Record<string, RegExp> = {
  R_palm:    re(`Hand${D}R`),
  L_palm:    re(`Hand${D}L`),

  R_thumb0:  re(`Thumb${D}R`),
  R_thumb1:  re(`Thumb${D}R${D}001`),
  L_thumb0:  re(`Thumb${D}L`),
  L_thumb1:  re(`Thumb${D}L${D}001`),

  R_index0:  re(`Finger_1${D}R`),
  R_index1:  re(`Finger_1${D}R${D}001`),
  R_index2:  re(`Finger_1${D}R${D}002`),
  L_index0:  re(`Finger_1${D}L`),
  L_index1:  re(`Finger_1${D}L${D}001`),
  L_index2:  re(`Finger_1${D}L${D}002`),

  R_middle0: re(`Finger_2${D}R`),
  R_middle1: re(`Finger_2${D}R${D}001`),
  R_middle2: re(`Finger_2${D}R${D}002`),
  L_middle0: re(`Finger_2${D}L`),
  L_middle1: re(`Finger_2${D}L${D}001`),
  L_middle2: re(`Finger_2${D}L${D}002`),

  R_ring0:   re(`Finger_3${D}R`),
  R_ring1:   re(`Finger_3${D}R${D}001`),
  R_ring2:   re(`Finger_3${D}R${D}002`),
  L_ring0:   re(`Finger_3${D}L`),
  L_ring1:   re(`Finger_3${D}L${D}001`),
  L_ring2:   re(`Finger_3${D}L${D}002`),

  R_pinky0:  re(`Finger_4${D}R`),
  R_pinky1:  re(`Finger_4${D}R${D}001`),
  R_pinky2:  re(`Finger_4${D}R${D}002`),
  L_pinky0:  re(`Finger_4${D}L`),
  L_pinky1:  re(`Finger_4${D}L${D}001`),
  L_pinky2:  re(`Finger_4${D}L${D}002`),

  // Idle-motion bones — driven by a subtle breathing sway, not by sign data.
  spine1: re(`Spine_1`),
  spine2: re(`Spine_2`),
  head:   re(`Head`),
};

// Bones in IDLE_ONLY never receive sign-frame data; they only get the
// continuous idle sway. Keeps her from looking like a mannequin between
// (and during) signs.
const IDLE_ONLY = new Set(["spine1", "spine2", "head"]);

export function Godette({ frames, speed, reducedMotion }: Props) {
  const { scene } = useGLTF(MODEL_URL);
  // IMPORTANT: plain Object3D.clone()/SkinnedMesh.copy() only copies the
  // `skeleton` property BY REFERENCE (see three/src/objects/SkinnedMesh.js:
  // `this.skeleton = source.skeleton;`). It does not rebind the skeleton's
  // bones array to the newly cloned bone hierarchy. That means rotating a
  // bone found by traversing a plain-cloned scene has NO visual effect —
  // the rendered mesh still deforms using the original, untouched skeleton.
  // SkeletonUtils.clone() properly remaps skeleton.bones to the clone.
  const cloned = useMemo(
    () => cloneSkeletal(scene) as THREE.Object3D,
    [scene],
  );

  const bones = useRef<Record<string, THREE.Object3D>>({});
  const rest = useRef<Record<string, { q: THREE.Quaternion; p: THREE.Vector3 }>>({});

  useEffect(() => {
    bones.current = {};
    rest.current = {};
    // Collect every named object so we can diagnose if a pattern misses.
    const seenNames: string[] = [];
    const skinnedBoneNames: string[] = [];
    cloned.traverse((obj) => {
      if ((obj as THREE.SkinnedMesh).isSkinnedMesh) {
        const sm = obj as THREE.SkinnedMesh;
        sm.skeleton?.bones.forEach((b) => skinnedBoneNames.push(b.name));
      }
      if (!obj.name) return;
      const normalized = obj.name.replace(/[._]/g, "_");
      seenNames.push(obj.name);
      for (const [canonical, pattern] of Object.entries(BONE_PATTERNS)) {
        if (pattern.test(obj.name) || pattern.test(normalized)) {
          bones.current[canonical] = obj;
          rest.current[canonical] = {
            q: obj.quaternion.clone(),
            p: obj.position.clone(),
          };
        }
      }
    });
    (window as unknown as { __godette: unknown }).__godette = {
      bones: bones.current,
      rest: rest.current,
      seenNames,
      skinnedBoneNames: Array.from(new Set(skinnedBoneNames)),
      cloned,
    };
    const mapped = Object.keys(bones.current);
    // eslint-disable-next-line no-console
    console.log(
      "[godette] mapped bones:", mapped.length, "/", Object.keys(BONE_PATTERNS).length,
    );
    if (mapped.length < Object.keys(BONE_PATTERNS).length) {
      const missing = Object.keys(BONE_PATTERNS).filter((k) => !mapped.includes(k));
      // eslint-disable-next-line no-console
      console.warn("[godette] missing:", missing);
      // eslint-disable-next-line no-console
      console.log("[godette] sample bone names:",
        seenNames.filter((n) => /finger|thumb|hand/i.test(n)));
    }
  }, [cloned]);

  const start = useRef<number | null>(null);
  useMemo(() => { start.current = null; }, [frames]);

  const _qa = useMemo(() => new THREE.Quaternion(), []);
  const _qb = useMemo(() => new THREE.Quaternion(), []);

  const _idleDelta = useMemo(() => new THREE.Quaternion(), []);

  // Apply a small continuous sway so she never looks like a stone statue,
  // even mid-sign. Each idle bone gets its own phase/axis/amplitude so the
  // motion reads as organic breathing, not a single mechanical oscillation.
  const applyIdle = (t: number) => {
    const idleSpec: Record<string, { axis: THREE.Vector3; amp: number; speedHz: number; phase: number }> = {
      spine1: { axis: new THREE.Vector3(1, 0, 0), amp: 0.02, speedHz: 0.28, phase: 0 },
      spine2: { axis: new THREE.Vector3(1, 0, 0), amp: 0.015, speedHz: 0.28, phase: 0.3 },
      head:   { axis: new THREE.Vector3(0, 1, 0), amp: 0.03, speedHz: 0.12, phase: 1.1 },
    };
    for (const name of IDLE_ONLY) {
      const obj = bones.current[name];
      const r = rest.current[name];
      const spec = idleSpec[name];
      if (!obj || !r || !spec) continue;
      const angle = Math.sin(t * spec.speedHz * Math.PI * 2 + spec.phase) * spec.amp;
      _idleDelta.setFromAxisAngle(spec.axis, angle);
      obj.quaternion.copy(r.q).multiply(_idleDelta);
    }
  };

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    applyIdle(t);

    if (!frames || frames.length === 0) {
      for (const [name, obj] of Object.entries(bones.current)) {
        if (IDLE_ONLY.has(name)) continue;
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
    const [a, b, pairT] = pickPair(frames, elapsedMs);
    if (!a) return;

    for (const [canonical, obj] of Object.entries(bones.current)) {
      if (IDLE_ONLY.has(canonical)) continue;
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
        obj.quaternion.copy(r.q).multiply(_qa.clone().slerp(_qb, THREE.MathUtils.clamp(pairT, 0, 1)));
      } else {
        obj.quaternion.copy(_qa).slerp(_qb, THREE.MathUtils.clamp(pairT, 0, 1));
      }
    }
    // Note: we deliberately do NOT modify bone positions during playback.
    // Skinned meshes bake bone rest positions into inverseBindMatrices; moving
    // a bone at runtime shears the vertices. Only rotations are safe.
  });

  return <primitive object={cloned} position={[0, 0, 0]} />;
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
