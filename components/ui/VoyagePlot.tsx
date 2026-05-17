'use client';

import { useState } from 'react';

import { useSceneStore } from '@/lib/sceneStore';

// VoyagePlot — overview-mode entry surface for the two interactive modes:
//   · Explore Freely  — open the right-side Library, free camera control
//   · Navigator        — open the AI mood-input panel
//
// Two visual layouts driven by `hasUsedChoice`:
//   · First time (false) — large hero centered on screen with a
//     recommendation note suggesting Navigator mode. Designed to be the
//     first thing the user reads after the landing intro fades out.
//   · Subsequent (true) — compact pill pair anchored bottom-right so the
//     central 3D scene stays the primary focus.
// `dismissed` is local state that hides the strip after a click, until
// the user returns from focus / journey and the component remounts.

type Props = {
  /** Standard fade-in class from HUD so the buttons appear with the rest
   *  of the cinematic UI on first show. */
  fadeCls: string;
};

export function VoyagePlot({ fadeCls }: Props) {
  const { setNavigatorPhase, setLibraryOpen, hasUsedChoice, setHasUsedChoice } =
    useSceneStore();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const exploreFreely = () => {
    setHasUsedChoice(true);
    setLibraryOpen(true);
    setDismissed(true);
  };
  const openNavigator = () => {
    setHasUsedChoice(true);
    setNavigatorPhase('prompting');
    setDismissed(true);
  };

  // ──────── First-time hero layout ────────
  if (!hasUsedChoice) {
    return (
      <div
        className={`fixed inset-0 z-10 pointer-events-none flex items-center justify-center worlds-fade-in-delayed ${fadeCls}`}
      >
        <div className="pointer-events-auto flex flex-col items-center gap-7 select-none px-10">
          <div className="text-stardust/45 text-[11px] tracking-cosmic uppercase">
            Choose your way · 选择你的方式
          </div>

          <div className="flex items-stretch gap-4">
            <ChoiceButton
              labelEn="Explore Freely"
              labelZh="自主探索"
              hint="拖拽 · 滚轮 · WASD · 右侧资料库"
              onClick={exploreFreely}
            />
            <ChoiceButton
              labelEn="Navigator"
              labelZh="领航员引导"
              hint="系统根据你想探索的故事策展路线"
              glow
              onClick={openNavigator}
            />
          </div>

          <div
            className="mt-2 text-[#9bd8ff]/75 text-[12px] tracking-wider2"
            style={{ textShadow: '0 0 18px rgba(155,216,255,0.18)' }}
          >
            建议开启领航员模式
          </div>
        </div>
      </div>
    );
  }

  // ──────── Subsequent: compact bottom-right pills ────────
  return (
    <div
      className={`fixed bottom-10 right-10 z-10 worlds-fade-in pointer-events-auto ${fadeCls}`}
    >
      <div className="flex items-stretch gap-2.5">
        <CompactPill labelZh="自主探索" labelEn="Explore" onClick={exploreFreely} />
        <CompactPill
          labelZh="领航员"
          labelEn="Navigator"
          glow
          onClick={openNavigator}
        />
      </div>
    </div>
  );
}

// ──────── Subcomponents ────────

type ChoiceProps = {
  labelEn: string;
  labelZh: string;
  hint: string;
  glow?: boolean;
  onClick: () => void;
};

function ChoiceButton({ labelEn, labelZh, hint, glow, onClick }: ChoiceProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group min-w-[260px] px-7 py-4 bg-white/[0.03] hover:bg-white/[0.07] backdrop-blur-md border border-white/15 hover:border-white/40 transition-all duration-700 ease-out text-left"
      style={glow ? { boxShadow: '0 0 60px rgba(155,216,255,0.08)' } : undefined}
    >
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-stardust/95 text-[13px] tracking-cosmic uppercase font-thin">
          {labelEn}
        </span>
        <span className="text-stardust/30 group-hover:text-stardust/85 transition-colors duration-500">
          ›
        </span>
      </div>
      <div className="mt-1 text-stardust/85 text-[12px] tracking-wider2 font-light">
        {labelZh}
      </div>
      <div className="mt-3 text-stardust/30 text-[9px] tracking-wider2 leading-relaxed">
        {hint}
      </div>
    </button>
  );
}

type PillProps = {
  labelZh: string;
  labelEn: string;
  glow?: boolean;
  onClick: () => void;
};

function CompactPill({ labelZh, labelEn, glow, onClick }: PillProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex items-center gap-2.5 px-4 py-2.5 bg-white/[0.03] hover:bg-white/[0.07] backdrop-blur-md border border-white/15 hover:border-white/40 transition-all duration-500 ease-out"
      style={glow ? { boxShadow: '0 0 40px rgba(155,216,255,0.06)' } : undefined}
    >
      <span className="text-stardust/95 text-[12px] tracking-wider2 font-light">
        {labelZh}
      </span>
      <span className="text-stardust/35 text-[9px] tracking-cosmic uppercase">
        {labelEn}
      </span>
      <span className="text-stardust/30 group-hover:text-stardust/85 transition-colors duration-500">
        ›
      </span>
    </button>
  );
}
