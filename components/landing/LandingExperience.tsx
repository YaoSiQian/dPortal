'use client';

import { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

import { useSceneStore } from '@/lib/sceneStore';

// LandingExperience — two-stage cinematic opening that sits above the
// main scene until the user crosses the threshold.
//
//   opening      Dark void, slow dust, single line, [ Begin Journey ].
//   imagination  Fragments of human spaceflight drift through the camera
//                corridor. Text + [ Begin Exploration ] button.
//
// Clicking the imagination button flips `introDone`, which fades the
// whole landing wrapper out over EXIT_FADE_MS while the real Solar
// System (mounted underneath) shows through.

type Stage = 'opening' | 'imagination';

const LandingScene = dynamic(
  () => import('./LandingScene').then((m) => m.LandingScene),
  { ssr: false }
);

const EXIT_FADE_MS = 1800;

export function LandingExperience() {
  const { introDone, setIntroDone } = useSceneStore();
  const [stage, setStage] = useState<Stage>('opening');
  const [unmounted, setUnmounted] = useState(false);

  // After the user enters → wait for the exit fade, then unmount entirely
  // so we stop spending GPU on the landing canvas.
  useEffect(() => {
    if (!introDone) return;
    const id = setTimeout(() => setUnmounted(true), EXIT_FADE_MS + 200);
    return () => clearTimeout(id);
  }, [introDone]);

  const onBegin = useCallback(() => setStage('imagination'), []);
  const onEnter = useCallback(() => setIntroDone(true), [setIntroDone]);
  const onSkip = useCallback(() => setIntroDone(true), [setIntroDone]);

  if (unmounted) return null;

  return (
    <div
      className={`fixed inset-0 z-20 transition-opacity ease-out ${
        introDone ? 'opacity-0 pointer-events-none' : 'opacity-100 pointer-events-auto'
      }`}
      style={{ transitionDuration: `${EXIT_FADE_MS}ms` }}
    >
      {/* 3D deep-space backdrop */}
      <div className="absolute inset-0">
        <LandingScene stage={stage} />
      </div>

      {/* Top-bottom hairlines — quiet cinematic framing across all stages */}
      <div className="absolute top-0 left-0 right-0 h-px bg-stardust/8" />
      <div className="absolute bottom-0 left-0 right-0 h-px bg-stardust/8" />

      {/* Skip control — always available, dim until hover */}
      <button
        type="button"
        onClick={onSkip}
        className="absolute top-7 right-10 text-stardust/30 hover:text-stardust/80 text-[10px] tracking-cosmic uppercase transition-colors duration-700"
      >
        跳过 · Skip Intro →
      </button>

      {/* Text overlays — only one mounted at a time so the slow fade-ins
          replay correctly. Buttons inside re-enable pointer events. */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        {stage === 'opening' && <OpeningOverlay onBegin={onBegin} />}
        {stage === 'imagination' && <ImaginationOverlay onEnter={onEnter} />}
      </div>
    </div>
  );
}

// ----------------------------- Overlay primitives --------------------------

const textGlow = { textShadow: '0 0 36px rgba(155,216,255,0.22)' };
const btnGlow = { boxShadow: '0 0 60px rgba(155,216,255,0.06)' };

type FadeProps = {
  show: boolean;
  duration?: number;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
};

function Fade({ show, duration = 2200, children, className = '', style }: FadeProps) {
  return (
    <div
      className={`transition-opacity ease-out ${show ? 'opacity-100' : 'opacity-0'} ${className}`}
      style={{ transitionDuration: `${duration}ms`, ...style }}
    >
      {children}
    </div>
  );
}

function CinematicButton({
  label,
  onClick
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="pointer-events-auto px-14 py-4 bg-white/[0.03] hover:bg-white/[0.07] active:bg-white/[0.09] backdrop-blur-md border border-white/15 hover:border-white/35 text-stardust/85 hover:text-stardust text-[11px] tracking-cosmic uppercase font-thin transition-all duration-1000 ease-out"
      style={btnGlow}
    >
      {label}
    </button>
  );
}

// ----------------------------- Opening overlay -----------------------------

function OpeningOverlay({ onBegin }: { onBegin: () => void }) {
  const [showText, setShowText] = useState(false);
  const [showBtn, setShowBtn] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setShowText(true), 500);
    const t2 = setTimeout(() => setShowBtn(true), 3600);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  return (
    <div className="text-center max-w-[720px] px-10">
      <Fade show={showText} duration={2200}>
        <p
          className="text-stardust/90 font-thin text-[30px] md:text-[34px] leading-[1.45] tracking-wider2"
          style={textGlow}
        >
          Before we reached the stars,
          <br />
          we imagined them for a long time.
        </p>
        <p className="mt-10 text-stardust/50 font-thin text-[15px] leading-loose tracking-wider2">
          在人类抵达星辰之前，
          <br />
          我们已经在幻想中航行了很久。
        </p>
      </Fade>

      <Fade show={showBtn} duration={1600}>
        <div className="mt-20">
          <CinematicButton label="Begin Journey · 启程" onClick={onBegin} />
        </div>
      </Fade>
    </div>
  );
}

// ----------------------------- Imagination overlay -------------------------

function ImaginationOverlay({ onEnter }: { onEnter: () => void }) {
  const [showText, setShowText] = useState(false);
  const [showBtn, setShowBtn] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setShowText(true), 800);
    const t2 = setTimeout(() => setShowBtn(true), 4400);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  return (
    <div className="text-center max-w-[720px] px-10">
      <Fade show={showText} duration={2400}>
        <p
          className="text-stardust/90 font-thin text-[30px] md:text-[34px] leading-[1.45] tracking-wider2"
          style={textGlow}
        >
          Every planet carries
          <br />
          humanity&apos;s imagination.
        </p>
        <p className="mt-10 text-stardust/50 font-thin text-[15px] leading-loose tracking-wider2">
          每一颗行星，
          <br />
          都承载着人类的想象。
        </p>
      </Fade>

      <Fade show={showBtn} duration={1600}>
        <div className="mt-20">
          <CinematicButton label="Begin Exploration · 开始探索" onClick={onEnter} />
        </div>
      </Fade>
    </div>
  );
}
