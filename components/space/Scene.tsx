'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { Suspense, useMemo, useRef } from 'react';
import * as THREE from 'three';

import { Nebula } from './Nebula';
import { Starfield } from './Starfield';
import { CameraRig } from './CameraRig';
import { Voyage } from './Voyage';
import { VoyagePath } from './VoyagePath';
import { SurfaceArtifact } from './SurfaceArtifact';
import { OrbitArtifact } from './OrbitArtifact';
import { PostersLayer } from './PostersLayer';
import { Sun } from '@/components/planets/Sun';
import { Mercury } from '@/components/planets/Mercury';
import { Venus } from '@/components/planets/Venus';
import { Earth } from '@/components/planets/Earth';
import { Mars } from '@/components/planets/Mars';
import { Jupiter } from '@/components/planets/Jupiter';
import { Saturn } from '@/components/planets/Saturn';
import { Uranus } from '@/components/planets/Uranus';
import { Neptune } from '@/components/planets/Neptune';
import { PostFX } from '@/components/effects/PostFX';
import { useArtifactRegistration, useSceneStore } from '@/lib/sceneStore';
import { AnimeOverlay } from '@/components/anime/AnimeOverlay';
import { AnimeJourneyController } from '@/components/anime/AnimeJourneyController';

// Voyager 1 sits at a fixed point past Neptune, "leaving the solar system".
// Just a slow self-rotation, no orbital motion. Registers as an artifact so
// the Navigator can fly the camera here.
function Voyager() {
  const gltf = useGLTF('/models/voyager.glb');
  const cloned = useMemo(() => gltf.scene.clone(true), [gltf.scene]);
  const ref = useRef<THREE.Group>(null);
  useArtifactRegistration('voyager_1', ref, 2.5);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 0.04;
  });
  return (
    <group ref={ref} position={[255, 35, -130]}>
      <primitive object={cloned} scale={1.8} />
    </group>
  );
}

export function Scene() {
  const { domain } = useSceneStore();
  return (
    <Canvas
      className="absolute inset-0"
      camera={{ position: [60, 42, 260], fov: 42, near: 0.1, far: 6000 }}
      gl={{
        antialias: true,
        powerPreference: 'high-performance',
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.05,
        outputColorSpace: THREE.SRGBColorSpace
      }}
      dpr={[1, 2]}
    >
      <color attach="background" args={['#04060c']} />

      {/* GLB spacecraft models need lights — our planet shaders ignore them. */}
      <pointLight position={[0, 0, 0]} intensity={2.4} color="#ffe6b0" distance={0} decay={0} />
      <ambientLight intensity={0.18} color="#7d8aa0" />

      <Suspense fallback={null}>
        <Nebula />
        <Starfield />

        <Sun />
        <Mercury orbitRadius={18} speed={0.13} initialAngle={1.5} />
        <Venus orbitRadius={24} speed={0.10} initialAngle={4.2} />
        <Earth
          orbitRadius={32}
          speed={0.07}
          initialAngle={0.5}
          moonChildren={
            <SurfaceArtifact
              modelUrl="/models/apollo_lm.glb"
              lat={0.674}
              lon={23.473}
              surfaceRadius={0.46}
              scale={0.014}
              artifactId="apollo_lm"
              approachDistance={0.18}
            />
          }
        >
          {domain === 'anime' && <AnimeOverlay />}
        </Earth>
        <Mars orbitRadius={42} speed={0.052} initialAngle={3.8}>
          <SurfaceArtifact
            modelUrl="/models/viking.glb"
            lat={22.697}
            lon={-48.222}
            surfaceRadius={1.25}
            scale={0.008}
            artifactId="viking_1"
            approachDistance={0.32}
          />
          <SurfaceArtifact
            modelUrl="/models/perseverance.glb"
            lat={18.444}
            lon={77.451}
            surfaceRadius={1.25}
            scale={0.0007}
            artifactId="perseverance"
            approachDistance={0.12}
          />
          <SurfaceArtifact
            modelUrl="/models/ingenuity.glb"
            lat={18.452}
            lon={77.430}
            surfaceRadius={1.25}
            scale={0.025}
            artifactId="ingenuity"
            approachDistance={0.28}
          />
        </Mars>
        <Jupiter orbitRadius={72} speed={0.028} initialAngle={0.3} />
        <Saturn orbitRadius={110} speed={0.018} initialAngle={2.7} />
        <Uranus orbitRadius={150} speed={0.013} initialAngle={5.4} />
        <Neptune orbitRadius={190} speed={0.010} initialAngle={1.8} />

        {/* Orbital spacecraft — fly around their host planet at real-ish speeds.
            Scales were tuned against each GLB's native bbox so every
            craft reads as ~4-6% of its host body's diameter. */}
        <OrbitArtifact
          modelUrl="/models/iss.glb"
          followPlanet="earth"
          orbitRadius={2.05}
          orbitSpeed={0.32}
          orbitTilt={0.4}
          orbitPhase={0.6}
          scale={0.008}
          spinSpeed={0.05}
          artifactId="iss"
          approachDistance={0.7}
        />
        <OrbitArtifact
          modelUrl="/models/hubble.glb"
          followPlanet="earth"
          orbitRadius={2.45}
          orbitSpeed={0.22}
          orbitTilt={0.7}
          orbitPhase={2.4}
          scale={0.00018}
          spinSpeed={0.04}
          artifactId="hubble"
          approachDistance={0.4}
        />
        <OrbitArtifact
          modelUrl="/models/lro.glb"
          followPlanet="moon"
          orbitRadius={0.9}
          orbitSpeed={0.28}
          orbitTilt={Math.PI / 2 - 0.05}
          orbitPhase={1.2}
          scale={0.0017}
          spinSpeed={0.08}
          artifactId="lro"
          approachDistance={0.35}
        />
        <OrbitArtifact
          modelUrl="/models/cassini.glb"
          followPlanet="saturn"
          orbitRadius={13.5}
          orbitSpeed={0.08}
          orbitTilt={0.55}
          orbitPhase={3.0}
          scale={0.010}
          spinSpeed={0.05}
          artifactId="cassini"
          approachDistance={1.1}
        />

        {/* Voyager 1 drifting past Neptune. */}
        <Voyager />

        {/* Sci-fi film posters orbiting their associated planet as
            holographic memory residues. Fade in when the camera approaches. */}
        {domain === 'scifi' && <PostersLayer />}

        <CameraRig />
        {domain === 'anime' && <AnimeJourneyController />}
        <Voyage />
        <VoyagePath />
        <PostFX />
      </Suspense>
    </Canvas>
  );
}
