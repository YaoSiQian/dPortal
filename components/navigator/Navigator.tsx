'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { useSceneStore } from '@/lib/sceneStore';
import { useSpeechRecognition, type SpeechErrorCode } from '@/lib/useSpeechRecognition';
import type { JourneyApiResponse } from '@/lib/journeyTypes';
import type { AnimeJourneyApiResponse } from '@/lib/anime/animeJourneyTypes';

// Navigator — the entry surface for the AI Journey feature.
//
// ⌘K (or Ctrl+K) toggles the panel open / closed. The textarea accepts a
// free-form mood / theme, posts to /api/journey, and on success transitions
// the global navigatorPhase from 'prompting' → 'loading' → 'previewing' so
// the JourneyPreview component can take over.
//
// Esc closes the panel. We disable orbit controls while open (the panel
// captures pointer events anyway).

const ANIME_PLACEHOLDERS = [
  '想去秩父巡礼…',
  '想看东京塔和咖啡馆相关的地标',
  '《你的名字》取景地',
  '想找京都的动画地点',
  '夏日祭典的地标',
  '海边小镇巡礼'
];

const PLACEHOLDERS = [
  '想看人类幻想中回家的旅程…',
  '对深空孤独的故事感兴趣',
  '想了解人类对外星生命的想象',
  '想感受宇宙尺度下的渺小与敬畏',
  '时间错乱的宇宙故事',
  '人类离开太阳系的故事'
];

