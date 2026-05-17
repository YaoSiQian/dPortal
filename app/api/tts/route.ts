// /api/tts — server-side proxy for OpenAI-compatible /v1/audio/speech.
// Same key-hiding model as /api/journey: the upstream API key never
// reaches the client. The client only POSTs { text, voice } and gets
// back binary audio (mp3) — or a 502 with a message if upstream fails.
//
// In-memory cache keyed by `${voice}::${text}`, so a re-rendered or
// re-played journey doesn't re-bill the same narration. Capped at 100
// entries (FIFO eviction) to avoid runaway memory in long-running dev.

import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const ttsCache = new Map<string, ArrayBuffer>();
const CACHE_LIMIT = 100;

export async function POST(req: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  const baseUrl = process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1';

  if (!apiKey) {
    return NextResponse.json(
      { error: 'API key missing on server' },
      { status: 500 }
    );
  }

  let body: { text?: string; voice?: string; model?: string; speed?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const text = (body.text ?? '').trim();
  const voice = body.voice ?? 'nova';
  const model = body.model ?? 'tts-1';
  // Slightly slower than 1.0 — gives the line more breath and lets the
  // listener catch the cadence. Range 0.25-4.0; the default OpenAI rate
  // (1.0) reads Chinese a touch too briskly for a cinematic narration.
  const speed = typeof body.speed === 'number' ? body.speed : 0.93;

  if (!text) {
    return NextResponse.json({ error: 'text required' }, { status: 400 });
  }
  if (text.length > 500) {
    return NextResponse.json({ error: 'text > 500 chars' }, { status: 400 });
  }

  const cacheKey = `${model}::${voice}::${speed}::${text}`;
  const cached = ttsCache.get(cacheKey);
  if (cached) {
    return new NextResponse(cached, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'public, max-age=86400',
        'X-Cache': 'HIT'
      }
    });
  }

  let upstreamRes: Response;
  try {
    upstreamRes = await fetch(`${baseUrl}/audio/speech`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        voice,
        input: text,
        response_format: 'mp3',
        speed
      })
    });
  } catch (e) {
    return NextResponse.json(
      { error: `Upstream fetch failed: ${(e as Error).message}` },
      { status: 502 }
    );
  }

  if (!upstreamRes.ok) {
    const errText = await upstreamRes.text().catch(() => '');
    return NextResponse.json(
      {
        error: `TTS ${upstreamRes.status}: ${errText.slice(0, 200) || 'no body'}`
      },
      { status: 502 }
    );
  }

  const buf = await upstreamRes.arrayBuffer();

  // FIFO eviction once cache is full.
  if (ttsCache.size >= CACHE_LIMIT) {
    const firstKey = ttsCache.keys().next().value;
    if (firstKey) ttsCache.delete(firstKey);
  }
  ttsCache.set(cacheKey, buf);

  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'audio/mpeg',
      'Cache-Control': 'public, max-age=86400',
      'X-Cache': 'MISS'
    }
  });
}
