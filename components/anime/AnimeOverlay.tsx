'use client';

import { AnimeLODController, useAnimeLod } from './AnimeLODController';
import { AnimeClusterPoints } from './AnimeClusterPoints';
import { AnimePointMarkers } from './AnimePointMarkers';
import { AnimePosterCards } from './AnimePosterCards';
import { useAnimeData } from './useAnimeData';

export function AnimeOverlay() {
  const data = useAnimeData();

  if (data.status !== 'ready') return null;

  return (
    <AnimeLODController>
      <AnimeOverlayLayers />
    </AnimeLODController>
  );
}

function AnimeOverlayLayers() {
  const lod = useAnimeLod();
  const data = useAnimeData();
  if (data.status !== 'ready') return null;

  if (lod === 'far') return <AnimeClusterPoints points={data.points} />;
  if (lod === 'mid') return <AnimePointMarkers points={data.points} />;
  return <AnimePosterCards points={data.points} works={data.works} />;
}
