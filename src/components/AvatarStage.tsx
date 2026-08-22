import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { SignFrame } from "../types";
import { Godette } from "./Godette";
import { Suspense } from "react";

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
  onFinished: () => void;
}

// Renders the 3D stage. For MVP scaffolding we show placeholder hands.
// Later, this component swaps in a MANO or custom rigged hand+head model
// and drives it via the retargeter, feeding frames from `frames`.
export function AvatarStage({ frames, speed, reducedMotion, onFinished }: Props) {
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
      <color attach="background" args={[0.05, 0.07, 0.12]} />
      <ambientLight intensity={0.6} />
      <directionalLight
        position={[3, 5, 4]}
        intensity={1.1}
        castShadow
        shadow-mapSize={new THREE.Vector2(1024, 1024)}
      />
      <Suspense fallback={null}>
        <Godette frames={frames} speed={speed} reducedMotion={reducedMotion} />
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

