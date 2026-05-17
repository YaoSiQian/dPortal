'use client';

import { useEffect, useRef, useState } from 'react';

import { useSceneStore } from '@/lib/sceneStore';
import { SPACECRAFT } from '@/lib/journeyInventory';

import { Subtitle } from './Subtitle';
import { StopCard } from './StopCard';

// JourneyController — drives the running phase of a Journey.
//
// Per stop:
//   1. Aim the camera at the target (planet or spacecraft).
//   2. After CAMERA_SETTLE_MS the subtitle + film card fade in. At the
//      same moment the pre-fetched TTS narration starts playing (unless
//      the user has muted).
//   3. Hold STOP_HOLD_MS, then advance.
//
// TTS handling:
//   · As soon as the journey enters the running phase, all stops'
//     narration text is fetched in parallel from /api/tts. Audio
//     instances are stored in audioRefs keyed by stop index.
//   · Each request is cached server-side, so repeated journeys with
//     overlapping narration don't re-hit the upstream API.
//   · play() failures (autoplay policy / network) are silently ignored —
//     the journey continues with subtitles only.

const CAMERA_SETTLE_MS = 4000;
const STOP_HOLD_MS = 5800;
// Breath time after the narration finishes before moving to the next
// stop. Tuned short so the user feels continuous flow between stops.
const AFTER_AUDIO_BREATH_MS = 600;
const TTS_VOICE = 'nova';

