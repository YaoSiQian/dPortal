'use client';

import { useSceneStore } from '@/lib/sceneStore';
import { DOMAIN_LABELS, type CulturalDomain } from '@/lib/domain';

export function DomainSwitcher() {
  const {
    domain,
    setDomain,
    setNavigatorPhase,
    setJourney,
    setFocusedAnimePointId,
    setAnimeNavigatorPhase,
    setAnimeJourney,
    setFocused,
    setFocusedArtifact
  } = useSceneStore();

  const switchTo = (next: CulturalDomain) => {
    if (next === domain) return;
    // Clean both state machines so neither bleeds across the swap.
    setNavigatorPhase('closed');
    setJourney(null);
    setAnimeNavigatorPhase('closed');
    setAnimeJourney(null);
    setFocusedAnimePointId(null);
    setFocused(null);
    setFocusedArtifact(null);
    setDomain(next);
  };

  return (
    <div className="pointer-events-auto fixed top-6 right-6 z-30 flex gap-px border border-stardust/15 bg-deep/55 backdrop-blur-sm">
      {(Object.keys(DOMAIN_LABELS) as CulturalDomain[]).map((d) => {
        const active = d === domain;
        return (
          <button
            key={d}
            type="button"
            onClick={() => switchTo(d)}
            className={`px-4 py-2 text-[11px] tracking-cosmic uppercase transition-colors duration-300 ${
              active
                ? 'bg-stardust/15 text-stardust'
                : 'text-stardust/45 hover:text-stardust/85'
            }`}
          >
            {DOMAIN_LABELS[d].zh} · {DOMAIN_LABELS[d].en}
          </button>
        );
      })}
    </div>
  );
}
