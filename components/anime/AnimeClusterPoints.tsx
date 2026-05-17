// components/anime/AnimeClusterPoints.tsx
// Far-view layer: one InstancedMesh of small glowing dots, one
// instance per cluster bucket. Cheap enough to render thousands of
// buckets even on a phone.

'use client';

import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

import { buildClusters, clusterPrefixLen } from '@/lib/anime/cluster';
import type { AnimePoint, PointId } from '@/lib/anime/types';

const EARTH_RADIUS = 1.7; // matches components/planets/Earth.tsx
const COLOR = new THREE.Color('#9bd8ff');

type Props = {
  points: Record<PointId, AnimePoint>;
};

export function AnimeClusterPoints({ points }: Props) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const tmp = useMemo(() => new THREE.Object3D(), []);

  const clusters = useMemo(
    () => buildClusters(points, clusterPrefixLen('far'), EARTH_RADIUS),
    [points]
  );

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    clusters.forEach((c, i) => {
      tmp.position.copy(c.position);
      // Scale slightly with member count, capped so giants don't blob.
      const s = 0.012 + Math.min(0.018, c.points.length * 0.0006);
      tmp.scale.setScalar(s);
      // Orient flat against the surface — billboard against the
      // outward normal so they read as patches not spikes.
      tmp.lookAt(c.position.clone().multiplyScalar(2));
      tmp.updateMatrix();
      mesh.setMatrixAt(i, tmp.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.count = clusters.length;
  }, [clusters, tmp]);

  if (clusters.length === 0) return null;

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, clusters.length]}>
      <circleGeometry args={[1, 12]} />
      <meshBasicMaterial color={COLOR} transparent opacity={0.85} depthWrite={false} />
    </instancedMesh>
  );
}
