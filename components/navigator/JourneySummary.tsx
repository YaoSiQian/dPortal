'use client';

import { useEffect, useRef, useState } from 'react';
import { toPng } from 'html-to-image';

import { useSceneStore, PLANET_LABELS } from '@/lib/sceneStore';
import { SPACECRAFT } from '@/lib/journeyInventory';
import { MOVIES_BY_PATH } from '@/lib/movieInfo';
import {
  proxiedImageUrl,
  loadWorks,
  loadPointsIndex
} from '@/lib/anime/dataLoader';
import type {
  AnimeWork,
  AnimePoint,
  WorkId,
  PointId
} from '@/lib/anime/types';

// JourneySummary — final card shown after the last stop. Shows the mood
// line, the full itinerary in a poster grid, and the closing line.
//
// Renders for both cultural domains:
//   · scifi : target = planet / spacecraft name; image = film poster
//   · anime : target = work title (zh); image = point image (proxied)
//
// PNG export gotcha: html-to-image clones the node and serializes through
// SVG foreignObject. Each <img> is supposed to be re-fetched and inlined
// internally, but with non-ASCII (Chinese) filenames + same-origin images
// + `cacheBust` query strings, that internal fetch silently fails and the
// poster comes out blank.
//
// The bulletproof fix: build our OWN offscreen clone of the card, fetch
// every image and swap to base64 data URI in the clone, wait for those to
// actually decode, then run toPng on the clone. This sidesteps React's
// async state model and html-to-image's flaky internal fetcher.