export function JourneyController() {
  const {
    navigatorPhase,
    journey,
    journeyStopIndex,
    setJourneyStopIndex,
    setNavigatorPhase,
    setFocused,
    setFocusedArtifact,
    audioMuted,
    setAudioMuted
  } = useSceneStore();

  const [displayActive, setDisplayActive] = useState(false);
  const stopTokenRef = useRef(0);

  // Map<stopIndex, HTMLAudioElement>. Populated once at journey start;
  // cleared on journey end. Audio elements use blob URLs that we revoke
  // on cleanup to avoid memory leaks.
  const audioRefs = useRef<Map<number, HTMLAudioElement>>(new Map());

  // ──── TTS prefetch on journey enter ────
  useEffect(() => {
    if (navigatorPhase !== 'running' || !journey) return;

    let cancelled = false;
    const localMap = new Map<number, HTMLAudioElement>();

    Promise.all(
      journey.stops.map(async (stop, i) => {
        if (cancelled) return;
        try {
          const res = await fetch('/api/tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: stop.narration, voice: TTS_VOICE })
          });
          if (!res.ok) return;
          const blob = await res.blob();
          if (cancelled) return;
          const url = URL.createObjectURL(blob);
          const audio = new Audio(url);
          audio.preload = 'auto';
          localMap.set(i, audio);
          audioRefs.current.set(i, audio);
        } catch {
          // Silent fail — subtitle still works without audio.
        }
      })
    );

    return () => {
      cancelled = true;
      // Stop and free every audio we created in this session.
      const all = audioRefs.current;
      all.forEach((audio) => {
        try {
          audio.pause();
          audio.removeAttribute('src');
          audio.load();
        } catch {
          /* ignore */
        }
        if (audio.src) URL.revokeObjectURL(audio.src);
      });
      all.clear();
      // Also free anything from this effect that didn't make it into the
      // shared ref yet (edge case if cancel races with a slow fetch).
      localMap.forEach((audio) => {
        try {
          audio.pause();
        } catch {
          /* ignore */
        }
        if (audio.src) URL.revokeObjectURL(audio.src);
      });
    };
  }, [navigatorPhase, journey]);

  // ──── Per-stop scheduler ────
  useEffect(() => {
    if (navigatorPhase !== 'running' || !journey) return;
    const stop = journey.stops[journeyStopIndex];
    if (!stop) return;

    stopTokenRef.current += 1;
    const token = stopTokenRef.current;

    if (stop.target.kind === 'planet') {
      setFocusedArtifact(null);
      setFocused(stop.target.id);
    } else {
      const host = SPACECRAFT[stop.target.id].hostPlanet;
      setFocused(host);
      setFocusedArtifact(stop.target.id);
    }

    setDisplayActive(false);

    const tShow = setTimeout(() => {
      if (token !== stopTokenRef.current) return;
      setDisplayActive(true);
    }, CAMERA_SETTLE_MS);

    // Auto-advance is two-stage so a long narration isn't cut off mid-
    // sentence. At CAMERA_SETTLE_MS + STOP_HOLD_MS we check if the
    // narration audio is still playing; if so, wait for it to end and
    // then add a small breath before advancing. If muted / already
    // finished / no audio, advance straight away.
    let tFollowUp: ReturnType<typeof setTimeout> | null = null;
    const tAdvance = setTimeout(() => {
      if (token !== stopTokenRef.current) return;
      const audio = audioRefs.current.get(journeyStopIndex);
      const stillPlaying =
        audio && !audio.paused && !audio.ended && audio.duration > 0;
      if (stillPlaying) {
        const remainingMs = Math.max(
          0,
          (audio.duration - audio.currentTime) * 1000
        );
        if (remainingMs > 200) {
          tFollowUp = setTimeout(() => {
            if (token !== stopTokenRef.current) return;
            advance();
          }, remainingMs + AFTER_AUDIO_BREATH_MS);
          return;
        }
      }
      advance();
    }, CAMERA_SETTLE_MS + STOP_HOLD_MS);

    return () => {
      clearTimeout(tShow);
      clearTimeout(tAdvance);
      if (tFollowUp) clearTimeout(tFollowUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigatorPhase, journey, journeyStopIndex]);

  // ──── Audio playback follows displayActive ────
  // Plays the current stop's pre-fetched audio when its content fades in;
  // pauses + resets it when the stop ends. Honors the audioMuted toggle.
  useEffect(() => {
    if (!displayActive) return;
    const audio = audioRefs.current.get(journeyStopIndex);
    if (!audio) return;

    if (audioMuted) {
      audio.pause();
      return;
    }

    audio.currentTime = 0;
    audio.play().catch(() => {
      // Autoplay blocked or audio errored — silently fall back to
      // subtitles only.
    });

    return () => {
      try {
        audio.pause();
      } catch {
        /* ignore */
      }
    };
  }, [displayActive, journeyStopIndex, audioMuted]);

  // Clean up scene focus when the journey ends.
  useEffect(() => {
    if (navigatorPhase === 'summary' || navigatorPhase === 'closed') {
      const id = setTimeout(() => {
        setFocusedArtifact(null);
        if (navigatorPhase === 'closed') setFocused(null);
      }, 300);
      return () => clearTimeout(id);
    }
  }, [navigatorPhase, setFocusedArtifact, setFocused]);

  const advance = () => {
    if (!journey) return;
    stopTokenRef.current += 1;

    setDisplayActive(false);

    // Stop the currently playing audio, if any, before moving on.
    const cur = audioRefs.current.get(journeyStopIndex);
    if (cur) {
      try {
        cur.pause();
      } catch {
        /* ignore */
      }
    }

    const next = journeyStopIndex + 1;
    if (next >= journey.stops.length) {
      setNavigatorPhase('summary');
      return;
    }
    setJourneyStopIndex(next);
  };

  const abort = () => {
    stopTokenRef.current += 1;
    setDisplayActive(false);
    setNavigatorPhase('closed');
  };

  if (navigatorPhase !== 'running' || !journey) return null;
  const stop = journey.stops[journeyStopIndex];
  if (!stop) return null;

  return (
    <>
      <div className="absolute top-6 right-10 z-30 flex items-center gap-6 pointer-events-auto">
        <div className="text-stardust/40 text-[10px] tracking-cosmic uppercase tabular-nums select-none">
          第 {String(journeyStopIndex + 1).padStart(2, '0')} 站 / {String(journey.stops.length).padStart(2, '0')}
        </div>
        <div className="h-3 w-px bg-stardust/15" />
        <MuteToggle muted={audioMuted} onToggle={() => setAudioMuted(!audioMuted)} />
        <div className="h-3 w-px bg-stardust/15" />
        <button
          type="button"
          onClick={advance}
          className="text-stardust/45 hover:text-stardust/95 text-[10px] tracking-cosmic uppercase transition-colors duration-300"
        >
          下一站 · Next ›
        </button>
        <button
          type="button"
          onClick={abort}
          className="text-stardust/30 hover:text-stardust/75 text-[10px] tracking-cosmic uppercase transition-colors duration-300"
        >
          退出 · Exit
        </button>
      </div>

      <Subtitle text={displayActive ? stop.narration : null} />
      <StopCard
        stop={displayActive ? stop : null}
        index={journeyStopIndex}
        total={journey.stops.length}
      />
    </>
  );
}

// ──── MuteToggle ────

function MuteToggle({ muted, onToggle }: { muted: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      title={muted ? '开启旁白 · Unmute' : '关闭旁白 · Mute'}
      aria-label={muted ? 'Unmute narration' : 'Mute narration'}
      className={`flex items-center gap-2 transition-colors duration-300 ${
        muted
          ? 'text-stardust/30 hover:text-stardust/65'
          : 'text-stardust/55 hover:text-stardust/95'
      }`}
    >
      <SpeakerGlyph muted={muted} />
      <span className="text-[10px] tracking-cosmic uppercase">
        {muted ? '已静音' : '旁白'}
      </span>
    </button>
  );
}

function SpeakerGlyph({ muted }: { muted: boolean }) {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 13 13"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 5v3h2l3 2.5v-8L4 5H2z" />
      {muted ? (
        <>
          <line x1="9" y1="4.5" x2="12" y2="8" />
          <line x1="12" y1="4.5" x2="9" y2="8" />
        </>
      ) : (
        <>
          <path d="M9 4.5a3 3 0 0 1 0 4" />
          <path d="M10.5 3a5 5 0 0 1 0 7" opacity="0.6" />
        </>
      )}
    </svg>
  );
}
