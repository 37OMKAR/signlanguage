import { Canvas, useThree } from "@react-three/fiber";
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
        enablePan
        enableZoom
        minDistance={0.4}
        maxDistance={5}
        target={[0, 1.18, 0.05]}
      />
    </Canvas>
  );
}

