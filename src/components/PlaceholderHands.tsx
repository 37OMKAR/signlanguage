import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { Quat, SignFrame, Vec3 } from "../types";

interface Props {
  frames: SignFrame[];
  speed: number;
  reducedMotion: boolean;
}

// Anatomical-ish rig: for each finger, three chained groups (or two for
// thumb). Each group's quaternion is driven by the frame data. Finger
// segments are rendered as small cylinders under each group.
// Bone naming convention: R_thumb0, R_thumb1, R_index0..2, R_middle0..2,
// R_ring0..2, R_pinky0..2 (and L_ mirror).

interface FingerLayout {
  name: "thumb" | "index" | "middle" | "ring" | "pinky";
  x: number;        // lateral position on palm (in palm-local coords)
  z: number;        // depth position on palm (thumb sticks forward)
  segments: number; // 2 for thumb, 3 for others
  segLen: number;   // length of each segment (m)
  radius: number;
  rootRotDeg?: [number, number, number]; // baseline rest rotation
}

const RIGHT_LAYOUT: FingerLayout[] = [
  { name: "thumb",  x: -0.075, z: 0.03, segments: 2, segLen: 0.038, radius: 0.014, rootRotDeg: [0, 0, -60] },
  { name: "index",  x: -0.048, z: 0.09, segments: 3, segLen: 0.035, radius: 0.012 },
  { name: "middle", x: -0.016, z: 0.095, segments: 3, segLen: 0.038, radius: 0.012 },
  { name: "ring",   x:  0.016, z: 0.09, segments: 3, segLen: 0.034, radius: 0.011 },
  { name: "pinky",  x:  0.048, z: 0.085, segments: 3, segLen: 0.028, radius: 0.010 },
];

// Right and left share a layout, mirrored across x.
const LEFT_LAYOUT: FingerLayout[] = RIGHT_LAYOUT.map((f) => ({
  ...f,
  x: -f.x,
  rootRotDeg: f.rootRotDeg
    ? [f.rootRotDeg[0], -f.rootRotDeg[1], -f.rootRotDeg[2]]
    : undefined,
}));

const SKIN = "#e2b48a";

export function PlaceholderHands({ frames, speed, reducedMotion }: Props) {
  const rightRoot = useRef<THREE.Group>(null);
  const leftRoot = useRef<THREE.Group>(null);
  // Registry of every bone we can drive, keyed by canonical bone name.
  const bones = useRef<Map<string, THREE.Object3D>>(new Map());
  const startTime = useRef<number | null>(null);

  // Reset playback clock when frames change.
  useMemo(() => {
    startTime.current = null;
  }, [frames]);

  useFrame(({ clock }) => {
    if (!frames || frames.length === 0) return;
    if (startTime.current === null) startTime.current = clock.elapsedTime;
    const rate = reducedMotion ? 1 / 1.5 : Math.max(speed, 0.1);
    const elapsedMs = (clock.elapsedTime - startTime.current) * 1000 * rate;

    const [a, b, t] = pickPair(frames, elapsedMs);
    if (!a) return;

    // Interpolate every bone that appears in either frame.
    const seen = new Set<string>();
    for (const [name, qa] of Object.entries(a.bones)) {
      const qb = b?.bones[name] ?? qa;
      applyLerpQuat(bones.current.get(name), qa, qb, t);
      seen.add(name);
    }
    if (b) {
      for (const [name, qb] of Object.entries(b.bones)) {
        if (seen.has(name)) continue;
        applyLerpQuat(bones.current.get(name), qb, qb, 1);
      }
    }
    // Apply palm positions if provided.
    if (a.positions) {
      for (const [name, pos] of Object.entries(a.positions)) {
        const bp = b?.positions?.[name] ?? pos;
        applyLerpPos(bones.current.get(name), pos, bp, t);
      }
    }
  });

  const registerBone = (name: string) => (el: THREE.Object3D | null) => {
    if (el) bones.current.set(name, el);
    else bones.current.delete(name);
  };

  return (
    <group>
      <Hand
        side="R"
        rootRef={rightRoot}
        layout={RIGHT_LAYOUT}
        position={[0.32, 1.15, 0.35]}
        rootBoneName="R_palm"
        register={registerBone}
      />
      <Hand
        side="L"
        rootRef={leftRoot}
        layout={LEFT_LAYOUT}
        position={[-0.32, 1.15, 0.35]}
        rootBoneName="L_palm"
        register={registerBone}
      />
    </group>
  );
}

