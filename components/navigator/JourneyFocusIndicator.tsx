'use client';

import { useSceneStore, PLANET_LABELS } from '@/lib/sceneStore';
import { SPACECRAFT } from '@/lib/journeyInventory';

// JourneyFocusIndicator — a quiet one-line "Now Observing · X" label
// shown top-left during the running phase of a Journey.
//
// Why this exists: during a journey the full HUD (PlanetCard / brand /
// hints) is hidden so the subtitle and StopCard can breathe, but the user
// still needs a tiny anchor that says what they're actually looking at.
// This component is that anchor — and only that.

export function JourneyFocusIndicator() {
  const { navigatorPhase, focused, focusedArtifact } = useSceneStore();

  if (navigatorPhase !== 'running') return null;

  const label = focusedArtifact
    ? SPACECRAFT[focusedArtifact].name
    : focused
      ? PLANET_LABELS[focused]
      : null;
  if (!label) return null;

  const kind = focusedArtifact ? '航天器' : '行星';

  return (
    <div className="absolute top-8 left-10 z-30 pointer-events-none select-none">
      <div className="text-stardust/55 text-[10px] tracking-cosmic uppercase">
        当前观察 · Now Observing
      </div>
      <div className="mt-2 flex items-baseline gap-3">
        <span className="text-stardust/95 text-[18px] tracking-wider2 font-light">{label}</span>
        <span className="text-stardust/30 text-[9px] tracking-cosmic uppercase">{kind}</span>
      </div>
      <div className="mt-3 h-px w-10 bg-stardust/20" />
    </div>
  );
}
