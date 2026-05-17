'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';

import { saturnVertex, saturnFragment } from '@/lib/shaders/saturn';
import { ringVertex, ringFragment } from '@/lib/shaders/saturnRing';
import { atmosphereVertex, atmosphereFragment } from '@/lib/shaders/atmosphere';
import { usePlanetInteraction } from '@/lib/sceneStore';

type Props = {
  orbitRadius: number;
  speed: number;
  initialAngle?: number;
  radius?: number;
  axialTilt?: number;
};

const APPROACH = 34;
const AMB_OVERVIEW = 0.07;
const AMB_FOCUSED = 0.20;

export function Saturn({
  orbitRadius,
  speed,
  initialAngle = 0,
  radius = 4.6,
  axialTilt = 0.47
}: Props) {
  const groupRef = useRef<THREE.Group>(null);
  const surfaceRef = useRef<THREE.Mesh>(null);
  const surfaceMatRef = useRef<THREE.ShaderMaterial>(null);
  const ringMatRef = useRef<THREE.ShaderMaterial>(null);

  const { isFocused, isPaused, handlers } = usePlanetInteraction('saturn', groupRef, APPROACH, radius);

  const map = useTexture('/textures/planets/saturn.jpg');
  useEffect(() => {
    map.wrapS = THREE.RepeatWrapping;
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 8;
  }, [map]);

  const innerRadius = radius * 1.32;
  const outerRadius = radius * 2.45;

  const surfaceUniforms = useMemo(
    () => ({ uTime: { value: 0 }, uAmbient: { value: AMB_OVERVIEW }, uMap: { value: map } }),
    [map]
  );
  const atmosUniforms = useMemo(
    () => ({
      uColor: { value: new THREE.Color('#ffd58a') },
      uPower: { value: 3.0 },
      uIntensity: { value: 0.7 }
    }),
    []
  );
  const ringUniforms = useMemo(
    () => ({
      uInnerRadius: { value: innerRadius },
      uOuterRadius: { value: outerRadius },
      uPlanetPos: { value: new THREE.Vector3() },
      uPlanetRadius: { value: radius }
    }),
    [innerRadius, outerRadius, radius]
  );

  useFrame((state, dt) => {
    if (groupRef.current && !isPaused) {
      const t = state.clock.elapsedTime * speed + initialAngle;
      groupRef.current.position.x = Math.cos(t) * orbitRadius;
      groupRef.current.position.z = Math.sin(t) * orbitRadius;
      groupRef.current.position.y = Math.sin(t * 0.3) * 0.9;
    }
    if (groupRef.current && ringMatRef.current) {
      ringMatRef.current.uniforms.uPlanetPos.value.copy(groupRef.current.position);
    }
    if (surfaceRef.current) surfaceRef.current.rotation.y += dt * 0.028;
    if (surfaceMatRef.current) {
      surfaceMatRef.current.uniforms.uTime.value = state.clock.elapsedTime;
      const target = isFocused ? AMB_FOCUSED : AMB_OVERVIEW;
      const cur = surfaceMatRef.current.uniforms.uAmbient.value;
      surfaceMatRef.current.uniforms.uAmbient.value =
        cur + (target - cur) * Math.min(dt * 2.0, 1);
    }
  });

  return (
    <group ref={groupRef} {...handlers}>
      <group rotation={[0, 0, axialTilt]}>
        <mesh ref={surfaceRef}>
          <sphereGeometry args={[radius, 80, 80]} />
          <shaderMaterial
            ref={surfaceMatRef}
            uniforms={surfaceUniforms}
            vertexShader={saturnVertex}
            fragmentShader={saturnFragment}
          />
        </mesh>

        <mesh scale={1.04}>
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

        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[innerRadius, outerRadius, 256, 1]} />
          <shaderMaterial
            ref={ringMatRef}
            uniforms={ringUniforms}
            vertexShader={ringVertex}
            fragmentShader={ringFragment}
            transparent
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>
    </group>
  );
}
