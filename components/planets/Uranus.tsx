'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';

import { uranusVertex, uranusFragment } from '@/lib/shaders/uranus';
import { atmosphereVertex, atmosphereFragment } from '@/lib/shaders/atmosphere';
import { usePlanetInteraction } from '@/lib/sceneStore';

type Props = {
  orbitRadius: number;
  speed: number;
  initialAngle?: number;
  radius?: number;
  axialTilt?: number;
};

const APPROACH = 18;
const AMB_OVERVIEW = 0.07;
const AMB_FOCUSED = 0.22;

export function Uranus({
  orbitRadius,
  speed,
  initialAngle = 0,
  radius = 3.1,
  axialTilt = 1.71
}: Props) {
  const groupRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.ShaderMaterial>(null);

  const { isFocused, isPaused, handlers } = usePlanetInteraction('uranus', groupRef, APPROACH, radius);

  const map = useTexture('/textures/planets/uranus.jpg');
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
      uColor: { value: new THREE.Color('#9be7ee') },
      uPower: { value: 2.8 },
      uIntensity: { value: 0.85 }
    }),
    []
  );

  useFrame((state, dt) => {
    if (groupRef.current && !isPaused) {
      const t = state.clock.elapsedTime * speed + initialAngle;
      groupRef.current.position.x = Math.cos(t) * orbitRadius;
      groupRef.current.position.z = Math.sin(t) * orbitRadius;
      groupRef.current.position.y = Math.sin(t * 0.25) * 0.6;
    }
    if (meshRef.current) meshRef.current.rotation.y += dt * 0.022;
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
          <sphereGeometry args={[radius, 72, 72]} />
          <shaderMaterial
            ref={matRef}
            uniforms={uniforms}
            vertexShader={uranusVertex}
            fragmentShader={uranusFragment}
          />
        </mesh>

        <mesh scale={1.05}>
          <sphereGeometry args={[radius, 48, 48]} />
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
