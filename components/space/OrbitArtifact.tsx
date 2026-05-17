'use client';

import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';

import { useArtifactRegistration, useSceneStore, type PlanetId } from '@/lib/sceneStore';
import type { SpacecraftId } from '@/lib/journeyTypes';

// OrbitArtifact — loads a GLTF spacecraft and puts it in orbit around a
// planet. Inclined-circle orbit, configurable speed / radius / tilt /
// phase, optional self-spin.
//
//   followPlanet — anchors the orbit to this planet's world position
//   orbitRadius  — distance from planet centre in scene units
//   orbitSpeed   — angular velocity (rad/sec)
//   orbitTilt    — orbital plane inclination (radians, π/2 = polar)
//   orbitPhase   — initial angle so multiple artifacts spread out
//   scale        — visual scale on the GLB model
//   spinSpeed    — self-rotation around model's Y axis (rad/sec)
//   yaw          — fixed yaw offset applied to the model
//   artifactId   — register in the scene store for Navigator targeting

type Props = {
  modelUrl: string;
  followPlanet: PlanetId;
  orbitRadius: number;
  orbitSpeed?: number;
  orbitTilt?: number;
  orbitPhase?: number;
  scale?: number;
  spinSpeed?: number;
  yaw?: number;
  artifactId?: SpacecraftId;
  approachDistance?: number;
};

export function OrbitArtifact({
  modelUrl,
  followPlanet,
  orbitRadius,
  orbitSpeed = 0.06,
  orbitTilt = 0,
  orbitPhase = 0,
  scale = 0.04,
  spinSpeed = 0,
  yaw = 0,
  artifactId,
  approachDistance = 0.8
}: Props) {
  const { planets } = useSceneStore();
  const wrapperRef = useRef<THREE.Group>(null);
  const orbiterRef = useRef<THREE.Group>(null);
  const modelRef = useRef<THREE.Group>(null);

  const gltf = useGLTF(modelUrl);
  const cloned = useMemo(() => gltf.scene.clone(true), [gltf.scene]);

  useArtifactRegistration(artifactId, orbiterRef, approachDistance);

  useFrame((state, dt) => {
    const info = planets.get(followPlanet);
    if (info?.ref.current && wrapperRef.current) {
      info.ref.current.getWorldPosition(wrapperRef.current.position);
    }

    const t = state.clock.elapsedTime * orbitSpeed + orbitPhase;
    const sinT = Math.sin(t);
    const cosT = Math.cos(t);
    const tiltS = Math.sin(orbitTilt);
    const tiltC = Math.cos(orbitTilt);
    if (orbiterRef.current) {
      orbiterRef.current.position.set(
        cosT * orbitRadius,
        sinT * tiltS * orbitRadius,
        sinT * tiltC * orbitRadius
      );
    }

    if (modelRef.current && spinSpeed) {
      modelRef.current.rotation.y += dt * spinSpeed;
    }
  });

  return (
    <group ref={wrapperRef}>
      <group ref={orbiterRef}>
        <group ref={modelRef} rotation={[0, yaw, 0]}>
          <primitive object={cloned} scale={scale} />
        </group>
      </group>
    </group>
  );
}
