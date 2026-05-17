'use client';

import { useEffect, useRef } from 'react';

import { MOVIES_BY_PATH } from '@/lib/movieInfo';
import { useSceneStore } from '@/lib/sceneStore';

// Cinematic movie detail strip pinned to the bottom of the screen.
// Hairline borders only, no card surface — same visual language as the
// rest of the HUD. Poster thumbnail on the left, Chinese title + meta +
// description on the right. Closes via × or when the focused planet
// changes (so it doesn't linger across context switches).

export function MoviePanel() {
  const { selectedPoster, setSelectedPoster, focused } = useSceneStore();
  const lastPosterRef = useRef(selectedPoster);

  // Keep the last poster so the fade-out animation renders content
  // instead of an empty strip.
  useEffect(() => {
    if (selectedPoster !== null) lastPosterRef.current = selectedPoster;
  }, [selectedPoster]);

  // Auto-close only when the user returns to the system overview
  // (focused → null). Switching from one focused subject to another keeps
  // the panel visible — useful when the user picks a film from the
  // Library and the camera flies to its planet; we want the strip to
  // stay so they can read about the film they just chose.
  useEffect(() => {
    if (focused === null) setSelectedPoster(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focused]);

  const path = selectedPoster ?? lastPosterRef.current;
  const movie = path ? MOVIES_BY_PATH[path] : null;
  const visible = selectedPoster !== null && movie !== null;

  return (
    <div
      className={`absolute bottom-24 left-1/2 -translate-x-1/2 z-20 w-[640px] max-w-[calc(100vw-80px)] transition-opacity duration-500 ease-out ${
        visible ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
    >
      {movie && (
        <div className="relative flex gap-5 px-6 py-5 border-t border-b border-stardust/15 backdrop-blur-md bg-deep/40">
          <button
            type="button"
            onClick={() => setSelectedPoster(null)}
            className="absolute top-2 right-3 text-stardust/40 hover:text-stardust/85 text-xl leading-none transition-colors duration-300"
            aria-label="Close"
          >
            ×
          </button>

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={movie.poster}
            alt={movie.titleZh}
            className="h-32 w-auto object-contain rounded-sm shadow-[0_0_30px_rgba(155,216,255,0.15)]"
          />

          <div className="flex-1 min-w-0 pr-4">
            <a
              href={`https://search.douban.com/movie/subject_search?search_text=${encodeURIComponent(
                movie.titleZh
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex items-baseline gap-2 text-stardust/95 hover:text-stardust transition-colors duration-300"
              title="在豆瓣搜索"
            >
              <span className="text-2xl tracking-wider2 font-light leading-tight border-b border-transparent group-hover:border-stardust/40 transition-colors duration-300">
                {movie.titleZh}
              </span>
              <span className="text-stardust/30 group-hover:text-stardust/75 text-sm transition-colors duration-300">
                ↗
              </span>
            </a>

            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-stardust/45">
              <span className="tracking-cosmic uppercase">{movie.titleEn}</span>
              <span className="text-stardust/25">·</span>
              <span className="tabular-nums tracking-wider2">{movie.year}</span>
              {movie.director && (
                <>
                  <span className="text-stardust/25">·</span>
                  <span className="tracking-wider2">{movie.director}</span>
                </>
              )}
            </div>

            <div className="mt-3 h-px w-full bg-stardust/15" />

            <p className="mt-3 text-stardust/75 text-[12px] leading-relaxed">
              {movie.description}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
