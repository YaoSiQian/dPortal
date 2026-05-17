'use client';

import { Billboard, Text } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';

import { useSceneStore, type PlanetId } from '@/lib/sceneStore';

// OrbitMemory — a ghost-style memory residue drifting in orbit around a
// planet. Two billboarded glow planes (core + aura) + a handful of wisp
// particles + an optional drifting text fragment. No frame, no brackets.

type Props = {
  followPlanet: PlanetId;
  orbitRadius?: number;
  orbitSpeed?: number;
  orbitTilt?: number;
  orbitPhase?: number;
  color?: string;
  fragment?: string;
  fragmentOffset?: [number, number, number];
  fragmentSize?: number;
  triggerRadius?: number;
  fadeRate?: number;
  glowSize?: number;
};

const WISP_COUNT = 7;

export function OrbitMemory({
  followPlanet,
  orbitRadius = 4,
  orbitSpeed = 0.06,
  orbitTilt = 0,
  orbitPhase = 0,
  color = '#c8d4ff',
  fragment,
  fragmentOffset = [0.95, 0.55, 0],
  fragmentSize = 0.16,
  triggerRadius,
  fadeRate = 1.3,
  glowSize = 0.75
}: Props) {
  const { camera } = useThree();
  const { planets } = useSceneStore();

  const wrapperRef = useRef<THREE.Group>(null);
  const orbiterRef = useRef<THREE.Group>(null);
  const coreMatRef = useRef<THREE.ShaderMaterial>(null);
  const auraMatRef = useRef<THREE.ShaderMaterial>(null);
  const wispsMatRef = useRef<THREE.ShaderMaterial>(null);
  const textRef = useRef<THREE.Mesh>(null);

  const wispData = useMemo(() => {
    const positions = new Float32Array(WISP_COUNT * 3);
    const seeds = new Float32Array(WISP_COUNT);
    for (let i = 0; i < WISP_COUNT; i++) {
      const r = 0.4 + Math.random() * 1.0;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.cos(phi);
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
      seeds[i] = Math.random();
    }
    return { positions, seeds };
  }, []);

  const coreUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: 0 }
    }),
    [color]
  );
  const auraUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: 0 }
    }),
    [color]
  );
  const wispsUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: 0 },
      uPixelRatio: {
        value: typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1
      }
    }),
    [color]
  );

  const opacityRef = useRef(0);
  const tmpCam = useRef(new THREE.Vector3());
  const tmpPlanet = useRef(new THREE.Vector3());

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

    let target = 0;
    if (info?.ref.current) {
      info.ref.current.getWorldPosition(tmpPlanet.current);
      camera.getWorldPosition(tmpCam.current);
      const dist = tmpCam.current.distanceTo(tmpPlanet.current);
      const inner = triggerRadius ?? info.approachDistance * 1.8;
      const outer = inner * 2;
      target = 1 - THREE.MathUtils.smoothstep(dist, inner, outer);
    }

    const k = 1 - Math.pow(0.001, dt * fadeRate);
    opacityRef.current += (target - opacityRef.current) * k;
    const op = opacityRef.current;

    if (coreMatRef.current) coreMatRef.current.uniforms.uOpacity.value = op;
    if (auraMatRef.current) auraMatRef.current.uniforms.uOpacity.value = op;
    if (wispsMatRef.current) wispsMatRef.current.uniforms.uOpacity.value = op;
    if (textRef.current) {
      const mat = (textRef.current as THREE.Mesh).material as THREE.Material;
      if (mat) mat.opacity = op * 0.55;
    }

    const time = state.clock.elapsedTime;
    if (coreMatRef.current) coreMatRef.current.uniforms.uTime.value = time;
    if (auraMatRef.current) auraMatRef.current.uniforms.uTime.value = time;
    if (wispsMatRef.current) wispsMatRef.current.uniforms.uTime.value = time;
    if (textRef.current && fragment) {
      textRef.current.position.x =
        fragmentOffset[0] + Math.sin(time * 0.32 + orbitPhase) * 0.08;
      textRef.current.position.y =
        fragmentOffset[1] + Math.cos(time * 0.27 + orbitPhase) * 0.06;
    }
  });

  return (
    <group ref={wrapperRef}>
      <group ref={orbiterRef}>
        <Billboard>
          <mesh>
            <planeGeometry args={[glowSize * 4.2, glowSize * 4.2]} />
            <shaderMaterial
              ref={auraMatRef}
              uniforms={auraUniforms}
              vertexShader={GLOW_VERTEX}
              fragmentShader={AURA_FRAGMENT}
              transparent
              depthWrite={false}
              blending={THREE.AdditiveBlending}
              toneMapped={false}
            />
          </mesh>
          <mesh position={[0, 0, 0.001]}>
            <planeGeometry args={[glowSize * 1.6, glowSize * 1.6]} />
            <shaderMaterial
              ref={coreMatRef}
              uniforms={coreUniforms}
              vertexShader={GLOW_VERTEX}
              fragmentShader={CORE_FRAGMENT}
              transparent
              depthWrite={false}
              blending={THREE.AdditiveBlending}
              toneMapped={false}
            />
          </mesh>
          {fragment && (
            <Text
              ref={textRef}
              position={fragmentOffset}
              fontSize={fragmentSize}
              letterSpacing={0.14}
              color={color}
              anchorX="center"
              anchorY="middle"
              maxWidth={5}
              material-transparent
              material-opacity={0}
              material-toneMapped={false}
              material-depthWrite={false}
            >
              {fragment}
            </Text>
          )}
        </Billboard>

        <points>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[wispData.positions, 3]} />
            <bufferAttribute attach="attributes-aSeed" args={[wispData.seeds, 1]} />
          </bufferGeometry>
          <shaderMaterial
            ref={wispsMatRef}
            uniforms={wispsUniforms}
            vertexShader={WISPS_VERTEX}
            fragmentShader={WISPS_FRAGMENT}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
          />
        </points>
      </group>
    </group>
  );
}

