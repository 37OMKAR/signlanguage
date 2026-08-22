import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { clone as cloneSkeletal } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { SignFrame, SentenceMood } from "../types";

interface Props {
  frames: SignFrame[];
  speed: number;
  reducedMotion: boolean;
  mood: SentenceMood;
  armReach: number;
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

  // Face — no morph targets on this mesh (checked at runtime: none exist),
  // so expressions are bone-driven. Lip_L.003 / Lip_R.003 are the mouth
  // corner controls in this rig.
  jaw:    re(`Jaw`),
  lipCornerL: re(`Lip_L${D}003`),
  lipCornerR: re(`Lip_R${D}003`),

  // Eyebrow root (innermost segment, .001) of each brow chain — enough to
  // raise (yes/no questions) or furrow (wh-questions) the whole brow.
  eyebrowL: re(`Eyebrow_L${D}001`),
  eyebrowR: re(`Eyebrow_R${D}001`),

  // Neck — drives the head-shake for negation, layered on top of the
  // existing idle head sway.
  neck1: re(`Neck_1`),

  // Arms — needed so a sign can lift the hand to chest/face height instead
  // of only rotating the wrist while the arm hangs at the hip.
  R_armUp: re(`Arm_Upper_1R`),
  R_armLo: re(`Arm_Lower_1R`),
  L_armUp: re(`Arm_Upper_1L`),
  L_armLo: re(`Arm_Lower_1L`),
};

// Eyelids are a 20-bone "sunburst" rig per eye: all 20 share one pivot (the
// eye center) and each has a different REST rotation so its tip reaches a
// different point on the eyelid rim — there is no single "upper lid" bone.
// `Eyelid_Control_Upper.L/R` (tried first) turned out to be pure IK-style
// control bones with ZERO vertex weight — rotating them had no visual
// effect at all, which is why the blink was invisible. These Eyelid_L{n}/
// Eyelid_R{n} bones are the real deforming bones (confirmed: each carries
// real skin weight). Closing the eye = rotating all 20 spokes per eye by
// the same delta (verified visually: this genuinely closes the eye).
const EYELID_SPOKE_COUNT = 20;
for (let i = 0; i < EYELID_SPOKE_COUNT; i++) {
  BONE_PATTERNS[`eyelidL${i}`] = re(`Eyelid_L${D}${i}`);
  BONE_PATTERNS[`eyelidR${i}`] = re(`Eyelid_R${D}${i}`);
}
const EYELID_BONE_NAMES: string[] = [];
for (let i = 0; i < EYELID_SPOKE_COUNT; i++) {
  EYELID_BONE_NAMES.push(`eyelidL${i}`, `eyelidR${i}`);
}

// Bones in IDLE_ONLY never receive sign-frame data; they only get the
// continuous idle sway/smile/grammar-expression treatment. Keeps her from
// looking like a mannequin between (and during) signs.
const IDLE_ONLY = new Set([
  "spine1", "spine2", "head", "jaw", "lipCornerL", "lipCornerR",
  "eyebrowL", "eyebrowR", "neck1",
  ...EYELID_BONE_NAMES,
]);

// Arm bones get a generic "lift to signing height" pose whenever the CURRENT
// sign actually uses that side's hand, layered underneath the sign's own
// wrist/finger rotations. This keeps every sign's authored data focused on
// hand shape only, and keeps the idle arm down when a sign is one-handed.
const ARM_BONES = ["R_armUp", "R_armLo", "L_armUp", "L_armLo"] as const;
const DEG = Math.PI / 180;
// Empirically tuned (via live screenshot iteration) so the hand comes up to
// roughly chest height on ITS OWN side, elbow bent, without crossing to the
// opposite shoulder.
const ARM_LIFT: Record<(typeof ARM_BONES)[number], { axis: THREE.Vector3; deg: number }[]> = {
  R_armUp: [
    { axis: new THREE.Vector3(0, 0, 1), deg: 20 },
    { axis: new THREE.Vector3(1, 0, 0), deg: 85 },
  ],
  R_armLo: [{ axis: new THREE.Vector3(1, 0, 0), deg: -50 }],
  L_armUp: [
    { axis: new THREE.Vector3(0, 0, 1), deg: -20 },
    { axis: new THREE.Vector3(1, 0, 0), deg: 85 },
  ],
  L_armLo: [{ axis: new THREE.Vector3(1, 0, 0), deg: -50 }],
};