function Hand({
  side, rootRef, layout, position, rootBoneName, register,
}: {
  side: "L" | "R";
  rootRef: React.RefObject<THREE.Group>;
  layout: FingerLayout[];
  position: [number, number, number];
  rootBoneName: string;
  register: (name: string) => (el: THREE.Object3D | null) => void;
}) {
  return (
    <group
      ref={(el) => {
        (rootRef as React.MutableRefObject<THREE.Group | null>).current = el;
        register(rootBoneName)(el);
      }}
      position={position}
    >
      {/* Palm */}
      <mesh castShadow>
        <boxGeometry args={[0.14, 0.18, 0.035]} />
        <meshStandardMaterial color={SKIN} roughness={0.7} />
      </mesh>
      {/* Fingers */}
      {layout.map((f) => (
        <FingerChain
          key={f.name}
          finger={f}
          side={side}
          register={register}
        />
      ))}
    </group>
  );
}

function FingerChain({
  finger, side, register,
}: {
  finger: FingerLayout;
  side: "L" | "R";
  register: (name: string) => (el: THREE.Object3D | null) => void;
}) {
  // Build a nested chain of {segments} groups. Each group's rotation is a
  // "bone" (e.g. R_index0, R_index1, R_index2), whose child is the segment
  // cylinder followed by the next joint's group offset by segLen.
  const rootPos: Vec3 = [finger.x, 0.093, finger.z - 0.06];
  const rootRot = finger.rootRotDeg ?? [0, 0, 0];

  return (
    <group position={rootPos} rotation={degRad(rootRot)}>
      {renderSegment(finger, 0, side, register)}
    </group>
  );
}

function renderSegment(
  f: FingerLayout,
  index: number,
  side: "L" | "R",
  register: (name: string) => (el: THREE.Object3D | null) => void,
): JSX.Element | null {
  if (index >= f.segments) return null;
  const boneName = `${side}_${f.name}${index}`;
  const segLen = f.segLen * (index === 0 ? 1 : 0.85 ** index);
  const radius = f.radius * (0.95 ** index);
  return (
    <group ref={register(boneName)}>
      <mesh position={[0, segLen / 2, 0]} castShadow>
        <cylinderGeometry args={[radius * 0.9, radius, segLen, 10]} />
        <meshStandardMaterial color={SKIN} roughness={0.75} />
      </mesh>
      {/* Next joint sits at the tip of this segment */}
      <group position={[0, segLen, 0]}>
        {renderSegment(f, index + 1, side, register)}
      </group>
    </group>
  );
}

// ---- Math helpers ----

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

const _qa = new THREE.Quaternion();
const _qb = new THREE.Quaternion();
function applyLerpQuat(
  obj: THREE.Object3D | undefined,
  a: Quat,
  b: Quat,
  t: number,
) {
  if (!obj) return;
  _qa.set(a[0], a[1], a[2], a[3]);
  _qb.set(b[0], b[1], b[2], b[3]);
  obj.quaternion.copy(_qa).slerp(_qb, THREE.MathUtils.clamp(t, 0, 1));
}

function applyLerpPos(
  obj: THREE.Object3D | undefined,
  a: Vec3,
  b: Vec3,
  t: number,
) {
  if (!obj) return;
  obj.position.set(
    THREE.MathUtils.lerp(a[0], b[0], t),
    THREE.MathUtils.lerp(a[1], b[1], t),
    THREE.MathUtils.lerp(a[2], b[2], t),
  );
}

function degRad(d: [number, number, number]): [number, number, number] {
  const k = Math.PI / 180;
  return [d[0] * k, d[1] * k, d[2] * k];
}
