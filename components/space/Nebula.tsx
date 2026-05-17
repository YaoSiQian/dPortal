'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

import { nebulaVertex, nebulaFragment } from '@/lib/shaders/cosmos';

export function Nebula() {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);

  useFrame((state) => {
    if (matRef.current) matRef.current.uniforms.uTime.value = state.clock.elapsedTime;
  });

  return (
    <mesh renderOrder={-10}>
      <sphereGeometry args={[2400, 48, 48]} />
      <shaderMaterial
        ref={matRef}
        uniforms={uniforms}
        vertexShader={nebulaVertex}
        fragmentShader={nebulaFragment}
        side={THREE.BackSide}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}