export function Godette({ frames, speed, reducedMotion, mood, armReach }: Props) {
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
  const _target = useMemo(() => new THREE.Quaternion(), []);

  const _idleDelta = useMemo(() => new THREE.Quaternion(), []);
  const _armDelta = useMemo(() => new THREE.Quaternion(), []);
  const _armStep = useMemo(() => new THREE.Quaternion(), []);
  // Raw LINEAR ramp progress (0 = at rest, 1 = fully lifted). Smoothstepped
  // before use so the visible motion eases in/out instead of snapping.
  const liftAmount = useRef({ R: 0, L: 0 });

  // Which hand(s) the current sign actually drives — scanned once per
  // `frames` change so a one-handed sign (HELLO) doesn't also lift the
  // idle arm.
  const handUsage = useMemo(() => {
    let right = false;
    let left = false;
    for (const f of frames ?? []) {
      for (const key of Object.keys(f.bones)) {
        if (key.startsWith("R_")) right = true;
        if (key.startsWith("L_")) left = true;
      }
    }
    return { right, left };
  }, [frames]);

  // Apply a small continuous sway plus a gentle idle smile so she never
  // looks like a stone statue, even mid-sign. Each idle bone gets its own
  // phase/axis/amplitude so the motion reads as organic, not mechanical.
  // `leanAmount` (0..1, eased elsewhere) adds a slight forward torso
  // engagement while actively signing, on top of the sway — real
  // interpreters lean in and involve the whole upper body, not just the
  // arm, while a static torso reads as "not using the full body".
  const leanAmount = useRef(0);
  const applyIdle = (t: number, lean: number) => {
    const idleSpec: Record<string, { axis: THREE.Vector3; amp: number; speedHz: number; phase: number }> = {
      spine1: { axis: new THREE.Vector3(1, 0, 0), amp: 0.008, speedHz: 0.22, phase: 0 },
      spine2: { axis: new THREE.Vector3(1, 0, 0), amp: 0.006, speedHz: 0.22, phase: 0.3 },
      head:   { axis: new THREE.Vector3(0, 1, 0), amp: 0.007, speedHz: 0.08, phase: 1.1 },
      // Constant upward lip-corner lift (a smile) plus a tiny breathing-rate
      // wobble so it doesn't read as a frozen rictus. Amplitude raised after
      // confirming live that lipCorner only carries weight on 12 vertices —
      // the original 0.16 rad was mechanically "working" but visually
      // unnoticeable.
      lipCornerL: { axis: new THREE.Vector3(0, 0, 1), amp: 0.18, speedHz: 0.1, phase: 0 },
      lipCornerR: { axis: new THREE.Vector3(0, 0, -1), amp: 0.18, speedHz: 0.1, phase: 0.5 },
    };
    // Small constant forward lean, split across both spine joints, active
    // only while signing (eased by the caller). Kept deliberately modest —
    // this is "engaged posture", not a bow.
    const LEAN_DEG = { spine1: 6, spine2: 4 };
    const skipDynamic = new Set([
      "eyebrowL", "eyebrowR", "neck1", ...EYELID_BONE_NAMES,
    ]);
    for (const name of IDLE_ONLY) {
      if (skipDynamic.has(name)) continue; // handled by applyBlink / applyMood
      const obj = bones.current[name];
      const r = rest.current[name];
      const spec = idleSpec[name];
      if (!obj || !r || !spec) continue;
      const isSmile = name.startsWith("lipCorner");
      const leanDeg = (LEAN_DEG as Record<string, number>)[name] ?? 0;
      const leanRad = leanDeg * DEG * lean;
      // Smile bones hold a constant lift (the smile) plus a small slow
      // wobble; everything else is pure sine sway around zero, plus the
      // forward lean for spine bones while signing.
      const angle = isSmile
        ? spec.amp + Math.sin(t * spec.speedHz * Math.PI * 2 + spec.phase) * (spec.amp * 0.15)
        : leanRad + Math.sin(t * spec.speedHz * Math.PI * 2 + spec.phase) * spec.amp;
      _idleDelta.setFromAxisAngle(spec.axis, angle);
      obj.quaternion.copy(r.q).multiply(_idleDelta);
    }
  };

  // Periodic eye blink. `Eyelid_Control_Upper.L/R` (the obvious bone names
  // to reach for) turned out to be pure IK-style control bones with ZERO
  // vertex weight — confirmed by walking the mesh's skinIndex/skinWeight
  // attributes — so rotating them was mechanically "working" but had no
  // visual effect whatsoever. The real deforming rig is 20 "spoke" bones
  // per eye (Eyelid_L0..19 / Eyelid_R0..19) all sharing one pivot at the
  // eye center; rotating the whole set by the same delta closes the eye
  // (verified live via render diff before wiring this up). Blinks happen
  // every ~4s and last ~180ms, using a fast in/out triangle pulse so it
  // reads as a snap blink, not a slow droop.
  const BLINK_PERIOD = 4.0;
  const BLINK_DURATION = 0.18;
  const applyBlink = (t: number) => {
    const forced = (window as unknown as { __forceBlinkAmount?: number }).__forceBlinkAmount;
    let closeAmount;
    if (typeof forced === "number") {
      closeAmount = forced;
    } else {
      const cyclePos = t % BLINK_PERIOD;
      closeAmount = 0;
      if (cyclePos < BLINK_DURATION) {
        const half = BLINK_DURATION / 2;
        closeAmount = cyclePos < half ? cyclePos / half : 1 - (cyclePos - half) / half;
      }
    }
    const angle = closeAmount * 0.5; // radians — verified live: fully closes the eye
    for (const name of EYELID_BONE_NAMES) {
      const obj = bones.current[name];
      const r = rest.current[name];
      if (!obj || !r) continue;
      _idleDelta.setFromAxisAngle(new THREE.Vector3(1, 0, 0), angle);
      obj.quaternion.copy(r.q).multiply(_idleDelta);
    }
  };

  // ASL grammar markers on the face/head, held for the whole sentence
  // (driven by `mood`, computed once per translation — see nlp/mood.ts):
  //   - yes/no question -> eyebrows RAISE
  //   - wh-question ("what", "where", ...) -> eyebrows FURROW
  //   - negation ("no") -> head shake, layered on top of idle head sway
  // Eased in/out so a mood never snaps abruptly onto the face.
  const eyebrowAmount = useRef(0); // -1 furrowed .. 0 neutral .. +1 raised
  const applyMood = (t: number, mood: SentenceMood, signing: boolean) => {
    const forced = (window as unknown as { __forceEyebrowAmount?: number }).__forceEyebrowAmount;
    const target = typeof forced === "number"
      ? forced
      : !signing
        ? 0
        : mood.whQuestion
          ? -1
          : mood.yesNoQuestion
            ? 1
            : 0;
    eyebrowAmount.current = THREE.MathUtils.lerp(
      eyebrowAmount.current, target, typeof forced === "number" ? 0.5 : 0.1,
    );

    for (const [name, sign] of [["eyebrowL", 1], ["eyebrowR", -1]] as const) {
      const obj = bones.current[name];
      const r = rest.current[name];
      if (!obj || !r) continue;
      // Raise = rotate outward/up; furrow = rotate inward/down. Mirrored
      // per side via `sign` so both brows move symmetrically.
      const angle = eyebrowAmount.current * 1.1 * sign;
      _idleDelta.setFromAxisAngle(new THREE.Vector3(0, 0, 1), angle);
      obj.quaternion.copy(r.q).multiply(_idleDelta);
    }

    const neck = bones.current.neck1;
    const neckRest = rest.current.neck1;
    if (neck && neckRest) {
      // A real human "no" head-shake is slow and smooth — roughly 2 turns
      // per second at a modest amplitude, not a rapid twitch. The previous
      // 6Hz / 0.12 rad version oscillated 6 times a second with a hard
      // instant snap each frame, which reads as jitter, not a head shake.
      const shakeActive = signing && mood.negation;
      const shakeAngle = shakeActive ? Math.sin(t * 1.6 * Math.PI * 2) * 0.05 : 0;
      _idleDelta.setFromAxisAngle(new THREE.Vector3(0, 1, 0), shakeAngle);
      neck.quaternion.slerp(neckRest.q.clone().multiply(_idleDelta), 0.25);
    }
  };

  // Blend each arm toward the "ready to sign" lift pose (amount 0..1),
  // applied underneath whatever the current sign's own bone data does. Only
  // the side(s) the sign actually uses lift; the idle arm stays down.
  //
  // `amount` here is already a SMOOTHSTEPPED progress value (see useFrame
  // below), not a raw exponential-lerp value. That distinction is what
  // makes the raise/lower read as a natural human reach instead of a
  // forceful yank: a plain per-frame lerp toward a target (what this used
  // to do) has its LARGEST step on the very first frame — the arm jumps a
  // big fraction of the way instantly, then decelerates. A real human
  // reach eases in AND out (slow-fast-slow), which is what smoothstep
  // gives us once the raw progress is a simple linear ramp over time.
  const applyArmLift = (amountR: number, amountL: number) => {
    for (const name of ARM_BONES) {
      const obj = bones.current[name];
      const r = rest.current[name];
      const steps = ARM_LIFT[name];
      if (!obj || !r) continue;
      const amount = name.startsWith("R_") ? amountR : amountL;
      _armDelta.identity();
      for (const step of steps) {
        _armStep.setFromAxisAngle(step.axis, step.deg * DEG * amount);
        _armDelta.multiply(_armStep);
      }
      obj.quaternion.copy(r.q).multiply(_armDelta);
    }
  };

  // Smoothstep: 0..1 in, 0..1 out, with zero velocity at both ends —
  // the standard "ease in, ease out" curve. Applied to a raw linear-ramp
  // progress value so a transition takes a fixed, predictable duration
  // (unlike an exponential lerp, whose "reach 95% there" time depends on
  // the alpha in a way that's easy to misjudge) while still looking
  // organic instead of robotic/linear.
  const smoothstep = (x: number) => {
    const c = THREE.MathUtils.clamp(x, 0, 1);
    return c * c * (3 - 2 * c);
  };

  // Linear ramp toward `target` at a fixed rate (units of `amount` per
  // second), so a full 0->1 transition always takes the same wall-clock
  // time regardless of frame rate. Smoothstepped by the caller before use.
  const LIFT_RAMP_PER_SEC = 1 / 0.4; // ~0.4s to fully raise or lower
  const rampToward = (current: number, target: number, ratePerSec: number, delta: number) => {
    const maxStep = ratePerSec * delta;
    const diff = target - current;
    if (Math.abs(diff) <= maxStep) return target;
    return current + Math.sign(diff) * maxStep;
  };

  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime;
    const signing = !!frames && frames.length > 0;
    leanAmount.current = rampToward(leanAmount.current, signing ? 1 : 0, 1 / 0.6, delta);
    applyIdle(t, smoothstep(leanAmount.current));
    applyBlink(t);
    applyMood(t, mood, signing);
    (window as unknown as { __godetteMood?: unknown }).__godetteMood = {
      mood, signing, eyebrowAmount: eyebrowAmount.current,
    };
    // Ramp each side's raw lift progress linearly, then smoothstep it for
    // the actual applied rotation — ease-in-ease-out, not a forceful yank.
    liftAmount.current.R = rampToward(
      liftAmount.current.R, signing && handUsage.right ? 1 : 0, LIFT_RAMP_PER_SEC, delta,
    );
    liftAmount.current.L = rampToward(
      liftAmount.current.L, signing && handUsage.left ? 1 : 0, LIFT_RAMP_PER_SEC, delta,
    );
    // armReach (0..1, per-sign — see types.ts) scales how far up the
    // generic lift arc the hand travels: full reach for head-height signs
    // (HELLO, FATHER), partial for chin/chest-height signs. Without this
    // multiplier every sign's hand lands at the exact same world position
    // regardless of what it's supposed to touch — measured and confirmed
    // identical to the millimeter before this existed.
    const reachClamped = THREE.MathUtils.clamp(armReach, 0, 1);
    applyArmLift(
      smoothstep(liftAmount.current.R) * reachClamped,
      smoothstep(liftAmount.current.L) * reachClamped,
    );

    if (!signing) {
      for (const [name, obj] of Object.entries(bones.current)) {
        if (IDLE_ONLY.has(name) || (ARM_BONES as readonly string[]).includes(name)) continue;
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

    // Bones ease TOWARD their target every frame (slerp with a fixed alpha)
    // instead of snapping straight to it. This is what actually removes the
    // jerkiness: without it, the moment a new sign starts (or the keyframe
    // pointer jumps to the next authored frame), the bone's orientation
    // teleports in a single frame. With it, motion is continuous even
    // across a sign-to-sign boundary, which reads as natural elbow/wrist
    // follow-through instead of a robotic snap.
    const SMOOTH_ALPHA = reducedMotion ? 0.18 : 0.32;
    for (const [canonical, obj] of Object.entries(bones.current)) {
      if (IDLE_ONLY.has(canonical) || (ARM_BONES as readonly string[]).includes(canonical)) continue;
      const qa = a.bones[canonical];
      if (!qa) {
        // No data for this bone in this frame — ease toward rest.
        const r = rest.current[canonical];
        if (r) obj.quaternion.slerp(r.q, SMOOTH_ALPHA);
        continue;
      }
      const qb = b?.bones[canonical] ?? qa;
      _qa.set(qa[0], qa[1], qa[2], qa[3]);
      _qb.set(qb[0], qb[1], qb[2], qb[3]);
      _qa.slerp(_qb, THREE.MathUtils.clamp(pairT, 0, 1));
      // Apply on top of rest orientation so the model's rest pose is respected.
      const r = rest.current[canonical];
      if (r) {
        _target.copy(r.q).multiply(_qa);
      } else {
        _target.copy(_qa);
      }
      obj.quaternion.slerp(_target, SMOOTH_ALPHA);
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
