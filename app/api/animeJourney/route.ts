// app/api/animeJourney/route.ts
// AI route planner for the anime cultural domain. Mirrors the shape
// of /api/journey but uses anitabi point ids and a domain-specific
// system prompt. Pipeline:
//   user query
//     → load search.index.json + points_index.json + works.min.json
//     → token-overlap scorer picks top-50 candidates
//     → LLM picks 4-6 stops from candidates
//     → strict server-side validation (every pointId / workId)
//     → sanitised AnimeJourney back to client.
//
// Why server-side: the OpenAI key never leaves the server, same as
// /api/journey. We also need the data pack on the server so the
// LLM only sees the candidate slice (LLM context is finite).

import fs from 'node:fs/promises';
import path from 'node:path';

import { NextResponse } from 'next/server';

import type {
  AnimeJourney,
  AnimeJourneyApiResponse,
  AnimeStop
} from '@/lib/anime/animeJourneyTypes';
import type {
  AnimePoint,
  AnimeSearchIndex,
  AnimeWork,
  PointId,
  WorkId
} from '@/lib/anime/types';
import { selectCandidates } from '@/lib/anime/searchClient';

export const runtime = 'nodejs';

const PACK_DIR = path.resolve('public/data/anime/anitabi');

const SYSTEM_PROMPT = `你是 界门 Portal · 二次元巡礼策展人。
用户告诉你 ta 想探索的主题/作品/地点,你的任务是从下方候选地标里策展一条 4-6 站的路线。

【候选地标】(只能从这份清单里选)
{CANDIDATES}

【输出格式·严格 JSON】
{
  "mood": "8-14 个汉字总结用户想探索的主题",
  "stops": [
    {
      "pointId": "上方候选 id",
      "narration": "1-2 句中文电影感旁白,30-60 字。叙述对象必须就是这一站本身——这个地名/这处地标,不要泛泛谈论城市或作品。**这段文字会被女声朗读**,使用全角中文标点(,。、——),在 8-15 字处自然换气;一句话不要超过 20 字",
      "workId": "数字或 null,优先选与用户主题最共振的作品"
    }
  ],
  "closing": "1 句结语,20 字内"
}

【规则】
1. stops 必须 4-6 站,不能多也不能少
2. **不允许导游词**: 禁止"让我们""出发""开始我们的旅程"等
3. 旁白的叙述主体必须是这一站的具体地点
4. workId 若给出,必须出现在该 pointId 对应的 workIds 列表里 (候选清单中已标注)
5. 严格输出 JSON,不要 markdown 代码块,不要任何解释`;

type LLMStop = { pointId?: string; narration?: string; workId?: number | null };
type LLMResponse = { mood?: string; stops?: LLMStop[]; closing?: string };

async function readPack() {
  const [pointsRaw, worksRaw, searchRaw] = await Promise.all([
    fs.readFile(path.join(PACK_DIR, 'points_index.json'), 'utf8'),
    fs.readFile(path.join(PACK_DIR, 'works.min.json'), 'utf8'),
    fs.readFile(path.join(PACK_DIR, 'search.index.json'), 'utf8')
  ]);
  return {
    points: JSON.parse(pointsRaw) as Record<PointId, AnimePoint>,
    works: JSON.parse(worksRaw) as Record<WorkId, AnimeWork>,
    search: JSON.parse(searchRaw) as AnimeSearchIndex
  };
}

function buildCandidateBlock(
  ids: PointId[],
  points: Record<PointId, AnimePoint>,
  works: Record<WorkId, AnimeWork>
): string {
  return ids
    .map((id) => {
      const p = points[id];
      if (!p) return '';
      const wTitles = p.workIds
        .map((wid) => works[wid]?.titleZh)
        .filter(Boolean)
        .slice(0, 3)
        .join(' / ');
      const name = p.nameZh ?? p.name ?? id;
      return `  - ${id} (${name}) workIds=[${p.workIds.join(',')}] · 作品: ${wTitles}`;
    })
    .filter(Boolean)
    .join('\n');
}

