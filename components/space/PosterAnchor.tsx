'use client';

import { Billboard, Float, useTexture } from '@react-three/drei';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { useCallback, useMemo, useRef } from 'react';
import * as THREE from 'three';

import { useSceneStore, type PlanetId } from '@/lib/sceneStore';

// PosterAnchor — a movie poster floating around a planet in an inclined
// orbit. Billboarded so it always faces the camera. Plane is a custom
// shader: image + soft edge vignette + a very faint scanline + a slow
// breathing pulse. A second slightly larger plane sits behind as an
// additive glow. Both layers fade in/out together via proximity trigger.

type Props = {
  imagePath: string;
  followPlanet: PlanetId;
  orbitRadius: number;
  orbitSpeed: number;
  orbitTilt: number;
  orbitPhase: number;
  posterHeight: number;
  glowColor?: string;
  triggerRadius?: number;
  fadeRate?: number;
};

export function PosterAnchor({
  imagePath,
  followPlanet,
  orbitRadius,
  orbitSpeed,
  orbitTilt,
  orbitPhase,
  posterHeight,
  glowColor = '#9bd8ff',
  triggerRadius,
  fadeRate = 1.2
}: Props) {
  const { camera } = useThree();
  const { planets, setSelectedPoster } = useSceneStore();

  const wrapperRef = useRef<THREE.Group>(null);
  const orbiterRef = useRef<THREE.Group>(null);
  const posterMatRef = useRef<THREE.ShaderMaterial>(null);
  const glowMatRef = useRef<THREE.ShaderMaterial>(null);

  const texture = useTexture(imagePath);

  // Wait until the image is decoded to know its aspect ratio.
  const aspect = useMemo(() => {
    const img = (texture.image as HTMLImageElement | undefined) ?? undefined;
    if (img && img.width && img.height) return img.width / img.height;
    return 0.67;
  }, [texture]);

  const width = posterHeight * aspect;
  const glowWidth = width * 1.32;
  const glowHeight = posterHeight * 1.32;

  const posterUniforms = useMemo(
    () => ({
      uMap: { value: texture },
      uOpacity: { value: 0 },
      uTime: { value: 0 }
    }),
    [texture]
  );

  const glowUniforms = useMemo(
    () => ({
      uColor: { value: new THREE.Color(glowColor) },
      uOpacity: { value: 0 },
      uTime: { value: 0 }
    }),
    [glowColor]
  );

  const opacityRef = useRef(0);
  const tmpCam = useRef(new THREE.Vector3());
  const tmpPlanet = useRef(new THREE.Vector3());

  // Pointer handlers. Only respond when the poster is actually visible to
  // avoid "phantom clicks" on faded-out posters far from the camera.
  const handleClick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      if (opacityRef.current < 0.3) return;
      e.stopPropagation();
      setSelectedPoster(imagePath);
    },
    [imagePath, setSelectedPoster]
  );
  const handleOver = useCallback((e: ThreeEvent<PointerEvent>) => {
    if (opacityRef.current < 0.3) return;
    e.stopPropagation();
    if (typeof document !== 'undefined') document.body.style.cursor = 'pointer';
  }, []);
  const handleOut = useCallback(() => {
    if (typeof document !== 'undefined') document.body.style.cursor = 'auto';
  }, []);

  useFrame((state, dt) => {
    const info = planets.get(followPlanet);

    // 1. Anchor wrapper to the planet's world position.
    if (info?.ref.current && wrapperRef.current) {
      info.ref.current.getWorldPosition(wrapperRef.current.position);
    }

    // 2. Inclined-circle orbit around the wrapper origin.
    const t = state.clock.elapsedTime * orbitSpeed + orbitPhase;
    if (orbiterRef.current) {
      const cosT = Math.cos(t);
      const sinT = Math.sin(t);
      const tiltS = Math.sin(orbitTilt);
      const tiltC = Math.cos(orbitTilt);
      orbiterRef.current.position.set(
        cosT * orbitRadius,
        sinT * tiltS * orbitRadius,
        sinT * tiltC * orbitRadius
      );
    }

    // 3. Proximity-driven fade.
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
    const time = state.clock.elapsedTime;

    if (posterMatRef.current) {
      posterMatRef.current.uniforms.uOpacity.value = op;
      posterMatRef.current.uniforms.uTime.value = time;
    }
    if (glowMatRef.current) {
      glowMatRef.current.uniforms.uOpacity.value = op;
      glowMatRef.current.uniforms.uTime.value = time;
    }
  });

  return (
    <group ref={wrapperRef}>
      <group ref={orbiterRef}>
        <Float
          speed={0.9}
          rotationIntensity={0.05}
          floatIntensity={0.55}
          floatingRange={[-0.15, 0.15]}
        >
          <Billboard>
            {/* Back glow plane — soft cyan halo behind the poster */}
            <mesh position={[0, 0, -0.01]}>
              <planeGeometry args={[glowWidth, glowHeight]} />
              <shaderMaterial
                ref={glowMatRef}
                uniforms={glowUniforms}
                vertexShader={GLOW_VERTEX}
                fragmentShader={GLOW_FRAGMENT}
                transparent
                depthWrite={false}
                blending={THREE.AdditiveBlending}
                toneMapped={false}
              />
            </mesh>
            {/* The poster itself */}
            <mesh
              onClick={handleClick}
              onPointerOver={handleOver}
              onPointerOut={handleOut}
            >
              <planeGeometry args={[width, posterHeight]} />
              <shaderMaterial
                ref={posterMatRef}
                uniforms={posterUniforms}
                vertexShader={POSTER_VERTEX}
                fragmentShader={POSTER_FRAGMENT}
                transparent
                depthWrite={false}
                toneMapped={false}
              />
            </mesh>
          </Billboard>
        </Float>
      </group>
    </group>
  );
}

// --------------------------------- Shaders ----------------------------------

const POSTER_VERTEX = /* glsl */ `
varying vec2 vUv;
void main(){
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

// Poster: image + soft rectangular vignette + very faint scanline + breath.
const POSTER_FRAGMENT = /* glsl */ `
varying vec2 vUv;
uniform sampler2D uMap;
uniform float uOpacity;
uniform float uTime;

void main(){
  vec4 c = texture2D(uMap, vUv);

  // Soft inset edge vignette — fades the outer ~8% of the plane
  vec2 d = abs(vUv - 0.5) * 2.0;
  float edge = smoothstep(1.0, 0.88, max(d.x, d.y));

  // Hairline scanline drift — sells the holographic feel without dominating
  float scan = 0.96 + sin(vUv.y * 220.0 + uTime * 0.35) * 0.04;

  // Slow breathing pulse
  float pulse = 0.92 + sin(uTime * 0.65) * 0.08;

  vec3 col = c.rgb * scan;
  float a = c.a * edge * uOpacity * pulse;
  gl_FragColor = vec4(col, a);
}
`;

const GLOW_VERTEX = POSTER_VERTEX;

// Glow: radial gradient from centre, additive — picked up by Bloom.
const GLOW_FRAGMENT = /* glsl */ `
varying vec2 vUv;
uniform vec3 uColor;
uniform float uOpacity;
uniform float uTime;

void main(){
  vec2 d = vUv - 0.5;
  float r = length(d) * 2.0;
  if (r > 1.0) discard;
  float glow = pow(1.0 - r, 1.8) * 0.32;
  float pulse = 0.85 + sin(uTime * 0.7) * 0.15;
  float a = glow * pulse * uOpacity;
  gl_FragColor = vec4(uColor, a);
}
`;
