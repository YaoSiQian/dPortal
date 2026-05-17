'use client';

import { useEffect, useRef } from 'react';

import { useSceneStore, PLANET_LABELS } from '@/lib/sceneStore';
import { SPACECRAFT } from '@/lib/journeyInventory';
import type { SpacecraftId } from '@/lib/journeyTypes';

// ArtifactCard — appears in place of PlanetCard whenever a spacecraft is
// focused. Mirrors the PlanetCard visual layout (Chinese name + English
// label + category + a short fact list + description) so the HUD reads
// consistently regardless of subject.
//
// Holds onto the last-focused artifact during fade-out so the content
// doesn't blink to empty mid-transition.

const KIND_LABEL: Record<'surface' | 'orbit' | 'deepspace', string> = {
  surface: '表面着陆',
  orbit: '轨道运行',
  deepspace: '深空巡航'
};

export function ArtifactCard() {
  const { focusedArtifact } = useSceneStore();
  const lastRef = useRef<SpacecraftId | null>(focusedArtifact);

  useEffect(() => {
    if (focusedArtifact !== null) lastRef.current = focusedArtifact;
  }, [focusedArtifact]);

  const id = focusedArtifact ?? lastRef.current;
  const data = id ? SPACECRAFT[id] : null;
  const visible = focusedArtifact !== null;

  return (
    <div
      className={`mt-6 max-w-[260px] transition-opacity duration-700 ease-out ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      {data && (
        <>
          <div className="text-stardust/95 text-[24px] tracking-wider2 font-light leading-tight">
            {data.name}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-stardust/45">
            <span className="tracking-cosmic uppercase">{data.id.replace(/_/g, ' ')}</span>
            <span className="text-stardust/25">·</span>
            <span className="tracking-wider2">人类航天器</span>
          </div>

          <div className="mt-5 h-px w-full bg-stardust/15" />

          <dl className="mt-4 space-y-1.5 text-[11px]">
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-stardust/45 tracking-wider2">所在</dt>
              <dd className="text-stardust/85 tracking-wider2">
                {PLANET_LABELS[data.hostPlanet]}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-stardust/45 tracking-wider2">状态</dt>
              <dd className="text-stardust/85 tracking-wider2">{KIND_LABEL[data.kind]}</dd>
            </div>
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
