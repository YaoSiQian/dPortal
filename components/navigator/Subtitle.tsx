'use client';

import { useEffect, useRef, useState } from 'react';

// Subtitle — bottom-center cinematic narration line.
//
// Pass `text: string | null`. The component owns its own fade state:
//   · text changes from null → string         : fade in
//   · text changes from string → null          : fade out (keeps prior text
//                                                rendered during the fade so
//                                                the user doesn't see content
//                                                disappear and a blank shift)
//   · text changes from string A → string B    : fade out A, swap, fade in B
//
// Decoupling fade state from mount lets the parent just pass nullable text
// without coordinating timers — and avoids overlapping subtitles between
// consecutive journey stops.

const FADE_DURATION_MS = 1200;

type Props = { text: string | null };

export function Subtitle({ text }: Props) {
  // What we actually render. Lags behind `text` during fade-out so the
  // outgoing line stays visible while opacity transitions to 0.
  const [renderedText, setRenderedText] = useState<string>(text ?? '');
  const [visible, setVisible] = useState<boolean>(text !== null);
  const prevTextRef = useRef<string | null>(text);

  useEffect(() => {
    const prev = prevTextRef.current;
    prevTextRef.current = text;

    if (text === prev) return;

    if (text === null) {
      // Fade out, leave renderedText alone so the old line ghosts away.
      setVisible(false);
      return;
    }

    if (prev === null) {
      // Coming from nothing — set immediately and fade in on next paint.
      setRenderedText(text);
      // Defer to next frame so the opacity transition has a 0→100 edge.
      const id = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(id);
    }

    // String → string change: fade out the old, swap, fade in the new.
    setVisible(false);
    const id = setTimeout(() => {
      setRenderedText(text);
      requestAnimationFrame(() => setVisible(true));
    }, FADE_DURATION_MS);
    return () => clearTimeout(id);
  }, [text]);

  return (
    <div className="absolute left-1/2 -translate-x-1/2 bottom-32 z-30 pointer-events-none flex flex-col items-center w-[720px] max-w-[calc(100vw-80px)] px-10">
      <div
        className={`transition-opacity ease-out ${visible ? 'opacity-100' : 'opacity-0'}`}
        style={{ transitionDuration: `${FADE_DURATION_MS}ms` }}
      >
        <p
          className="text-stardust/95 font-thin text-[19px] md:text-[21px] leading-[1.65] tracking-wider2 text-center"
          style={{ textShadow: '0 0 32px rgba(155,216,255,0.28)' }}
        >
          {renderedText}
        </p>
      </div>
    </div>
  );
}
