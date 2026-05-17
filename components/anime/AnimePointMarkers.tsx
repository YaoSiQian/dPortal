// components/anime/AnimePointMarkers.tsx
// Mid-view: one InstancedMesh of small ring/dot pairs, one per point.
// Click target uses a Drei <Bvh>-style raycast surrogate: for an
// MVP-acceptable click hit, we put a transparent sphere overlay at
// each point and forward onClick to the store.

'use client';

import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

import { latLngToEarthSurface } from '@/lib/anime/coords';
import { useSceneStore } from '@/lib/sceneStore';
import type { AnimePoint, PointId } from '@/lib/anime/types';

const EARTH_RADIUS = 1.7;
const HIT_RADIUS = 0.012;

type Props = {
  points: Record<PointId, AnimePoint>;
};

export function AnimePointMarkers({ points }: Props) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const tmp = useMemo(() => new THREE.Object3D(), []);
  const list = useMemo(() => Object.values(points), [points]);
  const { setFocusedAnimePointId } = useSceneStore();

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    list.forEach((p, i) => {
      const pos = latLngToEarthSurface(p.lat, p.lng, EARTH_RADIUS, 0.004);
      tmp.position.copy(pos);
      tmp.scale.setScalar(HIT_RADIUS);
      tmp.lookAt(pos.clone().multiplyScalar(2));
      tmp.updateMatrix();
      mesh.setMatrixAt(i, tmp.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.count = list.length;
  }, [list, tmp]);

  if (list.length === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, list.length]}
      onClick={(e) => {
        e.stopPropagation();
        const idx = e.instanceId;
        if (idx === undefined) return;
        const p = list[idx];
        if (p) setFocusedAnimePointId(p.id);
      }}
      onPointerOver={() => {
        if (typeof document !== 'undefined') document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        if (typeof document !== 'undefined') document.body.style.cursor = 'auto';
      }}
    >
      <circleGeometry args={[1, 16]} />
      <meshBasicMaterial color="#cfe7ff" transparent opacity={0.95} depthWrite={false} />
    </instancedMesh>
  );
}
