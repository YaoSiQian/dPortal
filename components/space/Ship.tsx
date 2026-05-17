'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// Stylised long-haul transit ship.
// Recognisable silhouette from the side: nose cone, fuselage, wing plate,
// engine housing, exhaust plume. Hull uses tone-mapped greys so it reads
// as a solid object — only the plume is intentionally emissive so Bloom
// catches it and the rest of the ship doesn't blow out into a featureless
// blob of light.

export function Ship() {
  const plumeRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (plumeRef.current) {
      const s = 1 + Math.sin(clock.elapsedTime * 9) * 0.12;
      plumeRef.current.scale.set(s, s, s * 1.6);
    }
  });

  return (
    <group>
      {/* Nose cone — apex faces +Z, which is the forward direction after
          Object3D.lookAt(shipPos + tangent). */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 1.0]}>
        <coneGeometry args={[0.34, 0.8, 20]} />
        <meshBasicMaterial color="#8d97b0" />
      </mesh>

      {/* Fuselage */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.0]}>
        <cylinderGeometry args={[0.38, 0.34, 1.6, 20]} />
        <meshBasicMaterial color="#5e6880" />
      </mesh>

      {/* Engine housing — wider, darker, sits at the rear (-Z) */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.98]}>
        <cylinderGeometry args={[0.32, 0.42, 0.32, 20]} />
        <meshBasicMaterial color="#272b39" />
      </mesh>

      {/* Wing plate — thin horizontal slab so silhouette reads sideways too */}
      <mesh position={[0, 0, -0.22]}>
        <boxGeometry args={[1.95, 0.07, 0.62]} />
        <meshBasicMaterial color="#717b95" />
      </mesh>

      {/* Small vertical fin */}
      <mesh position={[0, 0.24, -0.55]}>
        <boxGeometry args={[0.06, 0.42, 0.5]} />
        <meshBasicMaterial color="#717b95" />
      </mesh>

      {/* Exhaust plume — trailing the engine in -Z */}
      <mesh ref={plumeRef} position={[0, 0, -1.28]}>
        <sphereGeometry args={[0.22, 20, 20]} />
        <meshBasicMaterial
          color="#ffb858"
          transparent
          opacity={0.9}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}
