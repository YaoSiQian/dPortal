'use client';

import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';

import { earthVertex, earthFragment, cloudsFragment } from '@/lib/shaders/earth';
import { atmosphereVertex, atmosphereFragment } from '@/lib/shaders/atmosphere';
import { usePlanetInteraction, useSceneStore } from '@/lib/sceneStore';
import { Moon } from './Moon';

type Props = {
  orbitRadius: number;
  speed: number;
  initialAngle?: number;
  radius?: number;
  axialTilt?: number;
  /** Surface artifacts (Apollo, etc.) placed on the Moon. */
  moonChildren?: ReactNode;
};

const APPROACH = 11;
const AMB_OVERVIEW = 0.05;
const AMB_FOCUSED = 0.18;

export function Earth({
  orbitRadius,
  speed,
  initialAngle = 0,
  radius = 1.7,
  axialTilt = 0.41,
  moonChildren
}: Props) {
  const groupRef = useRef<THREE.Group>(null);
  const surfaceRef = useRef<THREE.Mesh>(null);
  const cloudsRef = useRef<THREE.Mesh>(null);
  const surfaceMatRef = useRef<THREE.ShaderMaterial>(null);
  const cloudsMatRef = useRef<THREE.ShaderMaterial>(null);

  const { isFocused, isPaused, handlers } = usePlanetInteraction('earth', groupRef, APPROACH, radius);
  // Earth also pauses when its moon is the focus, so the local frame stays
  // still while the camera observes Luna.
  const { focused } = useSceneStore();
  const orbitFrozen = isPaused || focused === 'moon';

  const textures = useTexture({
    day: '/textures/earth/day.jpg',
    night: '/textures/earth/night.png',
    spec: '/textures/earth/specular.jpg',
    clouds: '/textures/earth/clouds.jpg'
  });

  useEffect(() => {
    for (const t of Object.values(textures)) {
      t.wrapS = THREE.RepeatWrapping;
      t.anisotropy = 8;
    }
    textures.day.colorSpace = THREE.SRGBColorSpace;
    textures.night.colorSpace = THREE.SRGBColorSpace;
    textures.spec.colorSpace = THREE.NoColorSpace;
    textures.clouds.colorSpace = THREE.NoColorSpace;
  }, [textures]);

  const surfaceUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uAmbient: { value: AMB_OVERVIEW },
      uDayMap: { value: textures.day },
      uNightMap: { value: textures.night },
      uSpecMap: { value: textures.spec }
    }),
    [textures]
  );
  const cloudsUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uCloudsMap: { value: textures.clouds }
    }),
    [textures]
  );
  const atmosUniforms = useMemo(
    () => ({
      uColor: { value: new THREE.Color('#6ec3ff') },
      uPower: { value: 2.4 },
      uIntensity: { value: 1.0 }
    }),
    []
  );

  useFrame((state, dt) => {
    if (groupRef.current && !orbitFrozen) {
      const t = state.clock.elapsedTime * speed + initialAngle;
      groupRef.current.position.x = Math.cos(t) * orbitRadius;
      groupRef.current.position.z = Math.sin(t) * orbitRadius;
      groupRef.current.position.y = Math.sin(t * 0.5) * 0.6;
    }
    if (surfaceRef.current) surfaceRef.current.rotation.y += dt * 0.05;
    if (cloudsRef.current) cloudsRef.current.rotation.y += dt * 0.053;
    if (surfaceMatRef.current) {
      surfaceMatRef.current.uniforms.uTime.value = state.clock.elapsedTime;
      const target = isFocused ? AMB_FOCUSED : AMB_OVERVIEW;
      const cur = surfaceMatRef.current.uniforms.uAmbient.value;
      surfaceMatRef.current.uniforms.uAmbient.value =
        cur + (target - cur) * Math.min(dt * 2.0, 1);
    }
    if (cloudsMatRef.current) cloudsMatRef.current.uniforms.uTime.value = state.clock.elapsedTime;
  });

  return (
    <group ref={groupRef} {...handlers}>
      <group rotation={[0, 0, axialTilt]}>
        <mesh ref={surfaceRef}>
          <sphereGeometry args={[radius, 96, 96]} />
          <shaderMaterial
            ref={surfaceMatRef}
            uniforms={surfaceUniforms}
            vertexShader={earthVertex}
            fragmentShader={earthFragment}
          />
        </mesh>

        <mesh ref={cloudsRef} scale={1.013}>
          <sphereGeometry args={[radius, 64, 64]} />
          <shaderMaterial
            ref={cloudsMatRef}
            uniforms={cloudsUniforms}
            vertexShader={earthVertex}
            fragmentShader={cloudsFragment}
            transparent
            depthWrite={false}
          />
        </mesh>

        <mesh scale={1.085}>
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

      <Moon orbitRadius={6.5} speed={0.22} initialAngle={0.8}>
        {moonChildren}
      </Moon>
    </group>
  );
}
