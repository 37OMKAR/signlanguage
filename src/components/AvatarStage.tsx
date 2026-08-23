import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { SignFrame, SentenceMood } from "../types";
import { Godette } from "./Godette";
import { Suspense } from "react";

// A soft vertical-gradient "photo studio sweep" backdrop instead of a flat
// color — dark cool grey-blue at the top fading to a lighter warm grey at
// the bottom, the classic portrait-studio look. Built once as a small
// CanvasTexture (no external assets, no shader code needed).
function StudioBackdrop() {
  const { scene } = useThree();
  const texture = useMemo(() => {
    // 2D radial gradient centered slightly above the horizon: cinematic
    // dark-vignette look with a faint warm glow behind where the subject
    // stands, fading to near-black at every corner. This alone makes the
    // subject read as lit-from-a-void rather than pasted-on-a-sheet, and
    // pairs with the RIM lights below to create hero-portrait edges.
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext("2d")!;
    const cx = canvas.width * 0.5;
    const cy = canvas.height * 0.42;    // slightly high -- follows the framing
    const g = ctx.createRadialGradient(cx, cy, 20, cx, cy, canvas.width * 0.85);
    g.addColorStop(0.00, "#2a2233");   // warm-ish center glow behind subject
    g.addColorStop(0.28, "#181828");
    g.addColorStop(0.65, "#0a0b13");
    g.addColorStop(1.00, "#020207");   // near-black corners = vignette
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);

  useEffect(() => {
    scene.background = texture;
    return () => {
      if (scene.background === texture) scene.background = null;
      texture.dispose();
    };
  }, [scene, texture]);

  return null;
}

// A physical cyclorama-style backdrop plane behind the character, so the
// background wash lights below actually have a surface to light. The
// scene.background CanvasTexture alone can't receive light -- it's just
// a raw color painted before geometry -- so without this plane, adding
// "background lights" produces zero visible effect. Curved via a mild
// bend so light rakes across it and creates the classic studio gradient
// halo behind the subject.
function BackdropPlane() {
  return (
    <>
      <mesh position={[0, 1.0, -1.8]} receiveShadow>
        <planeGeometry args={[7, 5, 16, 16]} />
        <meshStandardMaterial
          color="#0f1119"
          roughness={0.95}
          metalness={0}
        />
      </mesh>
      {/* A soft glow disc suspended behind the subject -- gives the
          hero-portrait halo effect the vignette gradient hints at.
          Emissive-only material so no lighting affects it. */}
      <mesh position={[0, 1.35, -1.4]}>
        <circleGeometry args={[0.9, 40]} />
        <meshBasicMaterial color="#3a2e4a" transparent opacity={0.55} />
      </mesh>
    </>
  );
}

// Three-point studio lighting formalized into named lights + backdrop
// washes. Positions and intensities are tuned so:
// - KEY (warm, camera-right, high): the main modeling light. Casts the
//   softest visible shadow. Where the sculpting of the face/hands
//   actually happens.
// - FILL (cool, camera-left, low): fills the shadow side without
//   competing with the key. About 1/3 the key's intensity.
// - RIM/BACK (cool, behind-above): separates hair/shoulder from the
//   backdrop with a bright edge. Slightly stronger than the fill so
//   the silhouette pops.
// - HAIR (narrow spot, from above-behind): sharper highlight along
//   the top of the head/shoulders. Optional -- makes the studio feel
//   deliberate rather than "just three DirLights".
// - Two BACKDROP WASH spots aimed at the physical backdrop plane give
//   the classic soft gradient glow behind the subject.
function StudioLights() {
  return (
    <>
      {/* Ambient sets the shadow floor -- without it, hand shadows go
          almost black at this camera distance. */}
      <ambientLight intensity={0.55} color="#dfe6ff" />

      {/* KEY: main modeling light, warm, camera-right, high. */}
      <directionalLight
        position={[2.4, 2.8, 2.2]}
        intensity={1.9}
        color="#fff2d8"
        castShadow
        shadow-mapSize={new THREE.Vector2(2048, 2048)}
        shadow-camera-near={0.5}
        shadow-camera-far={8}
        shadow-camera-left={-2}
        shadow-camera-right={2}
        shadow-camera-top={3}
        shadow-camera-bottom={-1}
      />

      {/* FILL: soft cool, camera-left, low. */}
      <directionalLight
        position={[-2.6, 1.4, 1.8]}
        intensity={0.65}
        color="#c9d8ff"
      />

      {/* Original centered rim/back kept as a broad silhouette wash. */}
      <directionalLight
        position={[-0.6, 2.6, -2.4]}
        intensity={1.15}
        color="#e6f0ff"
      />

      {/* KICKER RIGHT: strong cool-blue rim from behind-right, aimed
          across the shoulder toward the camera. Its job is a sharp,
          bright edge along the right silhouette -- hair, right arm,
          right side of face -- the "3/4 back light" beloved of
          portrait photographers. High intensity so the edge really
          pops against the dark vignette. */}
      <spotLight
        position={[2.6, 2.0, -1.8]}
        angle={0.55}
        penumbra={0.7}
        intensity={3.2}
        color="#a8c8ff"
        distance={7}
        target-position={[0, 1.30, 0]}
      />

      {/* KICKER LEFT: warm amber counterpart from behind-left. Softer
          than the right kicker so the two rims aren't symmetrical --
          asymmetry is what gives portraits shape. */}
      <spotLight
        position={[-2.6, 1.9, -1.8]}
        angle={0.6}
        penumbra={0.75}
        intensity={2.4}
        color="#ffb87a"
        distance={7}
        target-position={[0, 1.30, 0]}
      />

      {/* HAIR: narrow warm spotlight from directly above-behind for a
          crisp top-of-head highlight (visible in profile orbits). */}
      <spotLight
        position={[0.6, 3.4, -1.0]}
        angle={0.4}
        penumbra={0.55}
        intensity={1.6}
        color="#fff2e0"
        distance={6}
      />

      {/* Two BACKDROP WASH lights aimed at the plane behind the
          subject, one warm (camera-right side) and one cool (camera-
          left side). They rake across the physical backdrop and
          create the classic soft gradient halo. */}
      <spotLight
        position={[2.4, 2.2, -0.6]}
        angle={0.9}
        penumbra={0.9}
        intensity={2.2}
        color="#c98a5a"
        distance={5}
        target-position={[1.0, 1.0, -1.8]}
      />
      <spotLight
        position={[-2.4, 2.2, -0.6]}
        angle={0.9}
        penumbra={0.9}
        intensity={2.2}
        color="#5a90c9"
        distance={5}
        target-position={[-1.0, 1.0, -1.8]}
      />
    </>
  );
}

// Follow the signing action with a smooth-pan camera. Reads the current
// hand + head world positions off window.__godette (populated by Godette.tsx
// on mount) and reframes the OrbitControls target each frame so the active
// hand stays in the shot instead of drifting off the top/side. When the
// hand is high (face-level signs like HELLO), the target biases upward
// and toward the hand's own side; for chest-level signs it biases lower.
// Idle -> returns to the standard mid-upper-body target.
//
// Preserves user orbit angle: we only move `target`, not `position`, so
// the user's manual rotation/zoom via OrbitControls is unaffected.
function SigningCameraTracker() {
  const controls = useThree((s) => s.controls) as
    | (THREE.EventDispatcher & { target: THREE.Vector3; update: () => void })
    | null;
  // Idle target sits on the upper-torso / sternum, not the mid-chest --
  // higher up so face + collar are the visual anchor, and the framing
  // reads as portrait/interview, not full-body wide.
  const idleTarget = useMemo(() => new THREE.Vector3(0, 1.30, 0.10), []);
  // Anticipatory "signing zone" target used the moment mood.signing goes
  // true, BEFORE the arm has actually risen. Lets the camera start its
  // slow pan up during the arm-lift ramp instead of waiting for the hand
  // to reach position -- matches user request "camera must move before".
  const anticipatoryTarget = useMemo(() => new THREE.Vector3(0, 1.40, 0.18), []);
  const desired = useRef(idleTarget.clone());
  const _tmp = useMemo(() => new THREE.Vector3(), []);
  const _handR = useMemo(() => new THREE.Vector3(), []);
  const _handL = useMemo(() => new THREE.Vector3(), []);
  const _head = useMemo(() => new THREE.Vector3(), []);

  useFrame((_, delta) => {
    const g = (window as unknown as { __godette?: {
      bones: Record<string, THREE.Object3D>;
    } }).__godette;
    const mood = (window as unknown as { __godetteMood?: { signing?: boolean } })
      .__godetteMood;
    if (!g || !controls?.target) return;

    if (!mood?.signing) {
      desired.current.lerp(idleTarget, Math.min(delta * 1.2, 1));
    } else {
      const rBone = g.bones["R_palm"];
      const lBone = g.bones["L_palm"];
      const headBone = g.bones["head"];
      if (!headBone) return;
      headBone.getWorldPosition(_head);
      let active: THREE.Vector3 | null = null;
      if (rBone) rBone.getWorldPosition(_handR);
      if (lBone) lBone.getWorldPosition(_handL);
      const rUp = rBone && _handR.y > 0.95;
      const lUp = lBone && _handL.y > 0.95;
      if (rUp && lUp) {
        active = _tmp.copy(_handR).add(_handL).multiplyScalar(0.5);
      } else if (rUp) {
        active = _handR;
      } else if (lUp) {
        active = _handL;
      }
      if (active) {
        _tmp.set(
          active.x * 0.35 + _head.x * 0.65,
          active.y * 0.55 + _head.y * 0.45,
          active.z * 0.25 + _head.z * 0.75,
        );
        desired.current.lerp(_tmp, Math.min(delta * 1.2, 1));
      } else {
        // signing=true but arm not yet lifted (mid ramp-up).
        // Pan toward the anticipatory signing-space target so the camera
        // is already moving BEFORE the hand arrives.
        desired.current.lerp(anticipatoryTarget, Math.min(delta * 1.2, 1));
      }
    }
    // Slow, cinematic-glide follow. Combined with the desired-target
    // easing above this gives roughly 1.5-2s to reach a new pose --
    // deliberately slow so the pan reads as intentional camerawork, not
    // a react-to-hand snap.
    controls.target.lerp(desired.current, Math.min(delta * 1.5, 1));
    controls.update();
  });
  return null;
}

// SpotLight.target must be an Object3D that's actually part of the scene
// graph for its matrixWorld to update — the `target-position` JSX shorthand
// alone doesn't guarantee that. Rendering the target as an explicit child
// primitive is the reliable r3f pattern.
//
// This spotlight is aimed at the signing space -- upper-chest to face
// area, in front of the body. Intensity and angle tuned so finger
// individuality (curl vs. extension) is legible even from the wider
// upper-torso framing the tracker resettles to. Previously (0.7 int,
// 0.5 rad angle) it was so subtle it barely lit the fingers.
function HandSpotlight() {
  const target = useMemo(() => {
    const obj = new THREE.Object3D();
    obj.position.set(0, 1.30, 0.25);
    return obj;
  }, []);
  const lightRef = useRef<THREE.SpotLight>(null);
  useEffect(() => {
    if (lightRef.current) lightRef.current.target = target;
  }, [target]);

  return (
    <>
      <primitive object={target} />
      <spotLight
        ref={lightRef}
        position={[0.3, 2.0, 1.6]}
        angle={0.7}
        penumbra={0.5}
        intensity={1.6}
        color="#fff8ec"
        distance={5}
      />
    </>
  );
}

// A second, camera-mounted-style front fill light aimed straight at the
// signing space from just above the camera. Kills the harsh shadows that
// hide finger separation when the key light glances off the palm. Kept
// low-intensity + cool-toned so it doesn't flatten the studio look; its
// job is finger legibility, not primary illumination.
function HandFillLight() {
  const target = useMemo(() => {
    const obj = new THREE.Object3D();
    obj.position.set(0, 1.30, 0.25);
    return obj;
  }, []);
  const lightRef = useRef<THREE.SpotLight>(null);
  useEffect(() => {
    if (lightRef.current) lightRef.current.target = target;
  }, [target]);
  return (
    <>
      <primitive object={target} />
      <spotLight
        ref={lightRef}
        position={[0, 1.55, 1.4]}
        angle={0.9}
        penumbra={0.7}
        intensity={0.9}
        color="#e6efff"
        distance={4}
      />
    </>
  );
}

// Nudge r3f's ResizeObserver a beat after mount so the WebGL viewport matches
// the actual container size, not the initial-layout 300x150.
function useKickResize() {
  useEffect(() => {
    const t1 = setTimeout(() => window.dispatchEvent(new Event("resize")), 0);
    const t2 = setTimeout(() => window.dispatchEvent(new Event("resize")), 200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);
}

interface Props {
  frames: SignFrame[];
  speed: number;
  reducedMotion: boolean;
  mood: SentenceMood;
  armReach: number;
  onFinished: () => void;
}

// Renders the 3D stage. For MVP scaffolding we show placeholder hands.
// Later, this component swaps in a MANO or custom rigged hand+head model
// and drives it via the retargeter, feeding frames from `frames`.
export function AvatarStage({ frames, speed, reducedMotion, mood, armReach, onFinished }: Props) {
  const finishTimerRef = useRef<number | null>(null);
  useKickResize();

  useEffect(() => {
    if (finishTimerRef.current) {
      window.clearTimeout(finishTimerRef.current);
      finishTimerRef.current = null;
    }
    if (!frames || frames.length === 0) return;
    const duration = frames[frames.length - 1].t_ms;
    const scaled = reducedMotion ? duration * 1.5 : duration / Math.max(speed, 0.1);
    finishTimerRef.current = window.setTimeout(onFinished, scaled + 200);
    return () => {
      if (finishTimerRef.current) window.clearTimeout(finishTimerRef.current);
    };
  }, [frames, speed, reducedMotion, onFinished]);

  return (
    <Canvas
      camera={{ position: [0, 1.36, 0.95], fov: 36 }}
      gl={{ antialias: true, preserveDrawingBuffer: true }}
      dpr={[1, 2]}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      resize={{ scroll: false, debounce: { scroll: 50, resize: 0 } }}
      onCreated={(state) => {
        (window as unknown as { __r3f: unknown }).__r3f = state;
      }}
    >
      <StudioBackdrop />
      <BackdropPlane />
      <StudioLights />
      <HandSpotlight />
      <HandFillLight />

      <Suspense fallback={null}>
        <Godette frames={frames} speed={speed} reducedMotion={reducedMotion} mood={mood} armReach={armReach} />
      </Suspense>
      <OrbitControls
        makeDefault
        enablePan
        enableZoom
        minDistance={0.4}
        maxDistance={5}
        target={[0, 1.30, 0.10]}
      />
      <SigningCameraTracker />
    </Canvas>
  );
}

