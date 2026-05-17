'use client';

import { useEffect, useState } from 'react';

import { useSceneStore } from '@/lib/sceneStore';
import { loadPointDetail, loadPointsIndex, loadWorks, proxiedImageUrl } from '@/lib/anime/dataLoader';
import type { AnimePoint, AnimePointDetail, AnimeWork } from '@/lib/anime/types';

export function AnimeDetailCard() {
  const { focusedAnimePointId, setFocusedAnimePointId, domain } = useSceneStore();
  const [point, setPoint] = useState<AnimePoint | null>(null);
  const [detail, setDetail] = useState<AnimePointDetail | null>(null);
  const [works, setWorks] = useState<AnimeWork[]>([]);

  useEffect(() => {
    if (!focusedAnimePointId || domain !== 'anime') {
      setPoint(null);
      setDetail(null);
      setWorks([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const [pts, allWorks] = await Promise.all([loadPointsIndex(), loadWorks()]);
      if (cancelled) return;
      const p = pts[focusedAnimePointId] ?? null;
      setPoint(p);
      setWorks(p?.workIds.map((id) => allWorks[id]).filter(Boolean) ?? []);
      const d = await loadPointDetail(focusedAnimePointId);
      if (!cancelled) setDetail(d);
    })().catch(() => {
      if (!cancelled) {
        setPoint(null);
        setDetail(null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [focusedAnimePointId, domain]);

  if (!focusedAnimePointId || domain !== 'anime' || !point) return null;

  return (
    <div className="pointer-events-auto fixed bottom-6 right-6 z-30 w-[360px] max-w-[calc(100vw-48px)] bg-deep/85 backdrop-blur-md border border-stardust/15 px-6 py-5">
      <div className="flex items-baseline justify-between">
        <div className="text-stardust/85 text-[11px] tracking-cosmic uppercase">
          界门 · 巡礼
        </div>
        <button
          type="button"
          onClick={() => setFocusedAnimePointId(null)}
          className="text-stardust/35 hover:text-stardust/85 text-lg leading-none transition-colors"
          aria-label="Close"
        >
          ×
        </button>
      </div>

      {point.imageUrl && (
        <img
          src={proxiedImageUrl(point.imageUrl) ?? ''}
          alt=""
          crossOrigin="anonymous"
          className="mt-4 w-full h-44 object-cover bg-stardust/5"
        />
      )}

      <div className="mt-4 text-stardust text-[15px] tracking-wider2">
        {point.nameZh ?? point.name ?? point.id}
      </div>
      {point.name && point.nameZh && point.name !== point.nameZh && (
        <div className="text-stardust/55 text-[11px] tracking-wider2">{point.name}</div>
      )}

      {detail?.mark && (
        <p className="mt-3 text-stardust/75 text-[12px] tracking-wider2 leading-relaxed">
          {detail.mark}
        </p>
      )}

      {works.length > 0 && (
        <div className="mt-4 border-t border-stardust/10 pt-3">
          <div className="text-stardust/45 text-[10px] tracking-cosmic uppercase mb-2">
            作品 · Works
          </div>
          <ul className="space-y-1">
            {works.map((w) => (
              <li key={w.id} className="text-stardust/85 text-[12px] tracking-wider2">
                {w.titleZh}
                {w.titleOrigin && w.titleOrigin !== w.titleZh && (
                  <span className="text-stardust/45"> · {w.titleOrigin}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {detail?.origin && (
        <div className="mt-3 text-stardust/35 text-[10px] tracking-wider2 leading-relaxed">
          来源：{detail.origin}
        </div>
      )}
    </div>
  );
}
