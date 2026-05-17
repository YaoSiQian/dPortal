'use client';

import { useGLTF, useTexture, Billboard } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import * as THREE from 'three';
import gsap from 'gsap';

// MemoryFragments — humanity's imagination drifting through deep space.
// Ghostly NASA spacecraft + planet silhouettes scattered along the camera
// corridor. Self-managed fade: pass `stage`, the layer tweens its own
// opacity ref and propagates the live value to every fragment per frame
// (no per-frame re-render).

type Stage = 'opening' | 'imagination';

// Cyan hologram tint pulled from the existing HUD accent palette.
const TINT = new THREE.Color('#a8d8ff');

const SPACECRAFT: Array<{
  url: string;
  position: [number, number, number];
  scale: number;
  spin?: number;
  drift?: number;
}> = [
  { url: '/models/apollo_lm.glb', position: [-7, 2, 18], scale: 0.22, spin: 0.06, drift: 0.5 },
  { url: '/models/voyager.glb', position: [9, -4, -8], scale: 1.6, spin: 0.04, drift: 0.7 },
  { url: '/models/hubble.glb', position: [-11, 6, -28], scale: 0.012, spin: 0.05, drift: 0.4 },
  { url: '/models/iss.glb', position: [13, 1, -50], scale: 0.025, spin: 0.03, drift: 0.6 },
  { url: '/models/cassini.glb', position: [-6, -7, -78], scale: 0.04, spin: 0.04, drift: 0.5 },
  { url: '/models/perseverance.glb', position: [4, -2, -98], scale: 0.0035, spin: 0.02, drift: 0.3 }
];

const PLANET_SILHOUETTES: Array<{
  texture: string;
  position: [number, number, number];
  size: number;
}> = [
  { texture: '/textures/planets/moon.jpg', position: [16, 7, 6], size: 5.5 },
  { texture: '/textures/planets/mars.jpg', position: [-18, -5, -38], size: 7 },
  { texture: '/textures/planets/saturn.jpg', position: [22, 9, -82], size: 10 }
];

type Props = { stage: Stage };

export function MemoryFragments({ stage }: Props) {
  // Live opacity, written by the GSAP tween, read each frame by children.
  const opacityRef = useRef(0);
  const proxyRef = useRef({ v: 0 });

  useEffect(() => {
    const target = stage === 'imagination' ? 1 : 0;
    const tween = gsap.to(proxyRef.current, {
      v: target,
      duration: 3.5,
      ease: 'power1.inOut',
      onUpdate: () => {
        opacityRef.current = proxyRef.current.v;
      }
    });
    return () => {
      tween.kill();
    };
  }, [stage]);

  return (
    <group>
      {SPACECRAFT.map((s, i) => (
        <SpacecraftFragment key={s.url + i} {...s} opacityRef={opacityRef} />
      ))}
      {PLANET_SILHOUETTES.map((p, i) => (
        <PlanetSilhouette key={p.texture + i} {...p} opacityRef={opacityRef} />
      ))}
    </group>
  );
}

// ----------------------------- Spacecraft ----------------------------------

type SpacecraftProps = {
  url: string;
  position: [number, number, number];
  scale: number;
  spin?: number;
  drift?: number;
  opacityRef: MutableRefObject<number>;
};

