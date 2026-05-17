'use client';

import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';

import { marsVertex, marsFragment } from '@/lib/shaders/mars';
import { atmosphereVertex, atmosphereFragment } from '@/lib/shaders/atmosphere';
import { usePlanetInteraction } from '@/lib/sceneStore';

type Props = {
  orbitRadius: number;
  speed: number;
  initialAngle?: number;
  radius?: number;
  axialTilt?: number;
  /** Surface artifacts (rovers, landers) — placed as children of the
   *  rotating surface mesh so they ride along with the planet. */
  children?: ReactNode;
};

const APPROACH = 11;
const AMB_OVERVIEW = 0.08;
const AMB_FOCUSED = 0.20;

export function Mars({
  orbitRadius,
  speed,
  initialAngle = 0,
  radius = 1.25,
  axialTilt = 0.44,
  children
}: Props) {
  const groupRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.ShaderMaterial>(null);

  const { isFocused, isPaused, handlers } = usePlanetInteraction('mars', groupRef, APPROACH, radius);

  const map = useTexture('/textures/planets/mars.jpg');
  useEffect(() => {
    map.wrapS = THREE.RepeatWrapping;
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 8;
  }, [map]);

  const uniforms = useMemo(
    () => ({ uTime: { value: 0 }, uAmbient: { value: AMB_OVERVIEW }, uMap: { value: map } }),
    [map]
  );
  const atmosUniforms = useMemo(
    () => ({
      uColor: { value: new THREE.Color('#ff8a55') },
      uPower: { value: 3.2 },
      uIntensity: { value: 0.55 }
    }),
    []
  );

  useFrame((state, dt) => {
    if (groupRef.current && !isPaused) {
      const t = state.clock.elapsedTime * speed + initialAngle;
      groupRef.current.position.x = Math.cos(t) * orbitRadius;
      groupRef.current.position.z = Math.sin(t) * orbitRadius;
      groupRef.current.position.y = Math.sin(t * 0.4) * 0.45;
    }
    if (meshRef.current) meshRef.current.rotation.y += dt * 0.055;
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
          <sphereGeometry args={[radius, 64, 64]} />
          <shaderMaterial
            ref={matRef}
            uniforms={uniforms}
            vertexShader={marsVertex}
            fragmentShader={marsFragment}
          />
          {children}
        </mesh>

        <mesh scale={1.06}>
          <sphereGeometry args={[radius, 36, 36]} />
          <shaderMaterial
            uniforms={atmosUniforms}
            vertexShader={atmosphereVertex}
            fragmentShader={atmosphereFragment}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      </group>
    </group>
  );
}
