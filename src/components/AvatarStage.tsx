import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { SignFrame } from "../types";
import { PlaceholderHands } from "./PlaceholderHands";

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
      camera={{ position: [0, 1.4, 2.4], fov: 40 }}
      gl={{ antialias: true }}
      dpr={[1, 2]}
    >
      <color attach="background" args={[0.05, 0.07, 0.12]} />
      <ambientLight intensity={0.6} />
      <directionalLight
        position={[3, 5, 4]}
        intensity={1.1}
        castShadow
        shadow-mapSize={new THREE.Vector2(1024, 1024)}
      />
      <PlaceholderHands frames={frames} speed={speed} reducedMotion={reducedMotion} />
      <PlaceholderHead />
      <OrbitControls
        enablePan={false}
        enableZoom
        minDistance={1.2}
        maxDistance={5}
        target={[0, 1.2, 0]}
      />
    </Canvas>
  );
}

function PlaceholderHead() {
  return (
    <group position={[0, 1.6, 0]}>
      <mesh castShadow>
        <sphereGeometry args={[0.18, 32, 32]} />
        <meshStandardMaterial color="#e2b48a" roughness={0.7} />
      </mesh>
      {/* Eyes */}
      <mesh position={[-0.06, 0.03, 0.15]}>
        <sphereGeometry args={[0.022, 12, 12]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      <mesh position={[0.06, 0.03, 0.15]}>
        <sphereGeometry args={[0.022, 12, 12]} />
        <meshStandardMaterial color="#111" />
      </mesh>
    </group>
  );
}