// --------------------------------- Shaders ----------------------------------

const GLOW_VERTEX = /* glsl */ `
varying vec2 vUv;
void main(){
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const CORE_FRAGMENT = /* glsl */ `
varying vec2 vUv;
uniform vec3 uColor;
uniform float uOpacity;
uniform float uTime;

void main(){
  vec2 d = vUv - 0.5;
  float r = length(d) * 2.0;
  if (r > 1.0) discard;

  float wobble = sin(d.x * 8.0 + uTime * 0.35)
               * sin(d.y * 6.5 - uTime * 0.28) * 0.07;
  float r2 = clamp(r + wobble, 0.0, 1.0);

  float core = exp(-r2 * r2 * 4.5) * 0.7;
  float pulse = 0.86 + sin(uTime * 0.8) * 0.14;

  float a = core * pulse * uOpacity;
  gl_FragColor = vec4(uColor, a);
}
`;

const AURA_FRAGMENT = /* glsl */ `
varying vec2 vUv;
uniform vec3 uColor;
uniform float uOpacity;
uniform float uTime;

void main(){
  vec2 d = vUv - 0.5;
  float r = length(d) * 2.0;
  if (r > 1.0) discard;

  float aura = exp(-r * r * 1.6) * 0.22;
  float pulse = 0.78 + sin(uTime * 0.65 + 1.2) * 0.22;

  float a = aura * pulse * uOpacity;
  gl_FragColor = vec4(uColor, a);
}
`;

const WISPS_VERTEX = /* glsl */ `
attribute float aSeed;
varying float vAlpha;
uniform float uTime;
uniform float uOpacity;
uniform float uPixelRatio;

void main(){
  vec3 drift = vec3(
    sin(uTime * 0.35 + aSeed * 6.28) * 0.25,
    cos(uTime * 0.28 + aSeed * 4.5)  * 0.20,
    sin(uTime * 0.42 + aSeed * 5.1)  * 0.25
  );
  vec3 p = position + drift;

  vAlpha = uOpacity * (0.35 + aSeed * 0.45);

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = (1.8 + aSeed * 3.2) * uPixelRatio * (12.0 / max(-mv.z, 1.0));
  gl_Position = projectionMatrix * mv;
}
`;

const WISPS_FRAGMENT = /* glsl */ `
varying float vAlpha;
uniform vec3 uColor;

void main(){
  vec2 d = gl_PointCoord - 0.5;
  float r = length(d);
  if (r > 0.5) discard;
  float a = pow(1.0 - r * 2.0, 2.0) * vAlpha;
  gl_FragColor = vec4(uColor * a, a);
}
`;
