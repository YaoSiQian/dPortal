'use client';

import { useGLTF } from '@react-three/drei';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';

import { useArtifactRegistration } from '@/lib/sceneStore';
import type { SpacecraftId } from '@/lib/journeyTypes';

// SurfaceArtifact — places a GLTF model on a planet's surface at a real
// latitude / longitude, oriented so its local +Y points away from the
// planet's centre (i.e. it "stands up" on the ground).
//
// Use as a child of the planet's rotating surface mesh so the artifact
// inherits the planet's self-rotation and stays glued to the same spot
// as the planet spins. Lat/lon are in degrees (north / east positive).
//
// If `artifactId` is given, the model registers with the scene store so
// the Navigator can target it.

type Props = {
  modelUrl: string;
  /** Degrees north (negative = south). */
  lat: number;
  /** Degrees east (negative = west). */
  lon: number;
  /** Planet's surface radius in scene units (same as sphereGeometry). */
  surfaceRadius: number;
  /** Visual scale of the model itself. Real spacecraft are tiny relative
   *  to the planet, so we oversize them for visibility. */
  scale?: number;
  /** Yaw around the local surface normal (radians). */
  yaw?: number;
  /** If set, the artifact registers in the scene store under this id so
   *  the Navigator can fly the camera here. */
  artifactId?: SpacecraftId;
  /** Distance the Navigator camera parks at when focused on this artifact.
   *  Default tuned for sub-meter surface props. */
  approachDistance?: number;
};

export function SurfaceArtifact({
  modelUrl,
  lat,
  lon,
  surfaceRadius,
  scale = 0.04,
  yaw = 0,
  artifactId,
  approachDistance = 0.5
}: Props) {
  const gltf = useGLTF(modelUrl);
  const groupRef = useRef<THREE.Group>(null);

  // Lat/lon → 3D position + an orientation that puts local +Y along the
  // surface normal. Matches three.js SphereGeometry's UV layout (so the
  // texture's prime-meridian-equator point is on +X).
  const { position, quaternion } = useMemo(() => {
    const latRad = (lat * Math.PI) / 180;
    const lonRad = (lon * Math.PI) / 180;
    const cosLat = Math.cos(latRad);
    const x = surfaceRadius * cosLat * Math.cos(lonRad);
    const y = surfaceRadius * Math.sin(latRad);
    const z = -surfaceRadius * cosLat * Math.sin(lonRad);
    const position = new THREE.Vector3(x, y, z);

    const normal = position.clone().normalize();
    const up = new THREE.Vector3(0, 1, 0);
    const quaternion = new THREE.Quaternion().setFromUnitVectors(up, normal);

    return { position, quaternion };
  }, [lat, lon, surfaceRadius]);

  // Clone the scene so multiple artifacts can use the same cached GLTF.
  const cloned = useMemo(() => gltf.scene.clone(true), [gltf.scene]);

  useArtifactRegistration(artifactId, groupRef, approachDistance);

  return (
    <group ref={groupRef} position={position} quaternion={quaternion}>
      <group rotation={[0, yaw, 0]}>
        <primitive object={cloned} scale={scale} />
      </group>
    </group>
  );
}
