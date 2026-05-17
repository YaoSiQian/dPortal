'use client';

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Suspense, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { EffectComposer, Bloom, ChromaticAberration, Vignette } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import gsap from 'gsap';

import { MemoryFragments } from './MemoryFragments';

// LandingScene — the cinematic 3D layer for pages 1 and 2 of the landing.
// One Canvas, one camera, one continuous flight. Stage controls behaviour:
//   "opening"      — camera near the entry plane, dust drifting, dark and
//                    quiet. No fragments yet.
//   "imagination"  — fragments materialise; GSAP glides the camera forward
//                    through the corridor of memories.
// Visual hand-off to the main Scene is handled at the parent via CSS
// opacity on the wrapper — this canvas just keeps doing its slow flight.

type Stage = 'opening' | 'imagination';

type Props = { stage: Stage };

export function LandingScene({ stage }: Props) {
  return (
    <Canvas
      className="absolute inset-0"
      camera={{ position: [0, 0, 70], fov: 38, near: 0.1, far: 4000 }}
      gl={{
        antialias: true,
        powerPreference: 'high-performance',
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 0.85,
        outputColorSpace: THREE.SRGBColorSpace
      }}
      dpr={[1, 2]}
    >
      <color attach="background" args={['#02030a']} />
      <ambientLight intensity={0.06} color="#9bb5ff" />

      <Suspense fallback={null}>
        <DeepStars />
        <Dust />
        <DistantSignal />
        <MemoryFragments stage={stage} />
        <LandingCamera stage={stage} />
      </Suspense>

      <EffectComposer multisampling={0}>
        <Bloom intensity={0.7} luminanceThreshold={0.18} luminanceSmoothing={0.4} mipmapBlur />
        <ChromaticAberration
          blendFunction={BlendFunction.NORMAL}
          offset={new THREE.Vector2(0.0008, 0.0008)}
          radialModulation={false}
          modulationOffset={0}
        />
        <Vignette eskil={false} offset={0.1} darkness={0.85} />
      </EffectComposer>
    </Canvas>
  );
}

// ----------------------------- Camera --------------------------------------

// Slow drift through a 200-unit corridor. The tween only touches z; x/y are
// owned by a gentle parallax in useFrame so the GSAP value and the live
// breathing never fight each other.
const Z_START = 70;
const Z_DEEP = -130;

function LandingCamera({ stage }: { stage: Stage }) {
  const { camera } = useThree();
  const zRef = useRef({ value: Z_START });
  const tweenRef = useRef<gsap.core.Tween | null>(null);
  const targetRef = useRef(new THREE.Vector3(0, 0, 0));

  useEffect(() => {
    tweenRef.current?.kill();
    if (stage === 'imagination') {
      tweenRef.current = gsap.to(zRef.current, {
        value: Z_DEEP,
        duration: 22,
        ease: 'power1.inOut'
      });
    } else {
      tweenRef.current = gsap.to(zRef.current, {
        value: Z_START,
        duration: 3,
        ease: 'power2.out'
      });
    }
    return () => {
      tweenRef.current?.kill();
    };
  }, [stage]);

  useFrame(({ clock, pointer }) => {
    const t = clock.elapsedTime;
    // x/y parallax: subtle, mouse-aware. Critically damped feel.
    const targetX = Math.sin(t * 0.07) * 0.5 + pointer.x * 1.2;
    const targetY = Math.cos(t * 0.09) * 0.35 + pointer.y * 0.8;
    camera.position.x += (targetX - camera.position.x) * 0.02;
    camera.position.y += (targetY - camera.position.y) * 0.02;
    camera.position.z = zRef.current.value;

    // Look 60 units ahead so the camera reads as "moving into" the corridor.
    targetRef.current.set(0, 0, camera.position.z - 60);
    camera.lookAt(targetRef.current);
  });

  return null;
}

// ----------------------------- Stars ---------------------------------------

const STAR_COUNT = 1800;

function DeepStars() {
  const matRef = useRef<THREE.ShaderMaterial>(null);

  const { positions, sizes, seeds } = useMemo(() => {
    const positions = new Float32Array(STAR_COUNT * 3);
    const sizes = new Float32Array(STAR_COUNT);
    const seeds = new Float32Array(STAR_COUNT);
    for (let i = 0; i < STAR_COUNT; i++) {
      const radius = 600 + Math.random() * 1400;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.cos(phi);
      positions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
      sizes[i] = 0.6 + Math.random() * 2.4;
      seeds[i] = Math.random();
    }
    return { positions, sizes, seeds };
  }, []);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uPixelRatio: {
        value: typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1
      }
    }),
    []
  );

  useFrame((state) => {
    if (matRef.current) matRef.current.uniforms.uTime.value = state.clock.elapsedTime;
  });

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-aSize" args={[sizes, 1]} />
        <bufferAttribute attach="attributes-aSeed" args={[seeds, 1]} />
      </bufferGeometry>
      <shaderMaterial
        ref={matRef}
        uniforms={uniforms}
        vertexShader={STAR_VERTEX}
        fragmentShader={STAR_FRAGMENT}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </points>
  );
}

