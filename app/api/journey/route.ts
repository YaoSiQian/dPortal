// /api/journey — server-side proxy for the AI Navigator. Takes the user's
// mood, asks the LLM to plan a 4-5 stop cinematic tour, validates the
// response against journeyInventory, returns a sanitised Journey.
//
// Why server-side: the upstream key sits in .env.local and must never
// reach the browser. The client only ever sees the validated Journey JSON.

import { NextResponse } from 'next/server';

import {
  buildFilmsBlock,
  buildPlanetsBlock,
  buildSpacecraftBlock,
  isValidFilmPath,
  isValidPlanetId,
  isValidSpacecraftId
} from '@/lib/journeyInventory';
import type { Journey, JourneyApiResponse, JourneyStop } from '@/lib/journeyTypes';

export const runtime = 'nodejs';

const SYSTEM_PROMPT = `你是 界门 Portal Navigator——一个沉浸式 3D 太阳系体验里的 AI 策展人。
用户告诉你 ta 想探索什么样的太空故事 / 幻想 / 主题,你的任务是根据这个主题,从下方"可去之地"和"可看之作"里策展一条 4-5 站的电影感路线。

【可去之地·行星】
{PLANETS}

【可去之地·人类航天器】
{SPACECRAFT}

【可看之作·科幻片清单】(只能从这份清单里选,不要捏造)
{FILMS}

【输出格式·严格 JSON】
{
  "mood": "8-14 个汉字总结用户想探索的主题",
  "stops": [
    {
      "target": { "kind": "planet" | "spacecraft", "id": "上方列表里的 id" },
      "narration": "1-2 句中文电影感旁白,30-60 字,Villeneuve / 诺兰 / 库布里克的克制诗意,不要陈词滥调。叙述对象必须就是这一站的主体(该航天器 / 该行星 / 该卫星),不要泛泛谈论宇宙。**这段文字会被女声朗读出来**,所以请使用全角中文标点(,。、——),在 8-15 字处自然换气;一句话不要超过 20 字,长则用句号 / 破折号断开",
      "filmPath": "上方清单里贴合这一站主体的电影路径,或者 null"
    }
  ],
  "closing": "1 句结语,20 字内,落在路线最后一站之后"
}

【路线构造规则】
1. stops 必须 4-5 站,不能多也不能少
2. **第一站必须是地球附近**——从 [earth, moon, iss, hubble, apollo_lm, lro] 中选一个。
   这是用户离开家的瞬间,必须是熟悉的起点。
3. **整条路线方向是"由近及远"**——按"从地球向外推进"的顺序展开站点:
   earth/moon 圈 → mars 圈 → jupiter → saturn → uranus → neptune → 深空 voyager_1。
   水星金星可以作为主题上的"反向回望",但不要打乱主轴。
4. **filmPath 必须同时满足两条:**
   (a) **主体相关**: 真正讲到这一站的主体本身——该航天器的真实任务,或该行星 / 该卫星表面发生的故事。仅仅"科幻片""设在外太空"不算。
   (b) **主题共振**: 这部电影的【主题】标签或简介,与用户想探索的故事 / 幻想 / 主题有明显共振。例如用户说"想探索回家的故事",优先匹配主题里有"回家 / 求生 / 现代奥德赛"的电影;用户说"宇宙尺度的敬畏",优先匹配"史诗 / 宇宙尺度 / 敬畏"。
   两条任一不达标,就把 filmPath 设为 null。**宁可少推也不要硬塞**——这是一次为这位用户量身定制的路线,推荐质量比数量重要。一次路线里 5 站可能只有 2 站真正合适推电影,这是正常的。
5. 不重复推荐同一部电影
6. 至少 1 站是航天器(spacecraft),给视觉变化
7. 旁白禁止出现"让我们""出发""开始我们的旅程"等导游词
8. 路线像一条主题展开的曲线,有起点(家)、有递进(向外)、有收束(深空 / 结语)
9. 严格输出 JSON,不要 markdown 代码块,不要任何解释`;

type LLMStop = {
  target?: { kind?: string; id?: string };
  narration?: string;
  filmPath?: string | null;
};

type LLMResponse = {
  mood?: string;
  stops?: LLMStop[];
  closing?: string;
};

