'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// useSpeechRecognition — thin wrapper around the Web Speech API that
// reports browser support, current listening state, the latest interim
// transcript, and a callback fired with each finalised transcript chunk.
//
// Design notes:
//   · `continuous: true` — recognition keeps running until the user stops
//     it, so they can pause mid-sentence without the session ending.
//   · `interimResults: true` — exposes the live partial transcript so the
//     UI can show what the engine has heard so far.
//   · The hook never mutates the consumer's text state directly — every
//     finalised chunk arrives via `onFinal`, the consumer decides how to
//     append (replace / concat / smart-split, etc.).
//   · Browser support: Chrome / Edge / Safari yes; Firefox needs a flag,
//     so we hide the mic UI entirely when `supported === false`.

export type SpeechRecognitionStatus =
  | 'idle'
  | 'starting'
  | 'listening'
  | 'stopping'
  | 'error';

export type SpeechErrorCode =
  | 'no-speech'
  | 'audio-capture'
  | 'not-allowed'
  | 'network'
  | 'aborted'
  | 'unknown';

type Options = {
  lang?: string;
  /** Fired once for each finalised transcript chunk. */
  onFinal?: (text: string) => void;
};

export function useSpeechRecognition({ lang = 'zh-CN', onFinal }: Options = {}) {
  const [supported, setSupported] = useState(false);
  const [status, setStatus] = useState<SpeechRecognitionStatus>('idle');
  const [interim, setInterim] = useState('');
  const [errorCode, setErrorCode] = useState<SpeechErrorCode | null>(null);

  const recRef = useRef<SpeechRecognition | null>(null);
  // Latest onFinal in a ref so we don't have to re-build the SpeechRecognition
  // every time the consumer's callback identity changes.
  const onFinalRef = useRef<typeof onFinal>(onFinal);
  useEffect(() => {
    onFinalRef.current = onFinal;
  }, [onFinal]);

  // Build the recognition instance once browser features resolve.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Ctor) {
      setSupported(false);
      return;
    }
    setSupported(true);

    const rec = new Ctor();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onresult = (e) => {
      let interimText = '';
      // Only the new results since `resultIndex` are unprocessed.
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i];
        const text = result[0]?.transcript ?? '';
        if (result.isFinal) {
          if (text.trim()) onFinalRef.current?.(text);
        } else {
          interimText += text;
        }
      }
      setInterim(interimText);
    };

    rec.onerror = (e) => {
      const code: SpeechErrorCode =
        e.error === 'no-speech' ||
        e.error === 'audio-capture' ||
        e.error === 'not-allowed' ||
        e.error === 'network' ||
        e.error === 'aborted'
          ? e.error
          : 'unknown';
      setErrorCode(code);
      setStatus('error');
    };

    rec.onstart = () => {
      setErrorCode(null);
      setStatus('listening');
    };

    rec.onend = () => {
      setInterim('');
      setStatus((current) => (current === 'error' ? 'error' : 'idle'));
    };

    recRef.current = rec;
    return () => {
      rec.onresult = null;
      rec.onerror = null;
      rec.onstart = null;
      rec.onend = null;
      try {
        rec.abort();
      } catch {
        /* ignore */
      }
      recRef.current = null;
    };
  }, [lang]);

  const start = useCallback(() => {
    const rec = recRef.current;
    if (!rec) return;
    if (status === 'listening' || status === 'starting') return;
    setErrorCode(null);
    setStatus('starting');
    try {
      rec.start();
    } catch {
      // Recognition can throw "already started" if a previous stop hasn't
      // resolved yet. Reset and surface a benign idle state.
      setStatus('idle');
    }
  }, [status]);

  const stop = useCallback(() => {
    const rec = recRef.current;
    if (!rec) return;
    if (status === 'idle' || status === 'stopping') return;
    setStatus('stopping');
    try {
      rec.stop();
    } catch {
      setStatus('idle');
    }
  }, [status]);

  const toggle = useCallback(() => {
    if (status === 'listening' || status === 'starting') stop();
    else start();
  }, [status, start, stop]);

  return { supported, status, interim, errorCode, start, stop, toggle };
}
