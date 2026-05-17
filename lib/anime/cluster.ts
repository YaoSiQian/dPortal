// lib/anime/cluster.ts
// Camera-distance-driven LOD selection + geohash-prefix bucketing for
// the cluster-points layer. Distances are in scene units (Earth's
// surface radius is 1.7).

import type { AnimePoint, PointId } from './types';
import { latLngToEarthSurface } from './coords';
import * as THREE from 'three';

export type LodLevel = 'far' | 'mid' | 'near';

/**
 * Camera distance to Earth centre → LOD bucket.
 *   far:  >18  (overview / planetary view)
 *   mid:  6–18 (orbit-altitude — see clusters as individual points)
 *   near: <6   (graze / surface — show poster cards)
 */
export function pickLod(camDistToEarthCentre: number): LodLevel {
  if (camDistToEarthCentre > 18) return 'far';
  if (camDistToEarthCentre > 6) return 'mid';
  return 'near';
}

/** Cluster all points by their geohash prefix. The prefix length scales
 *  inversely with how close the camera is — at 'far' we use len=2
 *  (~1250 km buckets), at 'mid' len=3 (~156 km). 'near' returns no
 *  clusters (caller renders raw points / posters). */
export function clusterPrefixLen(lod: LodLevel): number {
  if (lod === 'far') return 2;
  if (lod === 'mid') return 3;
  return 0;
}

export type Cluster = {
  /** Geohash-prefix bucket id, e.g. "8b". */
  bucket: string;
  /** Average lat/lng of member points. */
  lat: number;
  lng: number;
  /** Member point ids — also the click target. */
  points: PointId[];
  /** scene-local XYZ on Earth surface, derived from lat/lng. */
  position: THREE.Vector3;
};

export function buildClusters(
  points: Record<PointId, AnimePoint>,
  prefixLen: number,
  earthRadius: number
): Cluster[] {
  if (prefixLen <= 0) return [];
  const buckets = new Map<string, AnimePoint[]>();
  for (const p of Object.values(points)) {
    const key = p.id.slice(0, prefixLen);
    let list = buckets.get(key);
    if (!list) {
      list = [];
      buckets.set(key, list);
    }
    list.push(p);
  }
  const out: Cluster[] = [];
  for (const [bucket, list] of buckets) {
    let sumLat = 0;
    let sumLng = 0;
    for (const p of list) {
      sumLat += p.lat;
      sumLng += p.lng;
    }
    const lat = sumLat / list.length;
    const lng = sumLng / list.length;
    out.push({
      bucket,
      lat,
      lng,
      points: list.map((p) => p.id),
      position: latLngToEarthSurface(lat, lng, earthRadius, 0.005)
    });
  }
  return out;
}