function SpacecraftFragment({
  url,
  position,
  scale,
  spin = 0.05,
  drift = 0.5,
  opacityRef
}: SpacecraftProps) {
  const gltf = useGLTF(url);
  const groupRef = useRef<THREE.Group>(null);
  const matRef = useRef<THREE.MeshBasicMaterial | null>(null);

  // Clone the GLB and swap every mesh to a single flat ghostly cyan material.
  const cloned = useMemo(() => {
    const scene = gltf.scene.clone(true);
    const mat = new THREE.MeshBasicMaterial({
      color: TINT,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false
    });
    matRef.current = mat;
    scene.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        (o as THREE.Mesh).material = mat;
      }
    });
    return scene;
  }, [gltf]);

  const phase = useMemo(() => Math.random() * Math.PI * 2, []);

  useFrame((state) => {
    if (groupRef.current) {
      const t = state.clock.elapsedTime;
      groupRef.current.rotation.y += spin * 0.016;
      groupRef.current.position.x = position[0] + Math.sin(t * 0.18 + phase) * drift;
      groupRef.current.position.y = position[1] + Math.cos(t * 0.14 + phase * 1.3) * drift * 0.6;
      groupRef.current.position.z = position[2] + Math.sin(t * 0.11 + phase * 0.7) * drift * 0.4;
    }
    if (matRef.current) {
      const breath = 0.78 + Math.sin(state.clock.elapsedTime * 0.6 + phase) * 0.22;
      matRef.current.opacity = opacityRef.current * breath * 0.55;
    }
  });

  return (
    <group ref={groupRef} position={position} scale={scale}>
      <primitive object={cloned} />
    </group>
  );
}

// ----------------------------- Planet silhouettes --------------------------

type PlanetProps = {
  texture: string;
  position: [number, number, number];
  size: number;
  opacityRef: MutableRefObject<number>;
};

function PlanetSilhouette({ texture, position, size, opacityRef }: PlanetProps) {
  const tex = useTexture(texture);
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const groupRef = useRef<THREE.Group>(null);

  const uniforms = useMemo(
    () => ({
      uMap: { value: tex },
      uOpacity: { value: 0 },
      uTint: { value: TINT.clone() },
      uTime: { value: 0 }
    }),
    [tex]
  );

  const phase = useMemo(() => Math.random() * Math.PI * 2, []);

  useFrame((state) => {
    if (groupRef.current) {
      const t = state.clock.elapsedTime;
      groupRef.current.position.x = position[0] + Math.sin(t * 0.12 + phase) * 0.6;
      groupRef.current.position.y = position[1] + Math.cos(t * 0.09 + phase) * 0.4;
    }
    if (matRef.current) {
      const breath = 0.7 + Math.sin(state.clock.elapsedTime * 0.5 + phase * 0.7) * 0.3;
      matRef.current.uniforms.uOpacity.value = opacityRef.current * breath * 0.4;
      matRef.current.uniforms.uTime.value = state.clock.elapsedTime;
    }
  });

  return (
    <group ref={groupRef} position={position}>
      <Billboard>
        <mesh>
          <circleGeometry args={[size / 2, 64]} />
          <shaderMaterial
            ref={matRef}
            uniforms={uniforms}
            vertexShader={PLANET_VERTEX}
            fragmentShader={PLANET_FRAGMENT}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
          />
        </mesh>
      </Billboard>
    </group>
  );
}

const PLANET_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

// Sample a circular region of the equirectangular planet map, tint cyan,
// soft radial vignette — reads as memory residue, not a planet body.
const PLANET_FRAGMENT = /* glsl */ `
varying vec2 vUv;
uniform sampler2D uMap;
uniform vec3 uTint;
uniform float uOpacity;
uniform float uTime;

void main() {
  vec2 d = vUv - 0.5;
  float r = length(d) * 2.0;
  if (r > 1.0) discard;

  vec2 sampleUv = vec2(0.5 + d.x * 0.5, 0.5 + d.y);
  vec3 raw = texture2D(uMap, sampleUv).rgb;

  float softEdge = smoothstep(1.0, 0.55, r);
  float core = pow(1.0 - r, 1.6);

  vec3 col = mix(raw * 0.4, uTint, 0.65);
  float a = (core * 0.85 + softEdge * 0.15) * uOpacity;
  gl_FragColor = vec4(col, a);
}
`;

// Preload all spacecraft GLBs so the imagination layer arrives without a pop.
SPACECRAFT.forEach((s) => useGLTF.preload(s.url));