export async function POST(req: Request): Promise<NextResponse<JourneyApiResponse>> {
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

  const systemPrompt = SYSTEM_PROMPT.replace('{PLANETS}', buildPlanetsBlock())
    .replace('{SPACECRAFT}', buildSpacecraftBlock())
    .replace('{FILMS}', buildFilmsBlock());

  let upstreamRes: Response;
  try {
    upstreamRes = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        // Force the model into JSON-only mode where supported. Cheap
        // insurance against markdown fences / preface text.
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

  if (!upstreamRes.ok) {
    const text = await upstreamRes.text().catch(() => '');
    return NextResponse.json(
      {
        ok: false,
        error: `LLM ${upstreamRes.status}: ${text.slice(0, 200) || 'no body'}`
      },
      { status: 502 }
    );
  }

  let raw: { choices?: Array<{ message?: { content?: string } }> };
  try {
    raw = await upstreamRes.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Upstream returned non-JSON' },
      { status: 502 }
    );
  }

  const content = raw.choices?.[0]?.message?.content;
  if (typeof content !== 'string') {
    return NextResponse.json(
      { ok: false, error: 'Upstream response missing content' },
      { status: 502 }
    );
  }

  // Some providers still wrap JSON in markdown fences even with json_object
  // mode requested. Strip them before parsing.
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

  const validated = validateJourney(parsed);
  if (!validated.ok) {
    return NextResponse.json({ ok: false, error: validated.error }, { status: 502 });
  }

  return NextResponse.json({ ok: true, journey: validated.journey });
}

function validateJourney(
  raw: LLMResponse
): { ok: true; journey: Journey } | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, error: 'Journey is not an object' };
  }
  const mood = typeof raw.mood === 'string' ? raw.mood.trim() : '';
  if (!mood) return { ok: false, error: 'Missing mood' };

  const closing = typeof raw.closing === 'string' ? raw.closing.trim() : '';
  if (!closing) return { ok: false, error: 'Missing closing' };

  if (!Array.isArray(raw.stops) || raw.stops.length < 3 || raw.stops.length > 6) {
    return { ok: false, error: 'stops must be a 3-6 entry array' };
  }

  const seenFilms = new Set<string>();
  const stops: JourneyStop[] = [];

  for (const s of raw.stops) {
    const narration = typeof s.narration === 'string' ? s.narration.trim() : '';
    // filmPath is now optional. The prompt instructs the LLM to set it to
    // null when no film in the inventory truly matches the stop's subject;
    // we accept undefined / null / empty string as "no film".
    const rawFilm = s.filmPath;
    const filmPath =
      typeof rawFilm === 'string' && rawFilm.trim() ? rawFilm.trim() : null;
    const targetKind = s.target?.kind;
    const targetId = s.target?.id;

    if (!narration) return { ok: false, error: 'Stop missing narration' };

    if (filmPath !== null) {
      if (!isValidFilmPath(filmPath)) {
        return { ok: false, error: `Unknown filmPath: ${filmPath}` };
      }
      if (seenFilms.has(filmPath)) {
        return { ok: false, error: `Duplicate film: ${filmPath}` };
      }
      seenFilms.add(filmPath);
    }

    if (targetKind === 'planet') {
      if (!isValidPlanetId(targetId)) {
        return { ok: false, error: `Unknown planet id: ${targetId}` };
      }
      stops.push({
        target: { kind: 'planet', id: targetId },
        narration,
        filmPath
      });
    } else if (targetKind === 'spacecraft') {
      if (!isValidSpacecraftId(targetId)) {
        return { ok: false, error: `Unknown spacecraft id: ${targetId}` };
      }
      stops.push({
        target: { kind: 'spacecraft', id: targetId },
        narration,
        filmPath
      });
    } else {
      return { ok: false, error: `Unknown target kind: ${targetKind}` };
    }
  }

  // Enforce: first stop must be near Earth. This is the "start from home"
  // constraint the user expects — the journey is always a departure.
  const NEAR_EARTH: Array<string> = [
    'earth',
    'moon',
    'iss',
    'hubble',
    'apollo_lm',
    'lro'
  ];
  const first = stops[0];
  if (!NEAR_EARTH.includes(first.target.id)) {
    return {
      ok: false,
      error: `First stop must be near Earth, got ${first.target.id}`
    };
  }

  return {
    ok: true,
    journey: { mood, stops, closing }
  };
}
