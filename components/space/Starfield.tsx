'use client';

import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

import { starVertex, starFragment } from '@/lib/shaders/cosmos';

const STAR_COUNT = 4500;

export function Starfield() {
  const pointsRef = useRef<THREE.Points>(null);
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const pixelRatio = useThree((s) => s.viewport.dpr);

  const { positions, sizes, seeds, colors } = useMemo(() => {
    const positions = new Float32Array(STAR_COUNT * 3);
    const sizes = new Float32Array(STAR_COUNT);
    const seeds = new Float32Array(STAR_COUNT);
    const colors = new Float32Array(STAR_COUNT * 3);

    for (let i = 0; i < STAR_COUNT; i++) {
      const r = THREE.MathUtils.randFloat(700, 2000);
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(THREE.MathUtils.randFloatSpread(2));
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.cos(phi);
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);

      const big = Math.random() < 0.05;
      sizes[i] = big
        ? THREE.MathUtils.randFloat(2.6, 4.1)
        : THREE.MathUtils.randFloat(0.6, 1.6);
      seeds[i] = Math.random();

      const tone = Math.random();
      if (tone < 0.62) {
        const v = THREE.MathUtils.randFloat(0.86, 1.0);
        colors[i * 3] = v;
        colors[i * 3 + 1] = v;
        colors[i * 3 + 2] = v;
      } else if (tone < 0.86) {
        colors[i * 3] = THREE.MathUtils.randFloat(0.55, 0.78);
        colors[i * 3 + 1] = THREE.MathUtils.randFloat(0.7, 0.88);
        colors[i * 3 + 2] = 1.0;
      } else {
        colors[i * 3] = 1.0;
        colors[i * 3 + 1] = THREE.MathUtils.randFloat(0.72, 0.9);
        colors[i * 3 + 2] = THREE.MathUtils.randFloat(0.5, 0.7);
      }
    }
    return { positions, sizes, seeds, colors };
  }, []);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uPixelRatio: { value: pixelRatio }
    }),
    [pixelRatio]
  );

  useFrame((state, dt) => {
    if (pointsRef.current) pointsRef.current.rotation.y += dt * 0.0035;
    if (matRef.current) matRef.current.uniforms.uTime.value = state.clock.elapsedTime;
  });

  return (
    <points ref={pointsRef} renderOrder={-5}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-aSize" args={[sizes, 1]} />
        <bufferAttribute attach="attributes-aSeed" args={[seeds, 1]} />
        <bufferAttribute attach="attributes-aColor" args={[colors, 3]} />
      </bufferGeometry>
      <shaderMaterial
        ref={matRef}
        uniforms={uniforms}
        vertexShader={starVertex}
        fragmentShader={starFragment}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </points>
  );
}
