'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';

import { mercuryVertex, mercuryFragment } from '@/lib/shaders/mercury';
import { usePlanetInteraction } from '@/lib/sceneStore';

type Props = {
  orbitRadius: number;
  speed: number;
  initialAngle?: number;
  radius?: number;
  axialTilt?: number;
};

const APPROACH = 5.5;
const AMB_OVERVIEW = 0.06;
const AMB_FOCUSED = 0.20;

export function Mercury({
  orbitRadius,
  speed,
  initialAngle = 0,
  radius = 0.8,
  axialTilt = 0.02
}: Props) {
  const groupRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.ShaderMaterial>(null);

  const { isFocused, isPaused, handlers } = usePlanetInteraction('mercury', groupRef, APPROACH, radius);

  const map = useTexture('/textures/planets/mercury.jpg');
  useEffect(() => {
    map.wrapS = THREE.RepeatWrapping;
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 8;
  }, [map]);

  const uniforms = useMemo(
    () => ({ uTime: { value: 0 }, uAmbient: { value: AMB_OVERVIEW }, uMap: { value: map } }),
    [map]
  );

  useFrame((state, dt) => {
    if (groupRef.current && !isPaused) {
      const t = state.clock.elapsedTime * speed + initialAngle;
      groupRef.current.position.x = Math.cos(t) * orbitRadius;
      groupRef.current.position.z = Math.sin(t) * orbitRadius;
      groupRef.current.position.y = Math.sin(t * 0.6) * 0.35;
    }
    if (meshRef.current) meshRef.current.rotation.y += dt * 0.035;
    if (matRef.current) {
      matRef.current.uniforms.uTime.value = state.clock.elapsedTime;
      const target = isFocused ? AMB_FOCUSED : AMB_OVERVIEW;
      const cur = matRef.current.uniforms.uAmbient.value;
      matRef.current.uniforms.uAmbient.value = cur + (target - cur) * Math.min(dt * 2.0, 1);
    }
  });

  return (
    <group ref={groupRef} {...handlers}>
      <group rotation={[0, 0, axialTilt]}>
        <mesh ref={meshRef}>
          <sphereGeometry args={[radius, 56, 56]} />
          <shaderMaterial
            ref={matRef}
            uniforms={uniforms}
            vertexShader={mercuryVertex}
            fragmentShader={mercuryFragment}
          />
        </mesh>
      </group>
    </group>
  );
}
