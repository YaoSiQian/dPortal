'use client';

import { useEffect, useRef, useState } from 'react';

import { MOVIES_BY_PATH } from '@/lib/movieInfo';
import { SPACECRAFT } from '@/lib/journeyInventory';
import { PLANET_FACTS } from '@/lib/planetInfo';
import { PLANET_LABELS } from '@/lib/sceneStore';
import type { JourneyStop } from '@/lib/journeyTypes';

// StopCard — per-stop card, bottom-left during the journey.
//
// Two modes:
//   filmPath set    — render the film recommendation (poster + title + meta)
//   filmPath null   — render a "subject card" that just describes the stop's
//                     own subject (the spacecraft / planet) using inventory
//                     data. Same visual frame so the layout stays stable.
//
// Owns its own fade-out → swap → fade-in cycle so old recommendations don't
// visually overlap new ones between stops. Pass `stop: null` to fade out.

const FADE_DURATION_MS = 1200;

type Props = {
  stop: JourneyStop | null;
  index: number;
  total: number;
};

export function StopCard({ stop, index, total }: Props) {
  const [renderedStop, setRenderedStop] = useState<JourneyStop | null>(stop);
  const [visible, setVisible] = useState<boolean>(stop !== null);
  const prevRef = useRef<JourneyStop | null>(stop);

  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = stop;

    if (stop === prev) return;

    if (stop === null) {
      setVisible(false);
      return;
    }

    if (prev === null) {
      setRenderedStop(stop);
      const id = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(id);
    }

    setVisible(false);
    const id = setTimeout(() => {
      setRenderedStop(stop);
      requestAnimationFrame(() => setVisible(true));
    }, FADE_DURATION_MS);
    return () => clearTimeout(id);
  }, [stop]);

  return (
    <div className="absolute bottom-10 left-10 z-30 pointer-events-none">
      <div
        className={`transition-all ease-out ${
          visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
        }`}
        style={{ transitionDuration: `${FADE_DURATION_MS}ms` }}
      >
        {renderedStop && (
          <CardBody stop={renderedStop} index={index} total={total} />
        )}
      </div>
    </div>
  );
}

function CardBody({ stop, index, total }: { stop: JourneyStop; index: number; total: number }) {
  const film = stop.filmPath ? MOVIES_BY_PATH[stop.filmPath] : null;
  const stopLabel = `第 ${String(index + 1).padStart(2, '0')} 站 / ${String(total).padStart(2, '0')}`;

  if (film) {
    return (
      <div
        className="flex gap-4 px-5 py-4 border border-stardust/15 bg-deep/55 backdrop-blur-md w-[360px]"
        style={{ boxShadow: '0 0 50px rgba(155,216,255,0.05)' }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={film.poster}
          alt={film.titleZh}
          className="h-24 w-auto object-contain rounded-sm shadow-[0_0_20px_rgba(155,216,255,0.18)]"
        />
        <div className="flex-1 min-w-0">
          <div className="text-stardust/30 text-[9px] tracking-cosmic uppercase">{stopLabel}</div>
          <div className="mt-1.5 text-stardust/95 text-[15px] tracking-wider2 font-light leading-tight">
            {film.titleZh}
          </div>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-2 text-[9px] text-stardust/40">
            <span className="tracking-cosmic uppercase truncate">{film.titleEn}</span>
            <span className="text-stardust/20">·</span>
            <span className="tabular-nums tracking-wider2">{film.year}</span>
          </div>
        </div>
      </div>
    );
  }

  // No film: fall back to a subject card with the inventory description.
  const subject =
    stop.target.kind === 'planet'
      ? {
          title: PLANET_FACTS[stop.target.id].nameZh,
          subtitle: PLANET_LABELS[stop.target.id],
          tag: '行星',
          description: PLANET_FACTS[stop.target.id].description
        }
      : {
          title: SPACECRAFT[stop.target.id].name,
          subtitle: stop.target.id.replace(/_/g, ' '),
          tag: '航天器',
          description: SPACECRAFT[stop.target.id].description
        };

  return (
    <div
      className="px-5 py-4 border border-stardust/15 bg-deep/55 backdrop-blur-md w-[360px]"
      style={{ boxShadow: '0 0 50px rgba(155,216,255,0.05)' }}
    >
      <div className="flex items-baseline justify-between gap-3">
        <div className="text-stardust/30 text-[9px] tracking-cosmic uppercase">{stopLabel}</div>
        <div className="text-stardust/35 text-[9px] tracking-cosmic uppercase">{subject.tag}</div>
      </div>
      <div className="mt-2 text-stardust/95 text-[15px] tracking-wider2 font-light leading-tight">
        {subject.title}
      </div>
      <div className="mt-1 text-stardust/35 text-[9px] tracking-cosmic uppercase truncate">
        {subject.subtitle}
      </div>
      <div className="mt-2.5 h-px w-full bg-stardust/15" />
      <p className="mt-2.5 text-stardust/65 text-[11px] leading-relaxed">{subject.description}</p>
    </div>
  );
}
