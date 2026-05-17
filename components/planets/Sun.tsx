'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

import { sunVertex, sunFragment, coronaVertex, coronaFragment } from '@/lib/shaders/sun';

const SUN_RADIUS = 11;

export function Sun() {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const meshRef = useRef<THREE.Mesh>(null);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uColorCore: { value: new THREE.Color('#fff1c4') },
      uColorMid: { value: new THREE.Color('#ffb964') },
      uColorEdge: { value: new THREE.Color('#ff6020') }
    }),
    []
  );

  const coronaInner = useMemo(
    () => ({
      uColor: { value: new THREE.Color('#ff9748') },
      uPower: { value: 2.4 },
      uIntensity: { value: 1.8 }
    }),
    []
  );

  const coronaOuter = useMemo(
    () => ({
      uColor: { value: new THREE.Color('#ffd2a0') },
      uPower: { value: 4.0 },
      uIntensity: { value: 1.2 }
    }),
    []
  );

  useFrame((state, dt) => {
    if (matRef.current) matRef.current.uniforms.uTime.value = state.clock.elapsedTime;
    if (meshRef.current) meshRef.current.rotation.y += dt * 0.018;
  });

  return (
    <group>
      <mesh ref={meshRef}>
        <sphereGeometry args={[SUN_RADIUS, 96, 96]} />
        <shaderMaterial
          ref={matRef}
          uniforms={uniforms}
          vertexShader={sunVertex}
          fragmentShader={sunFragment}
          toneMapped={false}
        />
      </mesh>

      <mesh scale={1.2}>
        <sphereGeometry args={[SUN_RADIUS, 48, 48]} />
        <shaderMaterial
          uniforms={coronaInner}
          vertexShader={coronaVertex}
          fragmentShader={coronaFragment}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>

      <mesh scale={1.65}>
        <sphereGeometry args={[SUN_RADIUS, 48, 48]} />
        <shaderMaterial
          uniforms={coronaOuter}
          vertexShader={coronaVertex}
          fragmentShader={coronaFragment}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}
