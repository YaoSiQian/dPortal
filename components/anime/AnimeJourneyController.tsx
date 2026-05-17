// components/anime/AnimeJourneyController.tsx
// Drives the camera through an AnimeJourney's stops. Each stop:
//   1. Set focused='earth' so CameraRig flies us to Earth at orbit alt
//   2. After ~3s settle, lerp orbitControls.target toward the lat/lng
//      world position and pull camera radius down to ~0.45 over 4s
//   3. Hold ~5.5s with subtitle visible; advance to next stop
//
// TODO(anime/mvp): we skip the `previewing` phase entirely and jump to
// `running` from `AnimeJourneyOverlay` after 1.2s, so there is no
// JourneyPreview equivalent in the anime domain yet.

'use client';

import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

import { useSceneStore } from '@/lib/sceneStore';
import { latLngToEarthSurface } from '@/lib/anime/coords';
import { loadPointsIndex } from '@/lib/anime/dataLoader';
import type { AnimePoint, PointId } from '@/lib/anime/types';

const EARTH_RADIUS = 1.7;
const STOP_HOLD_MS = 5500;
const SETTLE_MS = 3000;

export function AnimeJourneyController() {
  const {
    domain,
    animeNavigatorPhase,
    animeJourney,
    animeJourneyStopIndex,
    setAnimeJourneyStopIndex,
    setAnimeNavigatorPhase,
    setFocusedAnimePointId,
    setFocused,
    planets,
    controlsRef
  } = useSceneStore();

  const { camera } = useThree();
  const pointsRef = useRef<Record<PointId, AnimePoint> | null>(null);
  const localTarget = useRef(new THREE.Vector3());
  const desiredCam = useRef(new THREE.Vector3());
  const earthCentre = useRef(new THREE.Vector3());
  const phaseRef = useRef<'settling' | 'descending' | 'holding' | 'idle'>('idle');
  const phaseStartedAt = useRef(0);

  useEffect(() => {
    loadPointsIndex()
      .then((p) => {
        pointsRef.current = p;
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (
      domain === 'anime' &&
      animeNavigatorPhase === 'running' &&
      animeJourney &&
      animeJourneyStopIndex < animeJourney.stops.length
    ) {
      setFocused('earth');
      phaseRef.current = 'settling';
      phaseStartedAt.current = performance.now();
      const stop = animeJourney.stops[animeJourneyStopIndex];
      setFocusedAnimePointId(stop.pointId);
    }
    if (animeNavigatorPhase !== 'running') {
      phaseRef.current = 'idle';
    }
  }, [
    domain,
    animeNavigatorPhase,
    animeJourney,
    animeJourneyStopIndex,
    setFocused,
    setFocusedAnimePointId
  ]);

  useFrame(() => {
    if (
      domain !== 'anime' ||
      animeNavigatorPhase !== 'running' ||
      !animeJourney ||
      !pointsRef.current ||
      !controlsRef.current
    ) {
      return;
    }
    const stop = animeJourney.stops[animeJourneyStopIndex];
    if (!stop) return;
    const point = pointsRef.current[stop.pointId];
    if (!point) return;

    const earth = planets.get('earth');
    if (!earth?.ref.current) return;
    earth.ref.current.getWorldPosition(earthCentre.current);

    localTarget.current
      .copy(latLngToEarthSurface(point.lat, point.lng, EARTH_RADIUS, 0.005))
      .add(earthCentre.current);

    const now = performance.now();
    const elapsed = now - phaseStartedAt.current;

    if (phaseRef.current === 'settling') {
      if (elapsed > SETTLE_MS) {
        phaseRef.current = 'descending';
        phaseStartedAt.current = now;
      }
      return;
    }

    if (phaseRef.current === 'descending') {
      // Descend over 4 s: lerp target toward surface and pull camera radius
      // down 8 → 0.45.
      const t = Math.min(1, (now - phaseStartedAt.current) / 4000);
      controlsRef.current.target.lerp(localTarget.current, t * 0.05);
      const dirToCam = camera.position.clone().sub(controlsRef.current.target);
      const len = dirToCam.length();
      const desiredRadius = THREE.MathUtils.lerp(8, 0.45, t);
      dirToCam.multiplyScalar(desiredRadius / Math.max(len, 0.0001));
      desiredCam.current.copy(controlsRef.current.target).add(dirToCam);
      camera.position.lerp(desiredCam.current, 0.04);
      camera.lookAt(controlsRef.current.target);

      if (t >= 1) {
        phaseRef.current = 'holding';
        phaseStartedAt.current = now;
      }
      return;
    }

    if (phaseRef.current === 'holding') {
      // Hold: keep target glued to the surface point. No radius lerp, so the
      // camera stays at the descent endpoint instead of recoiling outward.
      // The small target lerp continues to tighten onto the exact surface
      // point as Earth rotates.
      controlsRef.current.target.lerp(localTarget.current, 0.08);
      camera.lookAt(controlsRef.current.target);

      if (now - phaseStartedAt.current > STOP_HOLD_MS) {
        const next = animeJourneyStopIndex + 1;
        if (next < animeJourney.stops.length) {
          setAnimeJourneyStopIndex(next);
          phaseRef.current = 'settling';
          phaseStartedAt.current = now;
          const nstop = animeJourney.stops[next];
          setFocusedAnimePointId(nstop.pointId);
        } else {
          setAnimeNavigatorPhase('summary');
        }
      }
      return;
    }
  });

  return null;
}
