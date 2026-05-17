'use client';

import { useSceneStore, PLANET_LABELS } from '@/lib/sceneStore';
import { SPACECRAFT } from '@/lib/journeyInventory';
import { MOVIES_BY_PATH } from '@/lib/movieInfo';
import type { JourneyStop } from '@/lib/journeyTypes';

// JourneyPreview — shown after the LLM returns a Journey. Lists the
// proposed stops (target + recommended film) so the user can sanity-check
// before the camera starts moving. Two actions: Begin Journey, or back
// to prompting to try a different mood.

export function JourneyPreview() {
  const {
    navigatorPhase,
    journey,
    setNavigatorPhase,
    setJourney,
    setJourneyStopIndex
  } = useSceneStore();

  if (navigatorPhase !== 'previewing' || !journey) return null;

  const begin = () => {
    setJourneyStopIndex(0);
    setNavigatorPhase('running');
  };

  const retry = () => {
    setJourney(null);
    setNavigatorPhase('prompting');
  };

  return (
    <div className="fixed inset-0 z-40 pointer-events-auto bg-deep/65 backdrop-blur-sm overflow-y-auto">
      <div className="min-h-full w-full flex items-center justify-center py-12">
        <div
          className="relative w-[640px] max-w-[calc(100vw-80px)] bg-deep/85 backdrop-blur-md border border-stardust/15 px-10 py-9"
          style={{ boxShadow: '0 0 80px rgba(155,216,255,0.08)' }}
        >
          <div className="flex items-baseline justify-between">
            <div className="text-stardust/85 text-[11px] tracking-cosmic uppercase">
              Journey · {journey.stops.length} 站
            </div>
            <button
              type="button"
              onClick={retry}
              className="text-stardust/35 hover:text-stardust/85 text-[10px] tracking-cosmic uppercase transition-colors duration-300"
            >
              × 换一段 · Try another
            </button>
          </div>

          <div className="mt-7 text-stardust/95 text-[24px] tracking-wider2 font-light leading-tight">
            {journey.mood}
          </div>

          <div className="mt-7 h-px w-full bg-stardust/15" />

          <ol className="mt-7 space-y-5">
            {journey.stops.map((stop, i) => (
              <StopRow key={i} index={i} stop={stop} />
            ))}
          </ol>

          <div className="mt-9 h-px w-full bg-stardust/15" />

          <div className="mt-7 flex items-center justify-between">
            <div className="text-stardust/35 text-[10px] tracking-cosmic uppercase">
              Esc 退出 · Leave
            </div>
            <button
              type="button"
              onClick={begin}
              className="px-10 py-3 bg-white/[0.03] hover:bg-white/[0.07] backdrop-blur-md border border-white/25 hover:border-white/55 text-stardust/95 hover:text-stardust text-[11px] tracking-cosmic uppercase font-thin transition-all duration-700 ease-out"
              style={{ boxShadow: '0 0 60px rgba(155,216,255,0.08)' }}
            >
              启程 · Begin Journey ›
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StopRow({ index, stop }: { index: number; stop: JourneyStop }) {
  const targetLabel =
    stop.target.kind === 'planet'
      ? PLANET_LABELS[stop.target.id]
      : SPACECRAFT[stop.target.id].name;
  const targetKindLabel = stop.target.kind === 'planet' ? '行星' : '航天器';
  const film = stop.filmPath ? MOVIES_BY_PATH[stop.filmPath] : null;

  return (
    <li className="flex gap-5">
      <div className="flex-shrink-0 w-10 pt-1">
        <span className="text-stardust/30 text-[10px] tracking-cosmic uppercase tabular-nums">
          0{index + 1}
        </span>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-3">
          <span className="text-stardust/90 text-[15px] tracking-wider2">{targetLabel}</span>
          <span className="text-stardust/30 text-[10px] tracking-cosmic uppercase">
            {targetKindLabel}
          </span>
        </div>
        <p className="mt-2 text-stardust/65 text-[12px] leading-relaxed">{stop.narration}</p>
        {film && (
          <div className="mt-3 flex items-baseline gap-2 text-[11px]">
            <span className="text-stardust/40">推荐</span>
            <span className="text-stardust/85 tracking-wider2">{film.titleZh}</span>
            <span className="text-stardust/25 tabular-nums">{film.year}</span>
          </div>
        )}
      </div>
    </li>
  );
}