export async function POST(req: Request): Promise<NextResponse<AnimeJourneyApiResponse>> {
  const apiKey = process.env.OPENAI_API_KEY;
  const baseUrl = process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1';
  const model = process.env.NAVIGATOR_MODEL ?? 'gpt-4o';

  if (!apiKey) {
    return NextResponse.json(
      { ok: false, error: 'API key missing on server' },
      { status: 500 }
    );
  }

  let body: { mood?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
  }
  const mood = (body.mood ?? '').trim();
  if (!mood || mood.length > 300) {
    return NextResponse.json(
      { ok: false, error: 'mood must be 1-300 chars' },
      { status: 400 }
    );
  }

  let pack: Awaited<ReturnType<typeof readPack>>;
  try {
    pack = await readPack();
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: `Data pack missing: ${(e as Error).message}` },
      { status: 500 }
    );
  }

  const candidates = selectCandidates(mood, pack.search, 50);
  // Fallback: if scorer found nothing (rare query), seed with the
  // first 50 most-cross-referenced points. This prevents an empty
  // candidate list from making the LLM hallucinate.
  const finalCandidates =
    candidates.length > 0
      ? candidates
      : Object.values(pack.points)
          .sort((a, b) => b.workIds.length - a.workIds.length)
          .slice(0, 50)
          .map((p) => p.id);

  const candidateBlock = buildCandidateBlock(finalCandidates, pack.points, pack.works);
  const systemPrompt = SYSTEM_PROMPT.replace('{CANDIDATES}', candidateBlock);

  let upstream: Response;
  try {
    upstream = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        response_format: { type: 'json_object' },
        temperature: 0.85,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: mood }
        ]
      })
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: `Upstream fetch failed: ${(e as Error).message}` },
      { status: 502 }
    );
  }
  if (!upstream.ok) {
    const text = await upstream.text().catch(() => '');
    return NextResponse.json(
      { ok: false, error: `LLM ${upstream.status}: ${text.slice(0, 200)}` },
      { status: 502 }
    );
  }

  let raw: { choices?: Array<{ message?: { content?: string } }> };
  try {
    raw = await upstream.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Upstream returned non-JSON' },
      { status: 502 }
    );
  }
  const content = raw.choices?.[0]?.message?.content;
  if (typeof content !== 'string') {
    return NextResponse.json(
      { ok: false, error: 'Upstream missing content' },
      { status: 502 }
    );
  }
  const stripped = content
    .trim()
    .replace(/^```(?:json)?\s*/, '')
    .replace(/```\s*$/, '');
  let parsed: LLMResponse;
  try {
    parsed = JSON.parse(stripped);
  } catch {
    return NextResponse.json(
      { ok: false, error: `LLM returned non-JSON: ${stripped.slice(0, 120)}` },
      { status: 502 }
    );
  }

  const validated = validateAnimeJourney(parsed, pack.points, pack.works);
  if (!validated.ok) {
    return NextResponse.json({ ok: false, error: validated.error }, { status: 502 });
  }
  return NextResponse.json({ ok: true, journey: validated.journey });
}

function validateAnimeJourney(
  raw: LLMResponse,
  points: Record<PointId, AnimePoint>,
  works: Record<WorkId, AnimeWork>
): { ok: true; journey: AnimeJourney } | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'not an object' };
  const mood = typeof raw.mood === 'string' ? raw.mood.trim() : '';
  if (!mood) return { ok: false, error: 'missing mood' };
  const closing = typeof raw.closing === 'string' ? raw.closing.trim() : '';
  if (!closing) return { ok: false, error: 'missing closing' };
  if (!Array.isArray(raw.stops) || raw.stops.length < 4 || raw.stops.length > 6) {
    return { ok: false, error: 'stops must be a 4-6 entry array' };
  }

  const stops: AnimeStop[] = [];
  const seenPoints = new Set<string>();
  for (const s of raw.stops) {
    const narration = typeof s.narration === 'string' ? s.narration.trim() : '';
    const pointId = typeof s.pointId === 'string' ? s.pointId.trim() : '';
    if (!narration) return { ok: false, error: 'stop missing narration' };
    if (!points[pointId]) return { ok: false, error: `unknown pointId: ${pointId}` };
    if (seenPoints.has(pointId)) return { ok: false, error: `duplicate pointId: ${pointId}` };
    // No tour-guide phrases — same constraint as /api/journey.
    if (/(让我们|出发|开始我们的旅程)/.test(narration)) {
      return { ok: false, error: 'narration contains forbidden tour-guide phrase' };
    }
    seenPoints.add(pointId);

    let workId: WorkId | null = null;
    if (typeof s.workId === 'number') {
      if (!works[s.workId]) return { ok: false, error: `unknown workId: ${s.workId}` };
      if (!points[pointId].workIds.includes(s.workId)) {
        return {
          ok: false,
          error: `workId ${s.workId} not associated with pointId ${pointId}`
        };
      }
      workId = s.workId;
    }
    stops.push({ pointId, narration, workId });
  }

  return { ok: true, journey: { mood, stops, closing } };
}