const STAR_VERTEX = /* glsl */ `
attribute float aSize;
attribute float aSeed;
varying float vAlpha;
varying float vSeed;
uniform float uTime;
uniform float uPixelRatio;

void main(){
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  float tw = 0.55 + sin(uTime * 0.5 + aSeed * 8.0) * 0.18;
  vAlpha = tw;
  vSeed = aSeed;
  gl_PointSize = aSize * uPixelRatio * (260.0 / max(-mv.z, 50.0));
  gl_Position = projectionMatrix * mv;
}
`;

const STAR_FRAGMENT = /* glsl */ `
varying float vAlpha;
varying float vSeed;
void main(){
  vec2 d = gl_PointCoord - 0.5;
  float r = length(d);
  if (r > 0.5) discard;
  float a = pow(1.0 - r * 2.0, 2.0) * vAlpha * 0.7;
  vec3 col = mix(vec3(0.85, 0.93, 1.0), vec3(1.0, 0.96, 0.86), vSeed);
  gl_FragColor = vec4(col, a);
}
`;

// ----------------------------- Dust particles ------------------------------

const DUST_COUNT = 900;

function Dust() {
  const matRef = useRef<THREE.ShaderMaterial>(null);

  const { positions, seeds } = useMemo(() => {
    const positions = new Float32Array(DUST_COUNT * 3);
    const seeds = new Float32Array(DUST_COUNT);
    for (let i = 0; i < DUST_COUNT; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 90;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 60;
      positions[i * 3 + 2] = 90 - Math.random() * 260;
      seeds[i] = Math.random();
    }
    return { positions, seeds };
  }, []);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uPixelRatio: {
        value: typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1
      }
    }),
    []
  );

  useFrame((state) => {
    if (matRef.current) matRef.current.uniforms.uTime.value = state.clock.elapsedTime;
  });

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-aSeed" args={[seeds, 1]} />
      </bufferGeometry>
      <shaderMaterial
        ref={matRef}
        uniforms={uniforms}
        vertexShader={DUST_VERTEX}
        fragmentShader={DUST_FRAGMENT}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </points>
  );
}

const DUST_VERTEX = /* glsl */ `
attribute float aSeed;
varying float vAlpha;
uniform float uTime;
uniform float uPixelRatio;

void main(){
  vec3 p = position;
  p.x += sin(uTime * 0.07 + aSeed * 6.28) * 0.8;
  p.y += cos(uTime * 0.05 + aSeed * 4.2) * 0.6;
  p.z += sin(uTime * 0.03 + aSeed * 3.1) * 1.2;

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vAlpha = 0.18 + aSeed * 0.22;
  gl_PointSize = (1.4 + aSeed * 2.6) * uPixelRatio * (32.0 / max(-mv.z, 1.0));
  gl_Position = projectionMatrix * mv;
}
`;

const DUST_FRAGMENT = /* glsl */ `
varying float vAlpha;
void main(){
  vec2 d = gl_PointCoord - 0.5;
  float r = length(d);
  if (r > 0.5) discard;
  float a = pow(1.0 - r * 2.0, 2.5) * vAlpha;
  gl_FragColor = vec4(0.78, 0.86, 1.0, a);
}
`;

// ----------------------------- Distant signal pulse ------------------------

// Faint cyan ring deep in the corridor — stands in for the brief's "deep
// space transmission" element. Periodic outward pulse, very low intensity.
function DistantSignal() {
  const matRef = useRef<THREE.ShaderMaterial>(null);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uColor: { value: new THREE.Color('#9bd8ff') }
    }),
    []
  );

  useFrame((state) => {
    if (matRef.current) matRef.current.uniforms.uTime.value = state.clock.elapsedTime;
  });

  return (
    <mesh position={[0, 0, -220]}>
      <ringGeometry args={[6, 24, 80]} />
      <shaderMaterial
        ref={matRef}
        uniforms={uniforms}
        vertexShader={SIGNAL_VERTEX}
        fragmentShader={SIGNAL_FRAGMENT}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        side={THREE.DoubleSide}
        toneMapped={false}
      />
    </mesh>
  );
}

const SIGNAL_VERTEX = /* glsl */ `
varying vec2 vUv;
void main(){
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const SIGNAL_FRAGMENT = /* glsl */ `
varying vec2 vUv;
uniform vec3 uColor;
uniform float uTime;

void main(){
  vec2 d = vUv - 0.5;
  float r = length(d) * 2.0;
  float pulse = sin(uTime * 0.4 - r * 6.0) * 0.5 + 0.5;
  float band = smoothstep(0.95, 0.55, r) * smoothstep(0.0, 0.4, r);
  float a = band * pulse * 0.07;
  gl_FragColor = vec4(uColor, a);
}
`;
