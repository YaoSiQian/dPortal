'use client';

import { useMemo } from 'react';

import { POSTERS_BY_PLANET, POSTER_PLACEMENT } from '@/lib/postersData';
import type { PlanetId } from '@/lib/sceneStore';
import { PosterAnchor } from './PosterAnchor';

// Iterate POSTERS_BY_PLANET, build per-poster orbital parameters with
// deterministic pseudo-random spread (so reloads are stable, no two
// posters end up overlapping in the same plane).

type PosterSpec = {
  key: string;
  imagePath: string;
  followPlanet: PlanetId;
  orbitRadius: number;
  orbitSpeed: number;
  orbitTilt: number;
  orbitPhase: number;
  posterHeight: number;
};

function generateSpecs(): PosterSpec[] {
  const specs: PosterSpec[] = [];
  let idx = 0;

  for (const [planetIdKey, paths] of Object.entries(POSTERS_BY_PLANET)) {
    const planet = planetIdKey as PlanetId;
    if (paths.length === 0) continue;
    const placement = POSTER_PLACEMENT[planet];

    paths.forEach((path, i) => {
      const baseAngle = (i / paths.length) * Math.PI * 2;
      const angleJitter = ((idx * 1.31) % 1 - 0.5) * (Math.PI / paths.length);
      const phase = baseAngle + angleJitter;

      // Radius varies 0.85×–1.45× of base so posters layer at different depths
      const radiusFactor = 0.85 + ((idx * 0.371) % 1) * 0.6;
      const orbitRadius = placement.orbitBase * radiusFactor;

      // Tilt: ±0.55 rad, spread via sin
      const orbitTilt = Math.sin(idx * 2.73) * 0.55;

      // Speed: 0.025-0.07 rad/s
      const orbitSpeed = 0.025 + Math.abs(Math.cos(idx * 3.11)) * 0.045;

      // Height variation per poster
      const heightFactor = 0.85 + ((idx * 0.193) % 1) * 0.3;
      const posterHeight = placement.baseHeight * heightFactor;

      specs.push({
        key: `${planet}-${i}-${path}`,
        imagePath: path,
        followPlanet: planet,
        orbitRadius,
        orbitSpeed,
        orbitTilt,
        orbitPhase: phase,
        posterHeight
      });
      idx++;
    });
  }
  return specs;
}

export function PostersLayer() {
  const specs = useMemo(() => generateSpecs(), []);
  return (
    <>
      {specs.map((s) => (
        <PosterAnchor
          key={s.key}
          imagePath={s.imagePath}
          followPlanet={s.followPlanet}
          orbitRadius={s.orbitRadius}
          orbitSpeed={s.orbitSpeed}
          orbitTilt={s.orbitTilt}
          orbitPhase={s.orbitPhase}
          posterHeight={s.posterHeight}
        />
      ))}
    </>
  );
}
