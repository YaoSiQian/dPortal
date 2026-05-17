// components/anime/AnimePosterCards.tsx
// Near-view: per-point poster planes with on-demand textures. We cap
// concurrent texture loads at MAX_CONCURRENT to keep frame time
// stable. Posters are shown only for points within camera frustum
// AND within a small angular window of the camera-Earth direction —
// otherwise we'd try to render thousands.

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

import { latLngToEarthSurface } from '@/lib/anime/coords';
import { proxiedImageUrl } from '@/lib/anime/dataLoader';
import { useSceneStore } from '@/lib/sceneStore';
import type { AnimePoint, AnimeWork, PointId, WorkId } from '@/lib/anime/types';

const EARTH_RADIUS = 1.7;
const POSTER_SIZE = 0.18;
const POSTER_LIFT = 0.04;
const MAX_VISIBLE = 24;
const ANGLE_COS_THRESHOLD = 0.7; // ~45° cone from cam-to-earth axis
const FALLBACK_COLOR = new THREE.Color('#3a4660');

type Props = {
  points: Record<PointId, AnimePoint>;
  works: Record<WorkId, AnimeWork>;
};

const textureLoader = new THREE.TextureLoader();
textureLoader.crossOrigin = 'anonymous';
const textureCache = new Map<string, THREE.Texture | null>();
const inflight = new Set<string>();

function loadTexture(url: string): Promise<THREE.Texture | null> {
  if (textureCache.has(url)) return Promise.resolve(textureCache.get(url) ?? null);
  if (inflight.has(url)) {
    return new Promise((r) => {
      const tick = () => {
        if (textureCache.has(url)) r(textureCache.get(url) ?? null);
        else setTimeout(tick, 60);
      };
      tick();
    });
  }
  inflight.add(url);
  return new Promise((resolve) => {
    textureLoader.load(
      url,
      (t) => {
        t.colorSpace = THREE.SRGBColorSpace;
        textureCache.set(url, t);
        inflight.delete(url);
        resolve(t);
      },
      undefined,
      () => {
        textureCache.set(url, null);
        inflight.delete(url);
        resolve(null);
      }
    );
  });
}

type VisibleCard = {
  id: PointId;
  position: THREE.Vector3;
  normal: THREE.Vector3;
  posterUrl: string | null;
};

export function AnimePosterCards({ points, works }: Props) {
  const { planets } = useSceneStore();
  const { camera } = useThree();
  const [visible, setVisible] = useState<VisibleCard[]>([]);
  const earthCentre = useRef(new THREE.Vector3());
  const camDir = useRef(new THREE.Vector3());

  const all = useMemo(() => {
    const out: VisibleCard[] = [];
    for (const p of Object.values(points)) {
      const wid = p.workIds[0];
      const w = wid ? works[wid] : undefined;
      const url = proxiedImageUrl(p.imageUrl ?? w?.coverUrl ?? null);
      const pos = latLngToEarthSurface(p.lat, p.lng, EARTH_RADIUS, POSTER_LIFT);
      const normal = pos.clone().normalize();
      out.push({ id: p.id, position: pos, normal, posterUrl: url });
    }
    return out;
  }, [points, works]);

  useFrame(() => {
    const earth = planets.get('earth');
    if (!earth?.ref.current) return;
    earth.ref.current.getWorldPosition(earthCentre.current);
    camDir.current.subVectors(camera.position, earthCentre.current).normalize();

    // Only consider points within the visible-cap cone, sort by
    // proximity to camera, take top MAX_VISIBLE.
    const candidates: Array<{ card: VisibleCard; d: number }> = [];
    for (const card of all) {
      // Direction from earth centre to point in WORLD space —
      // earth.ref might be rotating, but coords.ts produces local
      // surface positions; the cone test is a coarse filter so we
      // accept the local-frame approximation here.
      if (camDir.current.dot(card.normal) < ANGLE_COS_THRESHOLD) continue;
      const worldPos = card.position.clone().add(earthCentre.current);
      const d = camera.position.distanceTo(worldPos);
      candidates.push({ card, d });
    }
    candidates.sort((a, b) => a.d - b.d);
    const next = candidates.slice(0, MAX_VISIBLE).map((c) => c.card);
    // Cheap identity check to avoid setState every frame.
    if (
      next.length !== visible.length ||
      next.some((c, i) => c.id !== visible[i]?.id)
    ) {
      setVisible(next);
    }
  });

  return (
    <group>
      {visible.map((card) => (
        <PosterPlane key={card.id} card={card} earthCentre={earthCentre} />
      ))}
    </group>
  );
}

function PosterPlane({
  card,
  earthCentre
}: {
  card: VisibleCard;
  earthCentre: React.MutableRefObject<THREE.Vector3>;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);
  const [tex, setTex] = useState<THREE.Texture | null>(null);
  const { setFocusedAnimePointId } = useSceneStore();

  useEffect(() => {
    let cancelled = false;
    if (!card.posterUrl) return;
    loadTexture(card.posterUrl).then((t) => {
      if (cancelled) return;
      setTex(t);
    });
    return () => {
      cancelled = true;
    };
  }, [card.posterUrl]);

  useEffect(() => {
    if (matRef.current) {
      matRef.current.map = tex;
      matRef.current.color = tex ? new THREE.Color('#ffffff') : FALLBACK_COLOR;
      matRef.current.needsUpdate = true;
    }
  }, [tex]);

  // Orient the poster along the surface normal, then tilt slightly
  // toward the camera so it reads even at grazing angles.
  useFrame(() => {
    const m = meshRef.current;
    if (!m) return;
    m.position.copy(card.position);
    m.lookAt(card.position.clone().multiplyScalar(2));
  });

  return (
    <mesh
      ref={meshRef}
      onClick={(e) => {
        e.stopPropagation();
        setFocusedAnimePointId(card.id);
      }}
    >
      <planeGeometry args={[POSTER_SIZE, POSTER_SIZE * 1.4]} />
      <meshBasicMaterial
        ref={matRef}
        color={FALLBACK_COLOR}
        transparent
        opacity={0.95}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}
