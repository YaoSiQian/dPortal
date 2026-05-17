// components/anime/AnimeJourneyOverlay.tsx
// 2D layer mirroring `JourneyController`'s on-screen pieces, but for the
// anime domain. No TTS in MVP (per design doc Out-of-scope).

'use client';

import { useEffect, useRef, useState } from 'react';

import { useSceneStore } from '@/lib/sceneStore';
import { Subtitle } from '@/components/navigator/Subtitle';

// Auto-advance: skip the preview UI in the anime MVP. As soon as we
// have a journey in `previewing`, wait a beat for the user to register
// the load, then start running.
const PREVIEW_TO_RUNNING_MS = 1200;
// Match AnimeJourneyController's SETTLE_MS — wait for the camera to
// land before fading the subtitle in. Keeps the cinematic feel.
const SETTLE_MS = 3000;

export function AnimeJourneyOverlay() {
  const {
    domain,
    animeNavigatorPhase,
    setAnimeNavigatorPhase,
    animeJourney,
    animeJourneyStopIndex,
    setAnimeJourney,
    setAnimeJourneyStopIndex,
    setFocusedAnimePointId,
    setFocused
  } = useSceneStore();

  // MVP: skip the preview UI. As soon as we have a journey in `previewing`,
  // wait a beat for the user to register the load, then start running.
  useEffect(() => {
    if (
      domain !== 'anime' ||
      animeNavigatorPhase !== 'previewing' ||
      !animeJourney
    ) {
      return;
    }
    const id = setTimeout(() => {
      setAnimeNavigatorPhase('running');
    }, PREVIEW_TO_RUNNING_MS);
    return () => clearTimeout(id);
  }, [domain, animeNavigatorPhase, animeJourney, setAnimeNavigatorPhase]);

  // displayActive — hold the subtitle hidden until the camera has had
  // SETTLE_MS to land on the stop. Mirrors the scifi JourneyController
  // pattern (stopTokenRef + setDisplayActive) but simplified (no TTS).
  const [displayActive, setDisplayActive] = useState(false);
  const stopTokenRef = useRef(0);

  useEffect(() => {
    if (
      domain !== 'anime' ||
      animeNavigatorPhase !== 'running' ||
      !animeJourney
    ) {
      setDisplayActive(false);
      return;
    }
    stopTokenRef.current += 1;
    const token = stopTokenRef.current;
    setDisplayActive(false);
    const t = setTimeout(() => {
      if (token !== stopTokenRef.current) return;
      setDisplayActive(true);
    }, SETTLE_MS);
    return () => clearTimeout(t);
  }, [domain, animeNavigatorPhase, animeJourney, animeJourneyStopIndex]);

  const abort = () => {
    stopTokenRef.current += 1;
    setDisplayActive(false);
    setAnimeNavigatorPhase('closed');
    setAnimeJourney(null);
    setAnimeJourneyStopIndex(0);
    setFocusedAnimePointId(null);
    setFocused(null);
  };

  if (domain !== 'anime') return null;
  if (animeNavigatorPhase !== 'running' || !animeJourney) return null;
  const stop = animeJourney.stops[animeJourneyStopIndex];
  if (!stop) return null;

  return (
    <>
      <div className="absolute top-6 right-10 z-30 flex items-center gap-6 pointer-events-auto">
        <div className="text-stardust/40 text-[10px] tracking-cosmic uppercase tabular-nums select-none">
          第 {String(animeJourneyStopIndex + 1).padStart(2, '0')} 站 / {String(animeJourney.stops.length).padStart(2, '0')}
        </div>
        <div className="h-3 w-px bg-stardust/15" />
        <button
          type="button"
          onClick={abort}
          className="text-stardust/30 hover:text-stardust/75 text-[10px] tracking-cosmic uppercase transition-colors duration-300"
        >
          退出 · Exit
        </button>
      </div>

      <Subtitle text={displayActive ? stop.narration : null} />
    </>
  );
}
