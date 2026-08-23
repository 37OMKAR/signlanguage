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
    const canvas = document.createElement("canvas");
    canvas.width = 8;
    canvas.height = 256;
    const ctx = canvas.getContext("2d")!;
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, "#12141f");
    gradient.addColorStop(0.55, "#232637");
    gradient.addColorStop(1, "#3a3d4d");
    ctx.fillStyle = gradient;
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
  const idleTarget = useMemo(() => new THREE.Vector3(0, 1.18, 0.05), []);
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
      // Ease back to the standard upper-body framing.
      desired.current.lerp(idleTarget, Math.min(delta * 2.5, 1));
    } else {
      const rBone = g.bones["R_palm"];
      const lBone = g.bones["L_palm"];
      const headBone = g.bones["head"];
      if (!headBone) return;
      headBone.getWorldPosition(_head);
      // Pick the ACTIVE hand -- one that's actually raised into signing
      // space (Y above hip ~0.95). Falls back to both-hands midpoint when
      // both are up, or the idle target if neither is.
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
        // Blend the hand's world position with the head's so the face
        // stays visible even when tracking the hand -- otherwise a
        // face-level sign centered on the hand crops out the head, and a
        // chest-level sign centered on the hand crops out the face.
        // Weights tuned so the frame contains BOTH.
        _tmp.set(
          active.x * 0.35 + _head.x * 0.65,
          active.y * 0.55 + _head.y * 0.45,
          active.z * 0.25 + _head.z * 0.75,
        );
        desired.current.lerp(_tmp, Math.min(delta * 2.5, 1));
      } else {
        desired.current.lerp(idleTarget, Math.min(delta * 2.5, 1));
      }
    }
    controls.target.lerp(desired.current, Math.min(delta * 3.5, 1));
    controls.update();
  });
  return null;
}

// SpotLight.target must be an Object3D that's actually part of the scene
// graph for its matrixWorld to update — the `target-position` JSX shorthand
// alone doesn't guarantee that. Rendering the target as an explicit child
// primitive is the reliable r3f pattern.
function HandSpotlight() {
  const target = useMemo(() => {
    const obj = new THREE.Object3D();
    obj.position.set(0, 1.15, 0.15);
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
        position={[0.4, 2.2, 1.4]}
        angle={0.5}
        penumbra={0.6}
        intensity={0.7}
        color="#fff8ec"
        distance={5}
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
      camera={{ position: [0, 1.2, 1.25], fov: 40 }}
      gl={{ antialias: true, preserveDrawingBuffer: true }}
      dpr={[1, 2]}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      resize={{ scroll: false, debounce: { scroll: 50, resize: 0 } }}
      onCreated={(state) => {
        (window as unknown as { __r3f: unknown }).__r3f = state;
      }}
    >
      <StudioBackdrop />

      {/* Three-point studio lighting: key (main, warm, from camera-right),
          fill (soft, cool, opposite side, low intensity so shadows stay soft
          not black), and rim/back (behind her, catches hair + shoulder edge
          so she reads as separated from the backdrop). A dedicated hand
          spotlight adds a little extra sparkle on the signing hands. */}
      <ambientLight intensity={0.35} color="#dfe6ff" />
      <directionalLight
        position={[2.2, 2.6, 2.2]}
        intensity={1.6}
        color="#fff3e0"
        castShadow
        shadow-mapSize={new THREE.Vector2(1024, 1024)}
      />
      <directionalLight
        position={[-2.4, 1.4, 1.6]}
        intensity={0.55}
        color="#cfe0ff"
      />
      <directionalLight
        position={[-0.6, 2.4, -2.2]}
        intensity={0.9}
        color="#e8f0ff"
      />
      <HandSpotlight />

      <Suspense fallback={null}>
        <Godette frames={frames} speed={speed} reducedMotion={reducedMotion} mood={mood} armReach={armReach} />
      </Suspense>
      <OrbitControls
        makeDefault
        enablePan
        enableZoom
        minDistance={0.4}
        maxDistance={5}
        target={[0, 1.18, 0.05]}
      />
      <SigningCameraTracker />
    </Canvas>
  );
}