export function Navigator() {
  const {
    navigatorPhase,
    setNavigatorPhase,
    setJourney,
    setJourneyStopIndex,
    introDone,
    domain,
    setAnimeNavigatorPhase,
    setAnimeJourney,
    setAnimeJourneyStopIndex
  } = useSceneStore();

  const [mood, setMood] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const currentPlaceholders = domain === 'anime' ? ANIME_PLACEHOLDERS : PLACEHOLDERS;

  // Voice dictation. Each finalised chunk is appended to the current mood
  // (with a space separator if mood already has content). The interim
  // transcript is shown inside the textarea — but rendered, not stored,
  // so it doesn't pollute the actual mood string.
  const handleFinalTranscript = useCallback((text: string) => {
    setMood((prev) => {
      const trimmed = text.trim();
      if (!trimmed) return prev;
      const sep = prev && !prev.endsWith(' ') && !prev.endsWith('\n') ? ' ' : '';
      const next = prev + sep + trimmed;
      // Respect the same maxLength the textarea enforces.
      return next.length > 280 ? next.slice(0, 280) : next;
    });
  }, []);

  const speech = useSpeechRecognition({
    lang: 'zh-CN',
    onFinal: handleFinalTranscript
  });

  // ⌘K / Ctrl+K toggles open. Esc closes. Only active after the landing
  // intro is dismissed, so the Navigator can't fight the LandingExperience.
  useEffect(() => {
    if (!introDone) return;
    const onKey = (e: KeyboardEvent) => {
      const isMeta = e.metaKey || e.ctrlKey;
      if (isMeta && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (navigatorPhase === 'closed') {
          setNavigatorPhase('prompting');
        } else if (
          navigatorPhase === 'prompting' ||
          navigatorPhase === 'previewing'
        ) {
          setNavigatorPhase('closed');
        }
      } else if (e.key === 'Escape' && navigatorPhase !== 'closed') {
        e.preventDefault();
        if (navigatorPhase === 'running') return; // running needs its own exit
        setNavigatorPhase('closed');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [introDone, navigatorPhase, setNavigatorPhase]);

  // Focus the input when the panel opens
  useEffect(() => {
    if (navigatorPhase === 'prompting') {
      const id = setTimeout(() => textareaRef.current?.focus(), 100);
      return () => clearTimeout(id);
    }
  }, [navigatorPhase]);

  // Rotate placeholder while prompting
  useEffect(() => {
    if (navigatorPhase !== 'prompting') return;
    const id = setInterval(() => {
      setPlaceholderIdx((i) => (i + 1) % currentPlaceholders.length);
    }, 3500);
    return () => clearInterval(id);
  }, [navigatorPhase, currentPlaceholders.length]);

  const submit = async () => {
    const trimmed = mood.trim();
    if (!trimmed) return;
    if (speech.status === 'listening' || speech.status === 'starting') {
      speech.stop();
    }
    setError(null);

    if (domain === 'anime') {
      setAnimeNavigatorPhase('loading');
      try {
        const res = await fetch('/api/animeJourney', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mood: trimmed })
        });
        const data: AnimeJourneyApiResponse = await res.json();
        if (!data.ok) {
          setError(data.error ?? '领航员遇到问题 · Navigator failed');
          setAnimeNavigatorPhase('prompting');
          return;
        }
        setAnimeJourney(data.journey);
        setAnimeJourneyStopIndex(0);
        setAnimeNavigatorPhase('previewing');
        // Also flip the legacy phase to 'closed' so the fullscreen
        // panel UI dismisses (it reads `navigatorPhase` for visibility).
        setNavigatorPhase('closed');
      } catch (e) {
        setError(`网络异常 · Network error: ${(e as Error).message}`);
        setAnimeNavigatorPhase('prompting');
      }
      return;
    }

    // existing scifi branch
    setNavigatorPhase('loading');
    try {
      const res = await fetch('/api/journey', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mood: trimmed })
      });
      const data: JourneyApiResponse = await res.json();
      if (!data.ok) {
        setError(data.error ?? '领航员遇到问题 · Navigator failed');
        setNavigatorPhase('prompting');
        return;
      }
      setJourney(data.journey);
      setJourneyStopIndex(0);
      setNavigatorPhase('previewing');
    } catch (e) {
      setError(`网络异常 · Network error: ${(e as Error).message}`);
      setNavigatorPhase('prompting');
    }
  };

  const close = () => {
    if (speech.status === 'listening' || speech.status === 'starting') {
      speech.stop();
    }
    setNavigatorPhase('closed');
    setError(null);
  };

  const isPrompting = navigatorPhase === 'prompting';
  const isLoading = navigatorPhase === 'loading';
  const visible = isPrompting || isLoading;

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-40 pointer-events-auto bg-deep/55 backdrop-blur-sm">
      <button
        type="button"
        onClick={close}
        aria-label="Close Navigator"
        className="absolute inset-0 cursor-default"
      />

      <div className="relative w-full h-full flex items-center justify-center">
        <div
          className="relative w-[560px] max-w-[calc(100vw-80px)] bg-deep/85 backdrop-blur-md border border-stardust/15 px-10 py-9"
          style={{ boxShadow: '0 0 80px rgba(155,216,255,0.06)' }}
        >
          <div className="flex items-baseline justify-between">
            <div className="text-stardust/85 text-[11px] tracking-cosmic uppercase">
              界门 · Navigator
            </div>
            <button
              type="button"
              onClick={close}
              className="text-stardust/35 hover:text-stardust/85 text-lg leading-none transition-colors duration-300"
              aria-label="Close"
            >
              ×
            </button>
          </div>

          <div className="mt-2 text-stardust/40 text-[10px] tracking-wider2 uppercase">
            What cosmic story would you like curated
          </div>
          <div className="mt-1.5 text-stardust/30 text-[12px] tracking-wider2 leading-relaxed">
            你想探索人类关于宇宙的什么幻想？为你策展一段太空路线
          </div>

          <div className="mt-7 h-px w-full bg-stardust/15" />

          {/* Textarea with optional interim transcript ghosted underneath */}
          <div className="relative mt-6">
            <textarea
              ref={textareaRef}
              value={mood}
              onChange={(e) => setMood(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  submit();
                }
              }}
              disabled={isLoading}
              placeholder={currentPlaceholders[placeholderIdx % currentPlaceholders.length]}
              maxLength={280}
              rows={3}
              className="w-full bg-transparent text-stardust/95 placeholder:text-stardust/25 text-[15px] tracking-wider2 leading-relaxed font-light resize-none focus:outline-none disabled:opacity-50"
            />
            {/* Live interim transcript while listening — appears below the
                textarea in the same column so the user sees what the
                recogniser has heard but hasn't finalised yet. */}
            {speech.interim && (
              <div className="mt-1 text-stardust/45 text-[13px] tracking-wider2 leading-relaxed font-light italic">
                {speech.interim}
              </div>
            )}
          </div>

          <div className="mt-2 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {speech.supported && (
                <MicButton
                  status={speech.status}
                  errorCode={speech.errorCode}
                  onToggle={speech.toggle}
                  disabled={isLoading}
                />
              )}
              <span className="text-stardust/25 text-[10px] tracking-cosmic uppercase">
                {mood.length}/280
              </span>
            </div>
            <span className="text-stardust/25 text-[10px] tracking-cosmic uppercase">
              ⌘ ⏎ 提交 · Submit
            </span>
          </div>

          {error && (
            <div className="mt-4 px-3 py-2 border border-rose-300/25 bg-rose-300/[0.04]">
              <div className="text-rose-200/75 text-[10px] tracking-wider2 leading-relaxed">
                {error}
              </div>
            </div>
          )}

          {speech.errorCode && (
            <div className="mt-4 px-3 py-2 border border-amber-300/25 bg-amber-300/[0.04]">
              <div className="text-amber-200/75 text-[10px] tracking-wider2 leading-relaxed">
                {speechErrorMessage(speech.errorCode)}
              </div>
            </div>
          )}

          <div className="mt-7 h-px w-full bg-stardust/15" />

          <div className="mt-7 flex items-center justify-between">
            <div className="text-stardust/30 text-[10px] tracking-cosmic uppercase">
              {isLoading ? '领航员规划中… · Plotting' : 'Esc 取消 · Cancel'}
            </div>

            <button
              type="button"
              onClick={submit}
              disabled={!mood.trim() || isLoading}
              className="px-8 py-3 bg-white/[0.03] hover:bg-white/[0.07] disabled:hover:bg-white/[0.03] backdrop-blur-md border border-white/20 hover:border-white/45 disabled:border-white/8 text-stardust/90 hover:text-stardust disabled:text-stardust/30 text-[11px] tracking-cosmic uppercase font-thin transition-all duration-700 ease-out disabled:cursor-not-allowed"
            >
              {isLoading ? '规划中…' : '规划旅程 · Plot Journey'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// MicButton — circular toggle that pulses cyan while listening. Hidden
// entirely if the browser doesn't expose Web Speech, so feature detection
// happens above this component.

type MicProps = {
  status: 'idle' | 'starting' | 'listening' | 'stopping' | 'error';
  errorCode: SpeechErrorCode | null;
  onToggle: () => void;
  disabled?: boolean;
};

function MicButton({ status, errorCode, onToggle, disabled }: MicProps) {
  const active = status === 'listening' || status === 'starting';
  const label = active
    ? 'Stop dictation'
    : errorCode
      ? 'Retry voice input'
      : 'Voice input';

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`relative flex items-center justify-center w-7 h-7 rounded-full border transition-all duration-500 ease-out disabled:opacity-30 disabled:cursor-not-allowed ${
        active
          ? 'border-[#9bd8ff]/70 bg-[#9bd8ff]/10 text-[#9bd8ff]'
          : errorCode
            ? 'border-amber-300/35 text-amber-200/70 hover:border-amber-300/65'
            : 'border-stardust/25 text-stardust/55 hover:border-stardust/55 hover:text-stardust/85'
      }`}
    >
      {/* Pulsing halo while listening */}
      {active && (
        <span
          aria-hidden
          className="absolute inset-0 rounded-full animate-ping bg-[#9bd8ff]/15"
        />
      )}
      <MicGlyph />
    </button>
  );
}

function MicGlyph() {
  return (
    <svg
      width="11"
      height="14"
      viewBox="0 0 11 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="1" width="5" height="8" rx="2.5" />
      <path d="M1 7v0a4.5 4.5 0 0 0 9 0" />
      <line x1="5.5" y1="11.5" x2="5.5" y2="13" />
      <line x1="3.5" y1="13" x2="7.5" y2="13" />
    </svg>
  );
}

function speechErrorMessage(code: SpeechErrorCode): string {
  switch (code) {
    case 'not-allowed':
      return '麦克风权限被拒绝。请在浏览器地址栏给本站启用麦克风,然后再试。';
    case 'audio-capture':
      return '没找到可用的麦克风设备。';
    case 'no-speech':
      return '没听到声音,可以再说一遍。';
    case 'network':
      return '语音识别服务网络异常,稍后重试。';
    case 'aborted':
      return '语音输入已取消。';
    default:
      return '语音识别遇到问题,稍后再试。';
  }
}