async function fetchAsDataUrl(path: string): Promise<string | null> {
  try {
    const res = await fetch(path);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

async function waitForImageLoad(img: HTMLImageElement): Promise<void> {
  if (img.complete && img.naturalWidth > 0) return;
  await new Promise<void>((resolve) => {
    const done = () => {
      img.removeEventListener('load', done);
      img.removeEventListener('error', done);
      resolve();
    };
    img.addEventListener('load', done);
    img.addEventListener('error', done);
  });
}

export function JourneySummary() {
  const {
    domain,
    navigatorPhase,
    journey,
    setNavigatorPhase,
    setJourney,
    animeNavigatorPhase,
    animeJourney,
    setAnimeNavigatorPhase,
    setAnimeJourney
  } = useSceneStore();
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [saving, setSaving] = useState(false);

  // Anime-domain data — only fetched when we're on the anime summary.
  const [animeWorks, setAnimeWorks] = useState<Record<WorkId, AnimeWork> | null>(
    null
  );
  const [animePoints, setAnimePoints] = useState<
    Record<PointId, AnimePoint> | null
  >(null);

  const isScifiSummary =
    domain === 'scifi' && navigatorPhase === 'summary' && !!journey;
  const isAnimeSummary =
    domain === 'anime' && animeNavigatorPhase === 'summary' && !!animeJourney;

  useEffect(() => {
    if (!isAnimeSummary) return;
    let cancelled = false;
    Promise.all([loadWorks(), loadPointsIndex()])
      .then(([w, p]) => {
        if (cancelled) return;
        setAnimeWorks(w);
        setAnimePoints(p);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isAnimeSummary]);

  if (!isScifiSummary && !isAnimeSummary) return null;

  const active = isAnimeSummary ? animeJourney! : journey!;

  const closeAll = () => {
    if (isAnimeSummary) {
      setAnimeNavigatorPhase('closed');
      setAnimeJourney(null);
    } else {
      setNavigatorPhase('closed');
      setJourney(null);
    }
  };

  const savePng = async () => {
    if (!cardRef.current) return;
    setSaving(true);
    let clone: HTMLDivElement | null = null;
    try {
      // 1. Deep-clone the card. Tailwind utility classes still resolve
      //    against the global stylesheet so we don't need to copy styles.
      clone = cardRef.current.cloneNode(true) as HTMLDivElement;
      // Match the original's actual width — the card's max-w + flex parent
      // computed it for us, but the clone won't have the same parent layout.
      const rect = cardRef.current.getBoundingClientRect();
      clone.style.width = `${rect.width}px`;
      // Park it offscreen but inside body so getComputedStyle works.
      clone.style.position = 'fixed';
      clone.style.left = '-99999px';
      clone.style.top = '0px';
      clone.style.pointerEvents = 'none';
      document.body.appendChild(clone);

      // 2. Replace every <img src=…> with a data URI, then wait for that
      //    data URI to fully decode in the cloned <img> element.
      const imgs = Array.from(clone.querySelectorAll('img'));
      await Promise.all(
        imgs.map(async (img) => {
          const src = img.getAttribute('src');
          if (!src || src.startsWith('data:')) return;
          const dataUrl = await fetchAsDataUrl(src);
          if (!dataUrl) return;
          img.setAttribute('src', dataUrl);
          await waitForImageLoad(img);
        })
      );

      // 3. Snapshot the clone. No cacheBust, no crossOrigin — there are
      //    no external requests left for html-to-image to mishandle.
      const dataUrl = await toPng(clone, {
        pixelRatio: 2,
        backgroundColor: '#04060c'
      });

      const link = document.createElement('a');
      link.download = `portal-journey-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
    } catch (e) {
      console.error('Failed to export PNG', e);
    } finally {
      if (clone && clone.parentNode) clone.parentNode.removeChild(clone);
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 pointer-events-auto bg-deep/75 backdrop-blur-md overflow-y-auto">
      <div className="min-h-full w-full flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-6">
          <div
            ref={cardRef}
            className="w-[720px] max-w-[calc(100vw-80px)] bg-deep px-12 py-12 border border-stardust/15"
            style={{ boxShadow: '0 0 100px rgba(155,216,255,0.06)' }}
          >
            {/* Header */}
            <div className="flex items-baseline justify-between">
              <div>
                <div className="text-stardust/85 text-[10px] tracking-cosmic uppercase">
                  界门 · Journey 01
                </div>
                <div className="mt-1 text-stardust/55 text-[12px] tracking-wider2">
                  {isAnimeSummary
                    ? '二次元巡礼路线 · 由你的心境策展'
                    : '科幻观影路线 · 由你的心境策展'}
                </div>
              </div>
              <div className="text-stardust/35 text-[10px] tracking-cosmic uppercase tabular-nums">
                {new Date()
                  .toISOString()
                  .slice(0, 10)
                  .replace(/-/g, ' · ')}
              </div>
            </div>

            <div className="mt-8 h-px w-full bg-stardust/15" />

            {/* Mood title */}
            <div className="mt-8 text-stardust/55 text-[10px] tracking-cosmic uppercase">
              主题
            </div>
            <div className="mt-3 text-stardust/95 text-[34px] tracking-wider2 font-thin leading-tight">
              {active.mood}
            </div>

            <div className="mt-9 h-px w-full bg-stardust/15" />

            {/* Stops grid */}
            <div className="mt-8 text-stardust/55 text-[10px] tracking-cosmic uppercase">
              旅程
            </div>
            <div className="mt-5 grid grid-cols-1 gap-5">
              {active.stops.map((stop, i) => {
                let imgSrc: string | null = null;
                let imgAlt = '';
                let title = '';
                let subtitleParts:
                  | { zh: string; en?: string; year?: number | string }
                  | null = null;
                let kindLabel = '';

                if (isAnimeSummary) {
                  const aStop = stop as {
                    pointId: PointId;
                    narration: string;
                    workId: WorkId | null;
                  };
                  const point = animePoints?.[aStop.pointId];
                  const work =
                    aStop.workId != null ? animeWorks?.[aStop.workId] : null;
                  if (point?.imageUrl) {
                    imgSrc = proxiedImageUrl(point.imageUrl);
                    imgAlt = point.nameZh ?? point.name ?? point.id;
                  }
                  title =
                    work?.titleZh ??
                    work?.titleOrigin ??
                    point?.nameZh ??
                    point?.name ??
                    '动画地点';
                  if (work?.titleOrigin && work.titleOrigin !== title) {
                    subtitleParts = { zh: title, en: work.titleOrigin };
                  }
                  kindLabel = '动画地点';
                } else {
                  const sStop = stop as {
                    target:
                      | { kind: 'planet'; id: keyof typeof PLANET_LABELS }
                      | { kind: 'spacecraft'; id: keyof typeof SPACECRAFT };
                    narration: string;
                    filmPath?: string;
                  };
                  const film = sStop.filmPath
                    ? MOVIES_BY_PATH[sStop.filmPath]
                    : null;
                  title =
                    sStop.target.kind === 'planet'
                      ? PLANET_LABELS[sStop.target.id]
                      : SPACECRAFT[sStop.target.id].name;
                  if (film) {
                    imgSrc = film.poster;
                    imgAlt = film.titleZh;
                    subtitleParts = {
                      zh: film.titleZh,
                      en: film.titleEn,
                      year: film.year
                    };
                  }
                  kindLabel =
                    sStop.target.kind === 'planet' ? '行星' : '航天器';
                }

                return (
                  <div key={i} className="flex gap-5 items-start">
                    {imgSrc ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={imgSrc}
                        alt={imgAlt}
                        className="h-28 w-auto object-contain rounded-sm flex-shrink-0"
                      />
                    ) : (
                      <div className="h-28 w-[78px] flex-shrink-0 border border-stardust/10 flex items-center justify-center text-stardust/25 text-[9px] tracking-cosmic uppercase">
                        暂无
                      </div>
                    )}
                    <div className="flex-1 min-w-0 pt-1">
                      <div className="flex items-baseline gap-3">
                        <span className="text-stardust/30 text-[10px] tracking-cosmic uppercase tabular-nums">
                          0{i + 1}
                        </span>
                        <span className="text-stardust/85 text-[14px] tracking-wider2 font-light">
                          {title}
                        </span>
                        <span className="text-stardust/25 text-[9px] tracking-cosmic uppercase">
                          {kindLabel}
                        </span>
                      </div>
                      <p className="mt-2 text-stardust/70 text-[12px] leading-relaxed">
                        {stop.narration}
                      </p>
                      {subtitleParts && (
                        <div className="mt-2.5 flex items-baseline gap-2 text-[11px]">
                          <span className="text-stardust/90 tracking-wider2">
                            {subtitleParts.zh}
                          </span>
                          {subtitleParts.en && (
                            <>
                              <span className="text-stardust/30">·</span>
                              <span className="text-stardust/40 tracking-cosmic uppercase text-[9px]">
                                {subtitleParts.en}
                              </span>
                            </>
                          )}
                          {subtitleParts.year && (
                            <>
                              <span className="text-stardust/30">·</span>
                              <span className="text-stardust/40 tabular-nums">
                                {subtitleParts.year}
                              </span>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-9 h-px w-full bg-stardust/15" />

            {/* Closing line */}
            <div className="mt-8 text-stardust/90 text-[15px] tracking-wider2 font-thin italic leading-relaxed text-center">
              {active.closing}
            </div>

            <div className="mt-10 flex items-baseline justify-center gap-3 select-none">
              <span className="text-stardust/30 text-[9px] tracking-cosmic uppercase">
                界门 Navigator
              </span>
              <span className="text-stardust/15">·</span>
              <span className="text-stardust/30 text-[9px] tracking-cosmic uppercase">DLC 01</span>
            </div>
          </div>

          {/* Actions — outside the card so they don't end up in the PNG */}
          <div className="flex items-center gap-5">
            <button
              type="button"
              onClick={savePng}
              disabled={saving}
              className="px-8 py-3 bg-white/[0.03] hover:bg-white/[0.07] disabled:hover:bg-white/[0.03] backdrop-blur-md border border-white/25 hover:border-white/55 disabled:border-white/10 text-stardust/95 hover:text-stardust disabled:text-stardust/40 text-[11px] tracking-cosmic uppercase font-thin transition-all duration-700 ease-out"
            >
              {saving ? '渲染中… · Rendering' : '保存为图片 · Save as Image'}
            </button>
            <button
              type="button"
              onClick={closeAll}
              className="px-6 py-3 text-stardust/45 hover:text-stardust/85 text-[10px] tracking-cosmic uppercase transition-colors duration-500"
            >
              关闭 · Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
