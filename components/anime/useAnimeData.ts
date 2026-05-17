'use client';

import { useEffect, useState } from 'react';

import {
  loadManifest,
  loadPointsIndex,
  loadWorks
} from '@/lib/anime/dataLoader';
import type {
  AnimeManifest,
  AnimePoint,
  AnimeWork,
  PointId,
  WorkId
} from '@/lib/anime/types';

export type AnimeDataState =
  | { status: 'loading'; manifest: null; works: null; points: null }
  | { status: 'ready'; manifest: AnimeManifest; works: Record<WorkId, AnimeWork>; points: Record<PointId, AnimePoint> }
  | { status: 'error'; manifest: null; works: null; points: null; error: string };

const INITIAL: AnimeDataState = { status: 'loading', manifest: null, works: null, points: null };

export function useAnimeData(): AnimeDataState {
  const [state, setState] = useState<AnimeDataState>(INITIAL);
  useEffect(() => {
    let cancelled = false;
    Promise.all([loadManifest(), loadWorks(), loadPointsIndex()])
      .then(([manifest, works, points]) => {
        if (cancelled) return;
        setState({ status: 'ready', manifest, works, points });
      })
      .catch((e: Error) => {
        if (cancelled) return;
        setState({
          status: 'error',
          manifest: null,
          works: null,
          points: null,
          error: e.message
        });
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return state;
}
