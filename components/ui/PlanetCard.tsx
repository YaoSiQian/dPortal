'use client';

import { useEffect, useMemo, useRef } from 'react';

import { PLANET_FACTS } from '@/lib/planetInfo';
import { useSceneStore, type PlanetId } from '@/lib/sceneStore';
import { SPACECRAFT, SPACECRAFT_IDS } from '@/lib/journeyInventory';
import { POSTERS_BY_PLANET } from '@/lib/postersData';

// PlanetCard — appears in the top-left corner whenever a planet is focused.
// Holds onto the last-focused planet's data while the fade-out animation
// runs so we don't get an empty card mid-transition.
//
// Facts shown:
//   静态:  类别(标题旁) · 半径 · 一日 · 距日
//   动态:  航天器 N (lookup hostPlanet over SPACECRAFT)
//          相关科幻 N (POSTERS_BY_PLANET length)
// 动态项为 0 时整行省略 — 没有"卫星 N"。

// Pre-compute spacecraft counts per planet so the lookup is O(1) at render.
const SPACECRAFT_COUNT_BY_PLANET = SPACECRAFT_IDS.reduce<Record<string, number>>(
  (acc, id) => {
    const host = SPACECRAFT[id].hostPlanet;
    acc[host] = (acc[host] ?? 0) + 1;
    return acc;
  },
  {}
);

export function PlanetCard() {
  const { focused } = useSceneStore();
  const lastFocused = useRef<PlanetId | null>(focused);

  useEffect(() => {
    if (focused !== null) lastFocused.current = focused;
  }, [focused]);

  const planetId = focused ?? lastFocused.current;
  const data = planetId ? PLANET_FACTS[planetId] : null;
  const visible = focused !== null;

  // Build the live count rows. Append only the non-zero ones — keeps the
  // card visually quiet when a body has nothing to claim.
  const dynamicFacts = useMemo<Array<[string, string]>>(() => {
    if (!planetId) return [];
    const rows: Array<[string, string]> = [];
    const sc = SPACECRAFT_COUNT_BY_PLANET[planetId] ?? 0;
    if (sc > 0) rows.push(['航天器', String(sc)]);
    const films = POSTERS_BY_PLANET[planetId]?.length ?? 0;
    if (films > 0) rows.push(['相关科幻', String(films)]);
    return rows;
  }, [planetId]);

  const allFacts = data ? [...data.facts, ...dynamicFacts] : [];

  return (
    <div
      className={`mt-6 max-w-[260px] transition-opacity duration-700 ease-out ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      {data && (
        <>
          <div className="text-stardust/95 text-[26px] tracking-wider2 font-light leading-tight">
            {data.nameZh}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-stardust/45">
            <span className="tracking-cosmic uppercase">{data.nameEn}</span>
            <span className="text-stardust/25">·</span>
            <span className="tracking-wider2">{data.category}</span>
          </div>

          <div className="mt-5 h-px w-full bg-stardust/15" />

          <dl className="mt-4 space-y-1.5 text-[11px]">
            {allFacts.map(([label, value]) => (
              <div key={label} className="flex items-baseline justify-between gap-4">
                <dt className="text-stardust/45 tracking-wider2">{label}</dt>
                <dd className="text-stardust/85 tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-5 h-px w-full bg-stardust/15" />

          <p className="mt-4 text-stardust/65 text-[11px] leading-relaxed">
            {data.description}
          </p>
        </>
      )}
    </div>
  );
}
