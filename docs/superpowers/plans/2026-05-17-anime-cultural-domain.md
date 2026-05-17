# 二次元文化领域（Anime Cultural Domain）实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 Portal 中新增 “二次元（anime）” 文化领域，使用 anitabi 圣地巡礼数据作为内容来源，落点全部映射到地球表面，提供远景聚类 / 中景点位 / 近景海报的 LOD 渲染、可截图导出的图片代理、以及独立的 `/api/animeJourney` AI 路线规划。

**Architecture:** 引入“文化领域（cultural domain）”一级开关到 `sceneStore`（默认仍为 `scifi`，新增 `anime`）。`anime` 领域为完全独立的子系统：自己的 TS 类型 (`lib/anime/`)、构建期数据管线 (`scripts/anime/build-anitabi.mjs` → `public/data/anime/anitabi/*.json`)、自己的渲染层 (`components/anime/`，挂载在 Earth 内部)、自己的 API (`/api/animeJourney`) 与图片代理 (`/api/img`)，**完全不扩展** `PlanetId / SpacecraftId` 封闭联合，也不修改 `journeyInventory.ts`。MVP 最终交付：领域切换 → 地球远景看到聚类点 → 拉近显示点位与海报 → 点击查看地标详情 → AI 路线 4–6 站自动飞行高亮，且画布可被截图导出（含贴图）。

**Tech Stack:** Next.js 14 App Router · React Three Fiber 8 · three.js 0.169 · Tailwind 3.4 · GSAP 3.15 · Node.js 20（构建脚本） · OpenAI 兼容 Chat Completions API（已在 `/api/journey` / `/api/tts` 使用）。新增构建期依赖：`ngeohash`（点位 geohash 解码 / 聚合，~3KB）。运行时无新增依赖。

**Out of scope（明确不做）：**
- 不新增 `PlanetId / SpacecraftId` 成员，不修改 `lib/journeyInventory.ts`、`/api/journey/route.ts`、`/api/tts/route.ts` 的现有逻辑。
- 不实现增量 / 差分更新；“在线更新”入口本期仅做按钮 + 重新 fetch + 写入 IndexedDB（覆盖式）。
- 不导入 `B3 /d/users.json`、不调用 `C1 /api/session` 与 `C2 /api/log/point`。
- 不对二次元领域做 TTS（与 PRD 默认体验保持一致；若用户开启字幕即可，TTS 留作后续）。
- 不引入新的测试框架（项目无测试 runner，遵循 CLAUDE.md `Don't invent npm test`）。

**Verification model（项目无测试 runner）：** 每个有副作用的 Task 用 `npm run lint` + `npm run build` 做静态校验；运行时校验通过 `npm run dev` 启动浏览器手动验证 + `console.log` 检查。每个 Task 末尾给出 “Manual smoke” 步骤，描述用户在浏览器里能看到的预期结果。这取代传统单元测试。

---

## File Structure

新增 / 修改文件总览（**所有路径均为绝对仓库相对路径**）：

### 新增（Create）

**lib/anime/（领域类型与运行时数据访问）**
- `lib/anime/types.ts` — `WorkId`、`PointId`、`AnimeWork`、`AnimePoint`、`AnimePointDetail`、`AnimeManifest`、`AnimeStop`、`AnimeJourney` 等类型
- `lib/anime/coords.ts` — `latLngToEarthSurface(lat, lng, radius)` → `THREE.Vector3`，纯函数，与 `Earth` 半径解耦
- `lib/anime/geohash.ts` — base32 geohash → `[lat, lng]` 解码（不依赖 npm 包；6 字符 geohash 解析）
- `lib/anime/dataLoader.ts` — 客户端运行时：`loadManifest()`、`loadWorks()`、`loadPointsIndex()`、`loadDetailShard(prefix)`、`loadSearchIndex()`，带 in-memory cache 与 IndexedDB 持久化
- `lib/anime/cluster.ts` — 视野相机距离 → LOD 等级 + 聚类聚合（geohash 前缀 bucket）
- `lib/anime/searchClient.ts` — 用 `search.index.json` 做客户端关键词→候选点筛选（供 `/api/animeJourney` 服务端使用 Top-K 候选）
- `lib/anime/animeJourneyTypes.ts` — `AnimeStop`、`AnimeJourney`、`AnimeJourneyApiResponse`（与 `lib/journeyTypes.ts` 隔离，避免污染封闭联合）

**lib/domain.ts（顶层文化领域开关）**
- `lib/domain.ts` — 导出 `CulturalDomain = 'scifi' | 'anime'` 与默认值 `'scifi'`。

**scripts/anime/（构建期数据管线，Node.js）**
- `scripts/anime/build-anitabi.mjs` — 主入口：拉取 `g.json`、`g0..g5.json`，解码紧凑数组，写出 Portal JSON
- `scripts/anime/decode.mjs` — 紧凑数组 → 命名对象（`works[]`、`points[]`）
- `scripts/anime/shard.mjs` — 按 geohash 前缀 2 字分片
- `scripts/anime/buildSearchIndex.mjs` — 生成 `search.index.json`
- `scripts/anime/utils.mjs` — fetch / log / 重试

**public/data/anime/anitabi/（构建产物 — gitignored；首次需手动 commit 一次最小数据集供 demo 用，详见 Task 8）**
- `manifest.json`、`works.min.json`、`points_index.json`、`points_detail_shards/<2 字符前缀>.json[]`、`search.index.json`

**app/api/（新路由）**
- `app/api/img/route.ts` — 图片代理（白名单 + CORS）
- `app/api/animeJourney/route.ts` — anime 领域 LLM 路线规划

**components/anime/（渲染）**
- `components/anime/AnimeOverlay.tsx` — 顶层挂载点（仅当 `domain === 'anime'` 时渲染），由 `<Earth>` 通过 `children` prop 接收
- `components/anime/AnimeLODController.tsx` — 读取相机距离地球的距离 → 选择 `'far' | 'mid' | 'near'`
- `components/anime/AnimeClusterPoints.tsx` — 远景聚类点（InstancedMesh）
- `components/anime/AnimePointMarkers.tsx` — 中景简化点（InstancedMesh + 小图标）
- `components/anime/AnimePosterCards.tsx` — 近景海报平面（按需贴图、并发上限 N=24）
- `components/anime/useAnimeData.ts` — React 数据加载 hook，封装 `dataLoader`
- `components/anime/AnimeDetailCard.tsx` — 点击点位弹出的 2D 详情卡片（HUD overlay 层）
- `components/anime/AnimeNavigatorEntry.tsx` — anime 领域专属 Navigator 入口（替代 scifi 的 Navigator 行为分支）
- `components/anime/AnimeJourneyController.tsx` — anime 路线播放器（点位飞行 + 高亮，复用 `CameraRig` 但不进入 spacecraft 路径）

**components/ui/（修改 + 新增）**
- `components/ui/DomainSwitcher.tsx` — 右上角领域切换胶囊（科幻 / 二次元）

### 修改（Modify）

- `lib/sceneStore.tsx` — 新增 `domain: CulturalDomain`、`setDomain(d)`、`focusedAnimePointId: PointId | null`、`setFocusedAnimePointId`、`animeJourney: AnimeJourney | null`、`setAnimeJourney`、`animeJourneyStopIndex`、`setAnimeJourneyStopIndex`。**不复用** `journey/journeyStopIndex/navigatorPhase`（保持 scifi 流程不变；anime 自带 `animeNavigatorPhase`）。
- `components/space/Scene.tsx` — 在 `<Earth moonChildren=...>` 的同级新增 `earthChildren` prop 入口，用于挂载 `<AnimeOverlay/>`；通过 `domain` 决定 `<PostersLayer/>` 是否渲染（anime 领域屏蔽科幻海报）
- `components/planets/Earth.tsx` — 新增 `children` prop，渲染在 `<group rotation={[0,0,axialTilt]}>` 内部，使锚点跟随地球的自转 + 公转
- `components/ui/HUD.tsx` — 挂载 `<DomainSwitcher/>` 与 anime 领域开启时的 `<AnimeDetailCard/>`
- `components/navigator/Navigator.tsx` — 当 `domain === 'anime'` 时改为 POST `/api/animeJourney` 并把结果写入 `animeJourney`（不写入 `journey`）；UI 文案与占位词更新
- `app/page.tsx` — 在 anime 领域时挂载 `<AnimeJourneyController/>`、`<AnimeDetailCard/>`；保留科幻流程不动
- `next.config.mjs` — `images.remotePatterns` 加入 `www.anitabi.cn`（备用，目前 R3F 走 TextureLoader 不走 Next/Image，但后续详情卡片可能用）
- `package.json` — 新增 `npm run build:anime`（执行 `node scripts/anime/build-anitabi.mjs`）；新增 devDep `@types/node` 已存在，无需变化
- `README.md` — “添加内容” 段下方追加 “添加文化领域：anime” 一节，指向本计划与构建脚本
- `.gitignore` — 加入 `public/data/anime/anitabi/_raw/` 缓存目录

### 不修改（明确保留）

- `lib/journeyInventory.ts`、`lib/journeyTypes.ts`、`app/api/journey/route.ts`、`app/api/tts/route.ts`、`components/space/PostersLayer.tsx`（仅在 `domain === 'scifi'` 时渲染，控制权在 `Scene.tsx`，文件本身不变）

---

## Phase 0 — Foundation

### Task 1: Add `CulturalDomain` type & default

**Files:**
- Create: `lib/domain.ts`

- [ ] **Step 1: Create the domain module**

```ts
// lib/domain.ts
// Top-level cultural-domain switch. Each domain owns its own content
// system; the 3D scaffolding (planets, sun, starfield) is shared.
//
// 'scifi' is the original Portal experience (films + spacecraft).
// 'anime' adds anitabi pilgrimage landmarks projected onto Earth.

export type CulturalDomain = 'scifi' | 'anime';

export const DEFAULT_DOMAIN: CulturalDomain = 'scifi';

export const DOMAIN_LABELS: Record<CulturalDomain, { zh: string; en: string }> = {
  scifi: { zh: '科幻', en: 'Sci-Fi' },
  anime: { zh: '二次元', en: 'Anime' }
};
```

- [ ] **Step 2: Lint & build sanity**

Run: `npm run lint`
Expected: zero new warnings/errors.

- [ ] **Step 3: Commit**

```bash
git add lib/domain.ts
git commit -m "feat(anime): add CulturalDomain type"
```

---

### Task 2: Wire domain into `sceneStore`

**Files:**
- Modify: `lib/sceneStore.tsx`

- [ ] **Step 1: Add anime-related state to the store type**

In `lib/sceneStore.tsx`, after the existing imports:

```ts
import type { CulturalDomain } from './domain';
import { DEFAULT_DOMAIN } from './domain';
import type { AnimeJourney } from './anime/animeJourneyTypes';
```

(`AnimeJourney` import is forward-looking — Task 5 creates this file. Until then, replace with `import type { AnimeJourney } from './anime/animeJourneyTypes';` and **leave the import**; TS will only enforce after Task 5. Or, equivalently, defer this Step until Task 5 is done. Either order works because nothing else in this Task uses `AnimeJourney` as a runtime value.)

Extend `type SceneStore = { ... }`:

```ts
  // --- Anime cultural domain ---
  /** Active cultural domain. Switching this swaps the entire content
   *  layer (sci-fi posters/spacecraft ↔ anime landmarks). The 3D
   *  planet scaffolding is shared. */
  domain: CulturalDomain;
  setDomain: (d: CulturalDomain) => void;
  /** Currently selected anime landmark (geohash pointId), null when
   *  none. Independent from `focused` (planets) and `focusedArtifact`
   *  (spacecraft) so the existing camera logic is untouched. */
  focusedAnimePointId: string | null;
  setFocusedAnimePointId: (id: string | null) => void;
  /** Anime-domain Navigator phase. Mirrors `navigatorPhase` but stays
   *  separate so the sci-fi state machine is unaffected. */
  animeNavigatorPhase: NavigatorPhase;
  setAnimeNavigatorPhase: (p: NavigatorPhase) => void;
  animeJourney: AnimeJourney | null;
  setAnimeJourney: (j: AnimeJourney | null) => void;
  animeJourneyStopIndex: number;
  setAnimeJourneyStopIndex: (i: number) => void;
```

- [ ] **Step 2: Add corresponding state hooks**

Inside `SceneStoreProvider`, after existing `useState` calls:

```ts
  const [domain, setDomainState] = useState<CulturalDomain>(DEFAULT_DOMAIN);
  // Persist domain across reloads — feels less jarring than always
  // resetting to 'scifi'.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem('portal:domain');
    if (stored === 'scifi' || stored === 'anime') setDomainState(stored);
  }, []);
  const setDomain = useCallback((d: CulturalDomain) => {
    setDomainState(d);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('portal:domain', d);
    }
  }, []);

  const [focusedAnimePointId, setFocusedAnimePointId] = useState<string | null>(null);
  const [animeNavigatorPhase, setAnimeNavigatorPhase] = useState<NavigatorPhase>('closed');
  const [animeJourney, setAnimeJourney] = useState<AnimeJourney | null>(null);
  const [animeJourneyStopIndex, setAnimeJourneyStopIndex] = useState<number>(0);
```

- [ ] **Step 3: Expose them through `value`**

Add the new fields and setters to both the `useMemo` body and its dep array. Names match Step 1.

- [ ] **Step 4: Verify**

Run: `npm run lint && npm run build`
Expected: build succeeds. (If `AnimeJourney` import errors, leave the type as `unknown` for now and tighten in Task 5.)

- [ ] **Step 5: Commit**

```bash
git add lib/sceneStore.tsx
git commit -m "feat(anime): add domain switch + anime journey state to sceneStore"
```

---

### Task 3: Anime types module

**Files:**
- Create: `lib/anime/types.ts`

- [ ] **Step 1: Write the module**

```ts
// lib/anime/types.ts
// Anime cultural domain — runtime types matching the Portal data pack
// produced by scripts/anime/build-anitabi.mjs.
//
// IMPORTANT: PointId / WorkId here are *string / number aliases* — NOT
// closed unions. The anitabi catalogue is far too large (>10k points)
// to enumerate, and the Portal closed-union invariant only applies to
// PlanetId / SpacecraftId. Validation against `points_index.json` at
// runtime replaces compile-time exhaustiveness for the anime domain.

export type WorkId = number;
/** 6-character base32 geohash, e.g. "8bulvz". */
export type PointId = string;

export type AnimeWork = {
  id: WorkId;
  titleZh: string;
  titleOrigin: string;
  city: string | null;
  tags: string[];
  /** Hex string with leading '#'. */
  themeColor: string | null;
  /** Absolute URL after build-time normalisation. */
  coverUrl: string | null;
};

export type AnimePoint = {
  id: PointId;
  lat: number;
  lng: number;
  /** Works whose pilgrimage list contains this point. */
  workIds: WorkId[];
  name: string | null;
  nameZh: string | null;
  /** Absolute URL after build-time normalisation, or null. */
  imageUrl: string | null;
};

export type AnimePointDetail = {
  id: PointId;
  mark: string | null;
  origin: string | null;
  originLink: string | null;
  episodes: Array<{ workId: WorkId; ep: string | null; time: string | null }>;
};

export type AnimeManifest = {
  source: 'anitabi';
  /** Build version, e.g. "20260516-1142". */
  version: string;
  /** Upstream `modified` timestamp (ms) at build time. */
  modified: number;
  counts: { works: number; points: number };
  sharding: { strategy: 'geohash-prefix'; detailPrefixLen: number };
};

export type AnimeSearchIndex = {
  pointTokens: Record<PointId, string[]>;
  workTokens: Record<string /* WorkId stringified */, string[]>;
};
```

- [ ] **Step 2: Verify**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/anime/types.ts
git commit -m "feat(anime): runtime types for the anitabi data pack"
```

---

### Task 4: Coordinate + geohash helpers

**Files:**
- Create: `lib/anime/coords.ts`
- Create: `lib/anime/geohash.ts`

- [ ] **Step 1: Write `coords.ts`**

```ts
// lib/anime/coords.ts
// Lat/lng → Earth surface XYZ in scene units. Earth's display radius
// is hard-coded at 1.7 in components/planets/Earth.tsx; we accept it
// as a parameter to keep this pure.

import * as THREE from 'three';

/**
 * Map (lat, lng) on a unit sphere of `radius` to scene-local XYZ.
 *
 * Convention chosen to match three.js's Y-up coordinate system AND
 * the existing earth shader (which uses uv from a standard
 * SphereGeometry). lng = 0 lands on +X, lng = 90 on +Z, north pole on
 * +Y. The inset ε avoids landmarks z-fighting with the cloud shell.
 */
export function latLngToEarthSurface(
  lat: number,
  lng: number,
  radius: number,
  surfaceInset = 0.001
): THREE.Vector3 {
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = ((lng + 180) * Math.PI) / 180;
  const r = radius + surfaceInset;
  const x = -r * Math.sin(phi) * Math.cos(theta);
  const y = r * Math.cos(phi);
  const z = r * Math.sin(phi) * Math.sin(theta);
  return new THREE.Vector3(x, y, z);
}

/** Outward-pointing surface normal at (lat, lng). Used to orient
 *  marker / poster planes so they sit flush with the surface. */
export function latLngNormal(lat: number, lng: number): THREE.Vector3 {
  return latLngToEarthSurface(lat, lng, 1, 0).normalize();
}
```

- [ ] **Step 2: Write `geohash.ts`**

```ts
// lib/anime/geohash.ts
// Self-contained 6-char base32 geohash decoder. anitabi uses pointId
// as the geohash string itself, so we read lat/lng straight from the
// id when needed. Build-time also writes lat/lng explicitly into
// points_index.json, so this is mainly used for clustering at runtime
// (prefix-bucketing).

const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

const CHAR_INDEX: Record<string, number> = (() => {
  const m: Record<string, number> = {};
  for (let i = 0; i < BASE32.length; i++) m[BASE32[i]] = i;
  return m;
})();

export function decodeGeohash(hash: string): { lat: number; lng: number } {
  let isLng = true;
  let latLo = -90;
  let latHi = 90;
  let lngLo = -180;
  let lngHi = 180;

  for (const ch of hash.toLowerCase()) {
    const idx = CHAR_INDEX[ch];
    if (idx === undefined) {
      throw new Error(`Invalid geohash char: ${ch}`);
    }
    for (let bit = 4; bit >= 0; bit--) {
      const on = (idx >> bit) & 1;
      if (isLng) {
        const mid = (lngLo + lngHi) / 2;
        if (on) lngLo = mid;
        else lngHi = mid;
      } else {
        const mid = (latLo + latHi) / 2;
        if (on) latLo = mid;
        else latHi = mid;
      }
      isLng = !isLng;
    }
  }
  return { lat: (latLo + latHi) / 2, lng: (lngLo + lngHi) / 2 };
}

/** First N chars are a coarse spatial bucket: roughly
 *    1: ~5000 km, 2: ~1250 km, 3: ~156 km, 4: ~39 km, 5: ~5 km, 6: ~1 km
 *  — exact at the equator, tighter near the poles. We use the prefix
 *  for cluster bucketing and detail-shard sharding (prefixLen=2). */
export function geohashPrefix(hash: string, len: number): string {
  return hash.slice(0, len);
}
```

- [ ] **Step 3: Verify**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add lib/anime/coords.ts lib/anime/geohash.ts
git commit -m "feat(anime): coords + geohash helpers"
```

---

## Phase 1 — Build-time Data Pipeline

> The pipeline runs locally / in CI, **not** in the Next.js runtime. Output lands under `public/data/anime/anitabi/`. Re-runs are idempotent.

### Task 5: AnimeJourney API types

**Files:**
- Create: `lib/anime/animeJourneyTypes.ts`

- [ ] **Step 1: Write the module**

```ts
// lib/anime/animeJourneyTypes.ts
// Wire format for /api/animeJourney. Kept separate from
// lib/journeyTypes.ts so the sci-fi closed unions (PlanetId,
// SpacecraftId) stay untouched.

import type { PointId, WorkId } from './types';

export type AnimeStop = {
  /** Must exist in points_index.json. Validated server-side. */
  pointId: PointId;
  /** 30-60 chars, subject must be the landmark itself. */
  narration: string;
  /** Optional binding: the work this stop is foregrounding. Must
   *  exist in works.min.json when non-null. */
  workId: WorkId | null;
};

export type AnimeJourney = {
  /** 8-14 chars, the LLM's read of the user's mood. */
  mood: string;
  /** 4-6 stops. */
  stops: AnimeStop[];
  /** ≤20 chars closing line. */
  closing: string;
};

export type AnimeJourneyApiResponse =
  | { ok: true; journey: AnimeJourney }
  | { ok: false; error: string };
```

- [ ] **Step 2: Commit**

```bash
git add lib/anime/animeJourneyTypes.ts
git commit -m "feat(anime): wire types for /api/animeJourney"
```

---

### Task 6: Build pipeline — fetch + decode

**Files:**
- Create: `scripts/anime/utils.mjs`
- Create: `scripts/anime/decode.mjs`
- Modify: `.gitignore`

- [ ] **Step 1: Append to `.gitignore`**

```
# Anime build pipeline raw cache (re-fetched on demand)
public/data/anime/anitabi/_raw/
```

- [ ] **Step 2: Write `scripts/anime/utils.mjs`**

```js
// scripts/anime/utils.mjs
// Tiny helpers shared by build-anitabi.mjs / decode.mjs.
// Node 20+ (global fetch); no external deps.

import fs from 'node:fs/promises';
import path from 'node:path';

export const BASE_URL = 'https://www.anitabi.cn';
export const RAW_DIR = path.resolve('public/data/anime/anitabi/_raw');
export const OUT_DIR = path.resolve('public/data/anime/anitabi');

export function log(...args) {
  // eslint-disable-next-line no-console
  console.log('[anime-build]', ...args);
}

export async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

/** Fetch with 3 retries + exponential backoff. Caches body to RAW_DIR
 *  on first success; subsequent runs read from disk unless `force`. */
export async function fetchJsonCached(relPath, { force = false } = {}) {
  await ensureDir(RAW_DIR);
  const cacheFile = path.join(RAW_DIR, relPath.replace(/[\/]/g, '_'));
  if (!force) {
    try {
      const raw = await fs.readFile(cacheFile, 'utf8');
      log('cache hit', relPath);
      return JSON.parse(raw);
    } catch {
      /* miss */
    }
  }
  const url = `${BASE_URL}${relPath}`;
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      log('GET', url, attempt > 0 ? `(retry ${attempt})` : '');
      const res = await fetch(url, {
        headers: { 'User-Agent': 'PortalAnimeBuild/0.1' }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      await fs.writeFile(cacheFile, text);
      return JSON.parse(text);
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
    }
  }
  throw new Error(`fetchJsonCached(${relPath}) failed: ${lastErr?.message}`);
}

export function absolutiseUrl(maybeRel) {
  if (!maybeRel) return null;
  if (/^https?:\/\//i.test(maybeRel)) return maybeRel;
  return `${BASE_URL}${maybeRel.startsWith('/') ? '' : '/'}${maybeRel}`;
}
```

- [ ] **Step 3: Write `scripts/anime/decode.mjs`**

```js
// scripts/anime/decode.mjs
// Anitabi's compact-array encoding → named objects. The exact field
// order is documented in their public README; we keep this tolerant
// (out-of-range indices → null) so a future field reorder degrades
// rather than crashing the build.
//
// g.json bangumi tuple positions used:
//   [0] id, [1] title_zh, [2] title_origin, [3] city, [4] tags?,
//   [5] cover, [6] points_flat, [7] color, ... (extras ignored)
//
// gN.json point tuple positions used (per anitabi schema):
//   [0] id, [1] name, [2] nameZh, [3] image, [4] mark, [5] origin,
//   [6] originLink, [7] ep, [8..] extras

import { absolutiseUrl } from './utils.mjs';

export function decodeWork(arr) {
  const [id, titleZh, titleOrigin, city, tags, cover, pointsFlat, color] = arr;
  const points = [];
  if (Array.isArray(pointsFlat)) {
    for (let i = 0; i + 2 < pointsFlat.length; i += 4) {
      const pid = pointsFlat[i];
      const lat = pointsFlat[i + 1];
      const lng = pointsFlat[i + 2];
      // const priority = pointsFlat[i + 3];
      if (typeof pid === 'string' && typeof lat === 'number' && typeof lng === 'number') {
        points.push({ id: pid, lat, lng });
      }
    }
  }
  return {
    id: typeof id === 'number' ? id : Number(id),
    titleZh: typeof titleZh === 'string' ? titleZh : '',
    titleOrigin: typeof titleOrigin === 'string' ? titleOrigin : '',
    city: typeof city === 'string' ? city : null,
    tags: Array.isArray(tags) ? tags.filter((t) => typeof t === 'string') : [],
    coverUrl: absolutiseUrl(typeof cover === 'string' ? cover : null),
    themeColor: typeof color === 'string' ? color : null,
    points
  };
}

export function decodePoint(arr, workId) {
  const [id, name, nameZh, image, mark, origin, originLink, ep] = arr;
  return {
    id: typeof id === 'string' ? id : '',
    name: typeof name === 'string' ? name : null,
    nameZh: typeof nameZh === 'string' ? nameZh : null,
    imageUrl: absolutiseUrl(typeof image === 'string' ? image : null),
    mark: typeof mark === 'string' ? mark : null,
    origin: typeof origin === 'string' ? origin : null,
    originLink: typeof originLink === 'string' ? originLink : null,
    episode: { workId, ep: typeof ep === 'string' ? ep : null, time: null }
  };
}
```

- [ ] **Step 4: Run a smoke check**

Run: `node -e "import('./scripts/anime/decode.mjs').then(m => console.log(typeof m.decodeWork))"`
Expected: prints `function`.

- [ ] **Step 5: Commit**

```bash
git add scripts/anime/utils.mjs scripts/anime/decode.mjs .gitignore
git commit -m "feat(anime-build): fetch + decode helpers"
```

---

### Task 7: Build pipeline — main script

**Files:**
- Create: `scripts/anime/build-anitabi.mjs`
- Create: `scripts/anime/shard.mjs`
- Create: `scripts/anime/buildSearchIndex.mjs`
- Modify: `package.json`

- [ ] **Step 1: Write `scripts/anime/shard.mjs`**

```js
// scripts/anime/shard.mjs
// Bucket points by the first N chars of their geohash id.

export function shardByPrefix(map, prefixLen) {
  // map: Record<pointId, detailObj>
  const shards = {};
  for (const [pid, detail] of Object.entries(map)) {
    const key = pid.slice(0, prefixLen);
    if (!shards[key]) shards[key] = {};
    shards[key][pid] = detail;
  }
  return shards;
}
```

- [ ] **Step 2: Write `scripts/anime/buildSearchIndex.mjs`**

```js
// scripts/anime/buildSearchIndex.mjs
// Trivial token bag — lower-case, split on non-alphanumeric (handles
// CJK by NOT splitting CJK runs, treating each run as one token plus
// its city + tag tokens). Good enough for "user said 秩父" → matches.

function tokenize(s) {
  if (!s) return [];
  // Lowercase, then split on whitespace + punctuation; CJK runs stay
  // intact as single tokens. Plus per-character split for CJK so
  // partial substring matches work too.
  const lower = s.toLowerCase();
  const out = new Set();
  for (const piece of lower.split(/[\s,，、。.\-—_/()（）【】「」『』：:;；!?·]+/)) {
    if (!piece) continue;
    out.add(piece);
    // For CJK strings >1 char, also add each character.
    if (/[一-鿿぀-ヿ]/.test(piece) && piece.length > 1) {
      for (const ch of piece) out.add(ch);
    }
  }
  return [...out];
}

export function buildSearchIndex(works, points) {
  const pointTokens = {};
  const workTokens = {};

  for (const w of Object.values(works)) {
    const toks = new Set([
      ...tokenize(w.titleZh),
      ...tokenize(w.titleOrigin),
      ...tokenize(w.city ?? ''),
      ...(w.tags ?? []).flatMap(tokenize)
    ]);
    workTokens[String(w.id)] = [...toks];
  }

  for (const p of Object.values(points)) {
    const ws = (p.workIds ?? []).map((wid) => works[wid]).filter(Boolean);
    const toks = new Set([
      ...tokenize(p.name ?? ''),
      ...tokenize(p.nameZh ?? ''),
      ...ws.flatMap((w) => tokenize(w.titleZh)),
      ...ws.flatMap((w) => tokenize(w.city ?? '')),
      ...ws.flatMap((w) => (w.tags ?? []).flatMap(tokenize))
    ]);
    pointTokens[p.id] = [...toks];
  }

  return { pointTokens, workTokens };
}
```

- [ ] **Step 3: Write `scripts/anime/build-anitabi.mjs`**

```js
// scripts/anime/build-anitabi.mjs
// Portal × anitabi build pipeline. Fetches the public static JSON,
// decodes the compact arrays, normalises URLs, shards detail JSON
// by geohash prefix, builds a search index, writes everything to
// public/data/anime/anitabi/.
//
// Run: npm run build:anime [--force]

import fs from 'node:fs/promises';
import path from 'node:path';

import {
  fetchJsonCached,
  ensureDir,
  log,
  OUT_DIR
} from './utils.mjs';
import { decodeWork, decodePoint } from './decode.mjs';
import { shardByPrefix } from './shard.mjs';
import { buildSearchIndex } from './buildSearchIndex.mjs';

const force = process.argv.includes('--force');
const DETAIL_PREFIX_LEN = 2;

async function main() {
  await ensureDir(OUT_DIR);
  await ensureDir(path.join(OUT_DIR, 'points_detail_shards'));

  // 1) Fetch g.json (works + points_flat)
  const gRaw = await fetchJsonCached('/d/g.json', { force });
  if (!Array.isArray(gRaw) || !Array.isArray(gRaw[0])) {
    throw new Error('Unexpected g.json shape');
  }
  const [bangumiList, , modifiedTs] = gRaw;
  log('g.json works:', bangumiList.length);

  const works = {};
  const points = {};
  for (const arr of bangumiList) {
    const w = decodeWork(arr);
    if (!w.id) continue;
    works[w.id] = {
      id: w.id,
      titleZh: w.titleZh,
      titleOrigin: w.titleOrigin,
      city: w.city,
      tags: w.tags,
      themeColor: w.themeColor,
      coverUrl: w.coverUrl
    };
    for (const p of w.points) {
      if (!points[p.id]) {
        points[p.id] = {
          id: p.id,
          lat: p.lat,
          lng: p.lng,
          workIds: [],
          name: null,
          nameZh: null,
          imageUrl: null
        };
      }
      if (!points[p.id].workIds.includes(w.id)) {
        points[p.id].workIds.push(w.id);
      }
    }
  }

  // 2) Fetch g0..g5 (point details)
  const detailMap = {};
  for (let n = 0; n <= 5; n++) {
    const detailRaw = await fetchJsonCached(`/d/g${n}.json`, { force });
    if (!Array.isArray(detailRaw)) continue;
    for (const entry of detailRaw) {
      // entry: [bangumi_id, theme_meta, points[], modified]
      const wid = entry?.[0];
      const pts = entry?.[2];
      if (!Array.isArray(pts)) continue;
      for (const p of pts) {
        const decoded = decodePoint(p, wid);
        if (!decoded.id) continue;
        if (!detailMap[decoded.id]) {
          detailMap[decoded.id] = {
            id: decoded.id,
            mark: decoded.mark,
            origin: decoded.origin,
            originLink: decoded.originLink,
            episodes: []
          };
        }
        if (decoded.episode.workId) {
          detailMap[decoded.id].episodes.push(decoded.episode);
        }
        // Promote name / nameZh / imageUrl into points_index
        const idx = points[decoded.id];
        if (idx) {
          if (!idx.name && decoded.name) idx.name = decoded.name;
          if (!idx.nameZh && decoded.nameZh) idx.nameZh = decoded.nameZh;
          if (!idx.imageUrl && decoded.imageUrl) idx.imageUrl = decoded.imageUrl;
        }
      }
    }
  }
  log('points indexed:', Object.keys(points).length);
  log('points with detail:', Object.keys(detailMap).length);

  // 3) Search index
  const search = buildSearchIndex(works, points);

  // 4) Manifest
  const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12);
  const manifest = {
    source: 'anitabi',
    version: stamp,
    modified: typeof modifiedTs === 'number' ? modifiedTs : Date.now(),
    counts: { works: Object.keys(works).length, points: Object.keys(points).length },
    sharding: { strategy: 'geohash-prefix', detailPrefixLen: DETAIL_PREFIX_LEN }
  };

  // 5) Write outputs
  await fs.writeFile(path.join(OUT_DIR, 'manifest.json'), JSON.stringify(manifest));
  await fs.writeFile(path.join(OUT_DIR, 'works.min.json'), JSON.stringify(works));
  await fs.writeFile(path.join(OUT_DIR, 'points_index.json'), JSON.stringify(points));
  await fs.writeFile(path.join(OUT_DIR, 'search.index.json'), JSON.stringify(search));

  const shards = shardByPrefix(detailMap, DETAIL_PREFIX_LEN);
  // Wipe old shards first so removed prefixes don't linger.
  const shardDir = path.join(OUT_DIR, 'points_detail_shards');
  for (const f of await fs.readdir(shardDir).catch(() => [])) {
    if (f.endsWith('.json')) await fs.unlink(path.join(shardDir, f));
  }
  for (const [prefix, payload] of Object.entries(shards)) {
    await fs.writeFile(
      path.join(shardDir, `${prefix}.json`),
      JSON.stringify(payload)
    );
  }
  log('done. version', manifest.version);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 4: Add npm script**

In `package.json`, add to `"scripts"`:

```json
    "build:anime": "node scripts/anime/build-anitabi.mjs"
```

- [ ] **Step 5: Run the pipeline (online)**

Run: `npm run build:anime`
Expected:
- Logs `[anime-build] g.json works: <thousands>`, `[anime-build] points indexed: <tens of thousands>`, then `done. version <stamp>`
- `public/data/anime/anitabi/manifest.json` and others exist
- `points_detail_shards/` has tens to hundreds of `<2-char>.json` files

If the upstream is unreachable, the pipeline must fail loudly — do **not** add a fallback to mock data inside the build script. Instead, see Task 8 for the demo subset.

- [ ] **Step 6: Commit (script only — JSON outputs handled in Task 8)**

```bash
git add scripts/anime/ package.json
git commit -m "feat(anime-build): main pipeline + npm run build:anime"
```

---

### Task 8: Commit a minimal demo data subset

**Why this exists:** The full data pack is big (hundreds of MB potentially) and re-fetchable. Committing a tiny curated subset gives the demo a known-good starting point that runs offline. Subsequent contributors can run `npm run build:anime` to refresh.

**Files:**
- Modify: `.gitignore` — explicitly **un**-ignore the small subset
- Create: `public/data/anime/anitabi/manifest.json` etc. (subset)
- Create: `scripts/anime/build-demo-subset.mjs`

- [ ] **Step 1: Write `scripts/anime/build-demo-subset.mjs`**

```js
// scripts/anime/build-demo-subset.mjs
// Reads the full build output and rewrites it with only the top-N
// works (by point count) so the demo data shipped in git stays small
// while still showing off LOD / clustering / poster cards.
//
// Run AFTER `npm run build:anime`.

import fs from 'node:fs/promises';
import path from 'node:path';
import { OUT_DIR } from './utils.mjs';
import { shardByPrefix } from './shard.mjs';
import { buildSearchIndex } from './buildSearchIndex.mjs';

const TOP_N = 30;
const DETAIL_PREFIX_LEN = 2;

async function readJson(rel) {
  return JSON.parse(await fs.readFile(path.join(OUT_DIR, rel), 'utf8'));
}

async function main() {
  const works = await readJson('works.min.json');
  const points = await readJson('points_index.json');

  const counts = Object.values(works).map((w) => ({
    id: w.id,
    n: Object.values(points).filter((p) => p.workIds.includes(w.id)).length
  }));
  counts.sort((a, b) => b.n - a.n);
  const keepIds = new Set(counts.slice(0, TOP_N).map((c) => c.id));

  const subWorks = {};
  for (const id of keepIds) subWorks[id] = works[id];

  const subPoints = {};
  for (const p of Object.values(points)) {
    if (p.workIds.some((wid) => keepIds.has(wid))) {
      subPoints[p.id] = {
        ...p,
        workIds: p.workIds.filter((wid) => keepIds.has(wid))
      };
    }
  }

  const subSearch = buildSearchIndex(subWorks, subPoints);

  // Reload existing detail map and filter to subset.
  const shardDir = path.join(OUT_DIR, 'points_detail_shards');
  const allDetail = {};
  for (const f of await fs.readdir(shardDir)) {
    if (!f.endsWith('.json')) continue;
    const piece = JSON.parse(await fs.readFile(path.join(shardDir, f), 'utf8'));
    Object.assign(allDetail, piece);
  }
  const subDetail = {};
  for (const pid of Object.keys(subPoints)) {
    if (allDetail[pid]) subDetail[pid] = allDetail[pid];
  }

  const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12);
  const manifest = {
    source: 'anitabi',
    version: `${stamp}-demo`,
    modified: Date.now(),
    counts: { works: Object.keys(subWorks).length, points: Object.keys(subPoints).length },
    sharding: { strategy: 'geohash-prefix', detailPrefixLen: DETAIL_PREFIX_LEN }
  };

  await fs.writeFile(path.join(OUT_DIR, 'manifest.json'), JSON.stringify(manifest));
  await fs.writeFile(path.join(OUT_DIR, 'works.min.json'), JSON.stringify(subWorks));
  await fs.writeFile(path.join(OUT_DIR, 'points_index.json'), JSON.stringify(subPoints));
  await fs.writeFile(path.join(OUT_DIR, 'search.index.json'), JSON.stringify(subSearch));

  for (const f of await fs.readdir(shardDir)) {
    if (f.endsWith('.json')) await fs.unlink(path.join(shardDir, f));
  }
  const shards = shardByPrefix(subDetail, DETAIL_PREFIX_LEN);
  for (const [prefix, payload] of Object.entries(shards)) {
    await fs.writeFile(path.join(shardDir, `${prefix}.json`), JSON.stringify(payload));
  }
  console.log(
    `[demo-subset] wrote ${Object.keys(subWorks).length} works, ${Object.keys(subPoints).length} points`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 2: Add the npm script**

In `package.json`:

```json
    "build:anime:demo": "node scripts/anime/build-demo-subset.mjs"
```

- [ ] **Step 3: Generate the demo subset**

Run: `npm run build:anime && npm run build:anime:demo`
Expected: `manifest.json` shows `version: "<stamp>-demo"` and counts in the low hundreds.

- [ ] **Step 4: Verify total committed size <2 MB**

Run: `du -sh public/data/anime/anitabi`
Expected: under 2 MB. If larger, lower `TOP_N` in the script.

- [ ] **Step 5: Commit the data subset + script**

```bash
git add scripts/anime/build-demo-subset.mjs package.json public/data/anime/anitabi
git commit -m "feat(anime-build): demo subset (top 30 works) + commit pack"
```

---

## Phase 2 — Runtime Data Access & Image Proxy

### Task 9: Image proxy `/api/img`

**Why this exists:** WebGL `TextureLoader` needs CORS-clean image responses to avoid tainting the canvas — a tainted canvas refuses `toDataURL()` / `toBlob()`, which breaks the screenshot export. Routing all anitabi images through our same-origin proxy keeps the canvas exportable and lets us add a domain whitelist.

**Files:**
- Create: `app/api/img/route.ts`
- Modify: `next.config.mjs`

- [ ] **Step 1: Write the route**

```ts
// app/api/img/route.ts
// Server-side image proxy. The browser hits /api/img?url=<encoded>;
// we fetch the upstream and stream the binary back with CORS headers
// that let WebGL textures use it without tainting the canvas.

import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const ALLOWED_HOSTS = new Set([
  'www.anitabi.cn',
  'image.anitabi.cn',
  'lain.bgm.tv'
]);

const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/gif'
]);

export async function GET(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url);
  const raw = searchParams.get('url');
  if (!raw) return new Response('missing url', { status: 400 });

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return new Response('invalid url', { status: 400 });
  }

  if (!ALLOWED_HOSTS.has(target.hostname)) {
    return new Response('host not allowed', { status: 403 });
  }
  if (target.protocol !== 'https:') {
    return new Response('https only', { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(target.toString(), {
      headers: { 'User-Agent': 'PortalAnimeProxy/0.1' },
      // Defensive: 8s timeout via AbortSignal.
      signal: AbortSignal.timeout(8000)
    });
  } catch (e) {
    return new Response(`upstream failed: ${(e as Error).message}`, {
      status: 502
    });
  }
  if (!upstream.ok) {
    return new Response(`upstream ${upstream.status}`, { status: 502 });
  }
  const ctype = upstream.headers.get('content-type') ?? 'application/octet-stream';
  if (!ALLOWED_TYPES.has(ctype.split(';')[0].trim())) {
    return new Response(`bad content-type ${ctype}`, { status: 415 });
  }

  const buf = await upstream.arrayBuffer();
  return new NextResponse(buf, {
    status: 200,
    headers: {
      'Content-Type': ctype,
      // Same-origin: no Access-Control-Allow-Origin needed for our own
      // <img>/TextureLoader. We still emit it explicitly so a future
      // sub-domain split keeps working.
      'Access-Control-Allow-Origin': '*',
      'Cross-Origin-Resource-Policy': 'cross-origin',
      // Let the browser cache aggressively — anitabi images are
      // content-addressed by path, immutable in practice.
      'Cache-Control': 'public, max-age=86400, immutable'
    }
  });
}
```

- [ ] **Step 2: Add hostname to next.config.mjs (defensive)**

If `next.config.mjs` doesn't already have `images.remotePatterns`, add:

```js
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'www.anitabi.cn' },
      { protocol: 'https', hostname: 'image.anitabi.cn' },
      { protocol: 'https', hostname: 'lain.bgm.tv' }
    ]
  }
};
export default nextConfig;
```

- [ ] **Step 3: Smoke test**

Run: `npm run dev`
Open: `http://localhost:3000/api/img?url=https%3A%2F%2Fwww.anitabi.cn%2Fimages%2Fbangumi-icons.webp`
Expected: image loads in browser; response headers show `Access-Control-Allow-Origin: *` and `Content-Type: image/...`.

Negative test: `http://localhost:3000/api/img?url=https%3A%2F%2Fevil.example.com%2Ffoo.jpg`
Expected: HTTP 403 `host not allowed`.

- [ ] **Step 4: Commit**

```bash
git add app/api/img/route.ts next.config.mjs
git commit -m "feat(anime): /api/img CORS-safe image proxy"
```

---

### Task 10: Runtime data loader

**Files:**
- Create: `lib/anime/dataLoader.ts`

- [ ] **Step 1: Write the loader**

```ts
// lib/anime/dataLoader.ts
// Client-side fetcher for the anime data pack. Each resource is loaded
// once per session (in-memory promise cache) and persisted to
// IndexedDB so repeat sessions skip the network. Versioning is keyed
// by manifest.version — a build bump invalidates everything.
//
// Pure runtime data; we DON'T import three.js here so this module
// can be reached during SSR-safe code paths (none currently, but
// cheaper to keep it free of side effects).

'use client';

import type {
  AnimeManifest,
  AnimePoint,
  AnimePointDetail,
  AnimeSearchIndex,
  AnimeWork,
  PointId,
  WorkId
} from './types';

const BASE = '/data/anime/anitabi';
const DB_NAME = 'portal-anime';
const DB_VERSION = 1;
const STORE = 'pack';

let cachedManifest: Promise<AnimeManifest> | null = null;
let cachedWorks: Promise<Record<WorkId, AnimeWork>> | null = null;
let cachedPoints: Promise<Record<PointId, AnimePoint>> | null = null;
let cachedSearch: Promise<AnimeSearchIndex> | null = null;
const cachedShards: Map<string, Promise<Record<PointId, AnimePointDetail>>> = new Map();

function openDB(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
}

async function idbGet<T>(key: string): Promise<T | null> {
  const db = await openDB();
  if (!db) return null;
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve((req.result as T) ?? null);
    req.onerror = () => resolve(null);
  });
}

async function idbPut(key: string, value: unknown): Promise<void> {
  const db = await openDB();
  if (!db) return;
  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(path, { cache: 'force-cache' });
  if (!res.ok) throw new Error(`fetch ${path} -> ${res.status}`);
  return (await res.json()) as T;
}

async function loadVersioned<T>(
  key: string,
  url: string,
  version: string
): Promise<T> {
  // Try IDB first; invalidate when version mismatches.
  const cached = await idbGet<{ v: string; data: T }>(key);
  if (cached && cached.v === version) return cached.data;
  const data = await fetchJson<T>(url);
  void idbPut(key, { v: version, data });
  return data;
}

export function loadManifest(): Promise<AnimeManifest> {
  if (!cachedManifest) {
    cachedManifest = fetchJson<AnimeManifest>(`${BASE}/manifest.json`);
  }
  return cachedManifest;
}

export function loadWorks(): Promise<Record<WorkId, AnimeWork>> {
  if (!cachedWorks) {
    cachedWorks = (async () => {
      const m = await loadManifest();
      return loadVersioned(`works:${m.version}`, `${BASE}/works.min.json`, m.version);
    })();
  }
  return cachedWorks;
}

export function loadPointsIndex(): Promise<Record<PointId, AnimePoint>> {
  if (!cachedPoints) {
    cachedPoints = (async () => {
      const m = await loadManifest();
      return loadVersioned(`points:${m.version}`, `${BASE}/points_index.json`, m.version);
    })();
  }
  return cachedPoints;
}

export function loadSearchIndex(): Promise<AnimeSearchIndex> {
  if (!cachedSearch) {
    cachedSearch = (async () => {
      const m = await loadManifest();
      return loadVersioned(`search:${m.version}`, `${BASE}/search.index.json`, m.version);
    })();
  }
  return cachedSearch;
}

export function loadDetailShard(
  prefix: string
): Promise<Record<PointId, AnimePointDetail>> {
  let p = cachedShards.get(prefix);
  if (!p) {
    p = (async () => {
      const m = await loadManifest();
      try {
        return await loadVersioned<Record<PointId, AnimePointDetail>>(
          `shard:${m.version}:${prefix}`,
          `${BASE}/points_detail_shards/${prefix}.json`,
          m.version
        );
      } catch {
        // Shards are sparse — if no point with this prefix has detail
        // data, the file simply won't exist. Treat 404 as empty.
        return {};
      }
    })();
    cachedShards.set(prefix, p);
  }
  return p;
}

/** Resolve a single point's detail, fetching its shard on demand. */
export async function loadPointDetail(
  pointId: PointId
): Promise<AnimePointDetail | null> {
  const m = await loadManifest();
  const prefix = pointId.slice(0, m.sharding.detailPrefixLen);
  const shard = await loadDetailShard(prefix);
  return shard[pointId] ?? null;
}

/** Image URLs in the pack are absolute anitabi URLs. Route them through
 *  our /api/img proxy so WebGL textures stay CORS-clean. */
export function proxiedImageUrl(absolute: string | null): string | null {
  if (!absolute) return null;
  return `/api/img?url=${encodeURIComponent(absolute)}`;
}
```

- [ ] **Step 2: Verify**

Run: `npm run lint && npm run build`
Expected: both succeed.

- [ ] **Step 3: Commit**

```bash
git add lib/anime/dataLoader.ts
git commit -m "feat(anime): client data loader with IndexedDB cache"
```

---

### Task 11: `useAnimeData` hook

**Files:**
- Create: `components/anime/useAnimeData.ts`

- [ ] **Step 1: Write the hook**

```ts
// components/anime/useAnimeData.ts
'use client';

import { useEffect, useState } from 'react';

import {
  loadManifest,
  loadPointsIndex,
  loadWorks
} from '@/lib/anime/dataLoader';
import type {
  AnimeManifest,
  AnimePoint,
  AnimeWork,
  PointId,
  WorkId
} from '@/lib/anime/types';

export type AnimeDataState =
  | { status: 'loading'; manifest: null; works: null; points: null }
  | { status: 'ready'; manifest: AnimeManifest; works: Record<WorkId, AnimeWork>; points: Record<PointId, AnimePoint> }
  | { status: 'error'; manifest: null; works: null; points: null; error: string };

const INITIAL: AnimeDataState = { status: 'loading', manifest: null, works: null, points: null };

export function useAnimeData(): AnimeDataState {
  const [state, setState] = useState<AnimeDataState>(INITIAL);
  useEffect(() => {
    let cancelled = false;
    Promise.all([loadManifest(), loadWorks(), loadPointsIndex()])
      .then(([manifest, works, points]) => {
        if (cancelled) return;
        setState({ status: 'ready', manifest, works, points });
      })
      .catch((e: Error) => {
        if (cancelled) return;
        setState({
          status: 'error',
          manifest: null,
          works: null,
          points: null,
          error: e.message
        });
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return state;
}
```

- [ ] **Step 2: Commit**

```bash
git add components/anime/useAnimeData.ts
git commit -m "feat(anime): useAnimeData hook"
```

---

## Phase 3 — 3D Rendering Layer (LOD)

### Task 12: LOD controller + cluster math

**Files:**
- Create: `lib/anime/cluster.ts`
- Create: `components/anime/AnimeLODController.tsx`

- [ ] **Step 1: Write `lib/anime/cluster.ts`**

```ts
// lib/anime/cluster.ts
// Camera-distance-driven LOD selection + geohash-prefix bucketing for
// the cluster-points layer. Distances are in scene units (Earth's
// surface radius is 1.7).

import type { AnimePoint, PointId } from './types';
import { latLngToEarthSurface } from './coords';
import * as THREE from 'three';

export type LodLevel = 'far' | 'mid' | 'near';

/**
 * Camera distance to Earth centre → LOD bucket.
 *   far:  >18  (overview / planetary view)
 *   mid:  6–18 (orbit-altitude — see clusters as individual points)
 *   near: <6   (graze / surface — show poster cards)
 */
export function pickLod(camDistToEarthCentre: number): LodLevel {
  if (camDistToEarthCentre > 18) return 'far';
  if (camDistToEarthCentre > 6) return 'mid';
  return 'near';
}

/** Cluster all points by their geohash prefix. The prefix length scales
 *  inversely with how close the camera is — at 'far' we use len=2
 *  (~1250 km buckets), at 'mid' len=3 (~156 km). 'near' returns no
 *  clusters (caller renders raw points / posters). */
export function clusterPrefixLen(lod: LodLevel): number {
  if (lod === 'far') return 2;
  if (lod === 'mid') return 3;
  return 0;
}

export type Cluster = {
  /** Geohash-prefix bucket id, e.g. "8b". */
  bucket: string;
  /** Average lat/lng of member points. */
  lat: number;
  lng: number;
  /** Member point ids — also the click target. */
  points: PointId[];
  /** scene-local XYZ on Earth surface, derived from lat/lng. */
  position: THREE.Vector3;
};

export function buildClusters(
  points: Record<PointId, AnimePoint>,
  prefixLen: number,
  earthRadius: number
): Cluster[] {
  if (prefixLen <= 0) return [];
  const buckets = new Map<string, AnimePoint[]>();
  for (const p of Object.values(points)) {
    const key = p.id.slice(0, prefixLen);
    let list = buckets.get(key);
    if (!list) {
      list = [];
      buckets.set(key, list);
    }
    list.push(p);
  }
  const out: Cluster[] = [];
  for (const [bucket, list] of buckets) {
    let sumLat = 0;
    let sumLng = 0;
    for (const p of list) {
      sumLat += p.lat;
      sumLng += p.lng;
    }
    const lat = sumLat / list.length;
    const lng = sumLng / list.length;
    out.push({
      bucket,
      lat,
      lng,
      points: list.map((p) => p.id),
      position: latLngToEarthSurface(lat, lng, earthRadius, 0.005)
    });
  }
  return out;
}
```

- [ ] **Step 2: Write `AnimeLODController.tsx`**

```tsx
// components/anime/AnimeLODController.tsx
// Reads camera ↔ Earth distance each frame and exposes the current LOD
// level via a small subscription. Children read it through context;
// re-renders only happen on level changes (3 distinct values).

'use client';

import { createContext, useContext, useRef, useState, type ReactNode } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

import { useSceneStore } from '@/lib/sceneStore';
import { pickLod, type LodLevel } from '@/lib/anime/cluster';

const LodCtx = createContext<LodLevel>('far');
export const useAnimeLod = () => useContext(LodCtx);

export function AnimeLODController({ children }: { children: ReactNode }) {
  const { planets } = useSceneStore();
  const { camera } = useThree();
  const [lod, setLod] = useState<LodLevel>('far');
  const scratch = useRef(new THREE.Vector3());

  useFrame(() => {
    const earth = planets.get('earth');
    if (!earth?.ref.current) return;
    earth.ref.current.getWorldPosition(scratch.current);
    const d = camera.position.distanceTo(scratch.current);
    const next = pickLod(d);
    if (next !== lod) setLod(next);
  });

  return <LodCtx.Provider value={lod}>{children}</LodCtx.Provider>;
}
```

- [ ] **Step 3: Verify**

Run: `npm run lint && npm run build`
Expected: success.

- [ ] **Step 4: Commit**

```bash
git add lib/anime/cluster.ts components/anime/AnimeLODController.tsx
git commit -m "feat(anime): LOD controller + cluster math"
```

---

### Task 13: Cluster + point + poster layers

**Files:**
- Create: `components/anime/AnimeClusterPoints.tsx`
- Create: `components/anime/AnimePointMarkers.tsx`
- Create: `components/anime/AnimePosterCards.tsx`

- [ ] **Step 1: Write `AnimeClusterPoints.tsx` (far view)**

```tsx
// components/anime/AnimeClusterPoints.tsx
// Far-view layer: one InstancedMesh of small glowing dots, one
// instance per cluster bucket. Cheap enough to render thousands of
// buckets even on a phone.

'use client';

import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

import { buildClusters, clusterPrefixLen } from '@/lib/anime/cluster';
import type { AnimePoint, PointId } from '@/lib/anime/types';

const EARTH_RADIUS = 1.7; // matches components/planets/Earth.tsx
const COLOR = new THREE.Color('#9bd8ff');

type Props = {
  points: Record<PointId, AnimePoint>;
};

export function AnimeClusterPoints({ points }: Props) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const tmp = useMemo(() => new THREE.Object3D(), []);

  const clusters = useMemo(
    () => buildClusters(points, clusterPrefixLen('far'), EARTH_RADIUS),
    [points]
  );

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    clusters.forEach((c, i) => {
      tmp.position.copy(c.position);
      // Scale slightly with member count, capped so giants don't blob.
      const s = 0.012 + Math.min(0.018, c.points.length * 0.0006);
      tmp.scale.setScalar(s);
      // Orient flat against the surface — billboard against the
      // outward normal so they read as patches not spikes.
      tmp.lookAt(c.position.clone().multiplyScalar(2));
      tmp.updateMatrix();
      mesh.setMatrixAt(i, tmp.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.count = clusters.length;
  }, [clusters, tmp]);

  if (clusters.length === 0) return null;

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, clusters.length]}>
      <circleGeometry args={[1, 12]} />
      <meshBasicMaterial color={COLOR} transparent opacity={0.85} depthWrite={false} />
    </instancedMesh>
  );
}
```

- [ ] **Step 2: Write `AnimePointMarkers.tsx` (mid view)**

```tsx
// components/anime/AnimePointMarkers.tsx
// Mid-view: one InstancedMesh of small ring/dot pairs, one per point.
// Click target uses a Drei <Bvh>-style raycast surrogate: for an
// MVP-acceptable click hit, we put a transparent sphere overlay at
// each point and forward onClick to the store.

'use client';

import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

import { latLngToEarthSurface } from '@/lib/anime/coords';
import { useSceneStore } from '@/lib/sceneStore';
import type { AnimePoint, PointId } from '@/lib/anime/types';

const EARTH_RADIUS = 1.7;
const HIT_RADIUS = 0.012;

type Props = {
  points: Record<PointId, AnimePoint>;
};

export function AnimePointMarkers({ points }: Props) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const tmp = useMemo(() => new THREE.Object3D(), []);
  const list = useMemo(() => Object.values(points), [points]);
  const { setFocusedAnimePointId } = useSceneStore();

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    list.forEach((p, i) => {
      const pos = latLngToEarthSurface(p.lat, p.lng, EARTH_RADIUS, 0.004);
      tmp.position.copy(pos);
      tmp.scale.setScalar(HIT_RADIUS);
      tmp.lookAt(pos.clone().multiplyScalar(2));
      tmp.updateMatrix();
      mesh.setMatrixAt(i, tmp.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.count = list.length;
  }, [list, tmp]);

  if (list.length === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, list.length]}
      onClick={(e) => {
        e.stopPropagation();
        const idx = e.instanceId;
        if (idx === undefined) return;
        const p = list[idx];
        if (p) setFocusedAnimePointId(p.id);
      }}
      onPointerOver={() => {
        if (typeof document !== 'undefined') document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        if (typeof document !== 'undefined') document.body.style.cursor = 'auto';
      }}
    >
      <circleGeometry args={[1, 16]} />
      <meshBasicMaterial color="#cfe7ff" transparent opacity={0.95} depthWrite={false} />
    </instancedMesh>
  );
}
```

- [ ] **Step 3: Write `AnimePosterCards.tsx` (near view)**

```tsx
// components/anime/AnimePosterCards.tsx
// Near-view: per-point poster planes with on-demand textures. We cap
// concurrent texture loads at MAX_CONCURRENT to keep frame time
// stable. Posters are shown only for points within camera frustum
// AND within a small angular window of the camera-Earth direction —
// otherwise we'd try to render thousands.

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

import { latLngToEarthSurface } from '@/lib/anime/coords';
import { proxiedImageUrl } from '@/lib/anime/dataLoader';
import { useSceneStore } from '@/lib/sceneStore';
import type { AnimePoint, AnimeWork, PointId, WorkId } from '@/lib/anime/types';

const EARTH_RADIUS = 1.7;
const POSTER_SIZE = 0.18;
const POSTER_LIFT = 0.04;
const MAX_VISIBLE = 24;
const ANGLE_COS_THRESHOLD = 0.7; // ~45° cone from cam-to-earth axis
const FALLBACK_COLOR = new THREE.Color('#3a4660');

type Props = {
  points: Record<PointId, AnimePoint>;
  works: Record<WorkId, AnimeWork>;
};

const textureLoader = new THREE.TextureLoader();
textureLoader.crossOrigin = 'anonymous';
const textureCache = new Map<string, THREE.Texture | null>();
const inflight = new Set<string>();

function loadTexture(url: string): Promise<THREE.Texture | null> {
  if (textureCache.has(url)) return Promise.resolve(textureCache.get(url) ?? null);
  if (inflight.has(url)) {
    return new Promise((r) => {
      const tick = () => {
        if (textureCache.has(url)) r(textureCache.get(url) ?? null);
        else setTimeout(tick, 60);
      };
      tick();
    });
  }
  inflight.add(url);
  return new Promise((resolve) => {
    textureLoader.load(
      url,
      (t) => {
        t.colorSpace = THREE.SRGBColorSpace;
        textureCache.set(url, t);
        inflight.delete(url);
        resolve(t);
      },
      undefined,
      () => {
        textureCache.set(url, null);
        inflight.delete(url);
        resolve(null);
      }
    );
  });
}

type VisibleCard = {
  id: PointId;
  position: THREE.Vector3;
  normal: THREE.Vector3;
  posterUrl: string | null;
};

export function AnimePosterCards({ points, works }: Props) {
  const { planets } = useSceneStore();
  const { camera } = useThree();
  const [visible, setVisible] = useState<VisibleCard[]>([]);
  const earthCentre = useRef(new THREE.Vector3());
  const camDir = useRef(new THREE.Vector3());

  const all = useMemo(() => {
    const out: VisibleCard[] = [];
    for (const p of Object.values(points)) {
      const wid = p.workIds[0];
      const w = wid ? works[wid] : undefined;
      const url = proxiedImageUrl(p.imageUrl ?? w?.coverUrl ?? null);
      const pos = latLngToEarthSurface(p.lat, p.lng, EARTH_RADIUS, POSTER_LIFT);
      const normal = pos.clone().normalize();
      out.push({ id: p.id, position: pos, normal, posterUrl: url });
    }
    return out;
  }, [points, works]);

  useFrame(() => {
    const earth = planets.get('earth');
    if (!earth?.ref.current) return;
    earth.ref.current.getWorldPosition(earthCentre.current);
    camDir.current.subVectors(camera.position, earthCentre.current).normalize();

    // Only consider points within the visible-cap cone, sort by
    // proximity to camera, take top MAX_VISIBLE.
    const candidates: Array<{ card: VisibleCard; d: number }> = [];
    for (const card of all) {
      // Direction from earth centre to point in WORLD space —
      // earth.ref might be rotating, but coords.ts produces local
      // surface positions; the cone test is a coarse filter so we
      // accept the local-frame approximation here.
      if (camDir.current.dot(card.normal) < ANGLE_COS_THRESHOLD) continue;
      const worldPos = card.position.clone().add(earthCentre.current);
      const d = camera.position.distanceTo(worldPos);
      candidates.push({ card, d });
    }
    candidates.sort((a, b) => a.d - b.d);
    const next = candidates.slice(0, MAX_VISIBLE).map((c) => c.card);
    // Cheap identity check to avoid setState every frame.
    if (
      next.length !== visible.length ||
      next.some((c, i) => c.id !== visible[i]?.id)
    ) {
      setVisible(next);
    }
  });

  return (
    <group>
      {visible.map((card) => (
        <PosterPlane key={card.id} card={card} earthCentre={earthCentre} />
      ))}
    </group>
  );
}

function PosterPlane({
  card,
  earthCentre
}: {
  card: VisibleCard;
  earthCentre: React.MutableRefObject<THREE.Vector3>;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);
  const [tex, setTex] = useState<THREE.Texture | null>(null);
  const { setFocusedAnimePointId } = useSceneStore();

  useEffect(() => {
    let cancelled = false;
    if (!card.posterUrl) return;
    loadTexture(card.posterUrl).then((t) => {
      if (cancelled) return;
      setTex(t);
    });
    return () => {
      cancelled = true;
    };
  }, [card.posterUrl]);

  useEffect(() => {
    if (matRef.current) {
      matRef.current.map = tex;
      matRef.current.color = tex ? new THREE.Color('#ffffff') : FALLBACK_COLOR;
      matRef.current.needsUpdate = true;
    }
  }, [tex]);

  // Orient the poster along the surface normal, then tilt slightly
  // toward the camera so it reads even at grazing angles.
  useFrame(() => {
    const m = meshRef.current;
    if (!m) return;
    m.position.copy(card.position);
    m.lookAt(card.position.clone().multiplyScalar(2));
  });

  return (
    <mesh
      ref={meshRef}
      onClick={(e) => {
        e.stopPropagation();
        setFocusedAnimePointId(card.id);
      }}
    >
      <planeGeometry args={[POSTER_SIZE, POSTER_SIZE * 1.4]} />
      <meshBasicMaterial
        ref={matRef}
        color={FALLBACK_COLOR}
        transparent
        opacity={0.95}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}
```

- [ ] **Step 4: Verify**

Run: `npm run lint && npm run build`
Expected: success.

- [ ] **Step 5: Commit**

```bash
git add components/anime/AnimeClusterPoints.tsx components/anime/AnimePointMarkers.tsx components/anime/AnimePosterCards.tsx
git commit -m "feat(anime): cluster/marker/poster LOD layers"
```

---

### Task 14: `AnimeOverlay` aggregator

**Files:**
- Create: `components/anime/AnimeOverlay.tsx`

- [ ] **Step 1: Write the overlay**

```tsx
// components/anime/AnimeOverlay.tsx
// Anime-domain content layer mounted INSIDE Earth's tilted group so
// every point/cluster/poster co-rotates with the Earth surface.
// Switching cultural domain at the top level toggles whether this
// component is mounted at all.

'use client';

import { AnimeLODController, useAnimeLod } from './AnimeLODController';
import { AnimeClusterPoints } from './AnimeClusterPoints';
import { AnimePointMarkers } from './AnimePointMarkers';
import { AnimePosterCards } from './AnimePosterCards';
import { useAnimeData } from './useAnimeData';

export function AnimeOverlay() {
  const data = useAnimeData();

  if (data.status !== 'ready') return null;

  return (
    <AnimeLODController>
      <AnimeOverlayLayers />
    </AnimeLODController>
  );
}

function AnimeOverlayLayers() {
  const lod = useAnimeLod();
  const data = useAnimeData();
  if (data.status !== 'ready') return null;

  if (lod === 'far') return <AnimeClusterPoints points={data.points} />;
  if (lod === 'mid') return <AnimePointMarkers points={data.points} />;
  return <AnimePosterCards points={data.points} works={data.works} />;
}
```

- [ ] **Step 2: Commit**

```bash
git add components/anime/AnimeOverlay.tsx
git commit -m "feat(anime): AnimeOverlay LOD aggregator"
```

---

### Task 15: Mount the overlay inside Earth

**Files:**
- Modify: `components/planets/Earth.tsx`
- Modify: `components/space/Scene.tsx`

- [ ] **Step 1: Add `children` prop to `Earth`**

In `components/planets/Earth.tsx`:

```tsx
type Props = {
  orbitRadius: number;
  speed: number;
  initialAngle?: number;
  radius?: number;
  axialTilt?: number;
  /** Surface artifacts (Apollo, etc.) placed on the Moon. */
  moonChildren?: ReactNode;
  /** Children rendered inside Earth's tilted group, co-rotating with
   *  the surface. Used by the anime cultural domain overlay. */
  children?: ReactNode;
};
```

In the JSX, **inside** `<group rotation={[0, 0, axialTilt]}>` and **after** the atmosphere mesh:

```tsx
        {children}
```

- [ ] **Step 2: Conditionally mount in `Scene.tsx`**

At the top of `components/space/Scene.tsx`:

```tsx
import { useSceneStore } from '@/lib/sceneStore';
import { AnimeOverlay } from '@/components/anime/AnimeOverlay';
```

Inside `Scene()`, before `return`:

```tsx
  const { domain } = useSceneStore();
```

Update the `<Earth>` JSX to add `children` and conditionally pass `<PostersLayer />`:

```tsx
        <Earth
          orbitRadius={32}
          speed={0.07}
          initialAngle={0.5}
          moonChildren={
            <SurfaceArtifact ... /* unchanged */ />
          }
        >
          {domain === 'anime' && <AnimeOverlay />}
        </Earth>
```

And replace `<PostersLayer />` with:

```tsx
        {domain === 'scifi' && <PostersLayer />}
```

- [ ] **Step 3: Manual smoke**

Run: `npm run dev`. In `app/page.tsx`, temporarily force `domain='anime'` by setting `localStorage.setItem('portal:domain','anime')` in the browser console and reloading.

Expected:
- Earth still renders; sci-fi posters disappear
- Many small cyan dots scattered on Earth's surface (clusters at far view)
- Zoom in (mouse wheel) → dots become slightly brighter (mid view)
- Zoom in further → poster planes start fetching textures from `/api/img?...`; visible in Network tab as same-origin

Reset: `localStorage.removeItem('portal:domain')` and reload.

- [ ] **Step 4: Commit**

```bash
git add components/planets/Earth.tsx components/space/Scene.tsx
git commit -m "feat(anime): mount AnimeOverlay inside Earth + gate posters by domain"
```

---

## Phase 4 — UI: Domain Switcher & Detail Card

### Task 16: `DomainSwitcher` capsule

**Files:**
- Create: `components/ui/DomainSwitcher.tsx`
- Modify: `components/ui/HUD.tsx`

- [ ] **Step 1: Write the switcher**

```tsx
// components/ui/DomainSwitcher.tsx
// Small two-state pill in the HUD. Switching domain wipes any active
// scifi journey + anime focus so the user re-enters cleanly.

'use client';

import { useSceneStore } from '@/lib/sceneStore';
import { DOMAIN_LABELS, type CulturalDomain } from '@/lib/domain';

export function DomainSwitcher() {
  const {
    domain,
    setDomain,
    setNavigatorPhase,
    setJourney,
    setFocusedAnimePointId,
    setAnimeNavigatorPhase,
    setAnimeJourney,
    setFocused,
    setFocusedArtifact
  } = useSceneStore();

  const switchTo = (next: CulturalDomain) => {
    if (next === domain) return;
    // Clean both state machines so neither bleeds across the swap.
    setNavigatorPhase('closed');
    setJourney(null);
    setAnimeNavigatorPhase('closed');
    setAnimeJourney(null);
    setFocusedAnimePointId(null);
    setFocused(null);
    setFocusedArtifact(null);
    setDomain(next);
  };

  return (
    <div className="pointer-events-auto fixed top-6 right-6 z-30 flex gap-px border border-stardust/15 bg-deep/55 backdrop-blur-sm">
      {(Object.keys(DOMAIN_LABELS) as CulturalDomain[]).map((d) => {
        const active = d === domain;
        return (
          <button
            key={d}
            type="button"
            onClick={() => switchTo(d)}
            className={`px-4 py-2 text-[11px] tracking-cosmic uppercase transition-colors duration-300 ${
              active
                ? 'bg-stardust/15 text-stardust'
                : 'text-stardust/45 hover:text-stardust/85'
            }`}
          >
            {DOMAIN_LABELS[d].zh} · {DOMAIN_LABELS[d].en}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Mount it in HUD**

In `components/ui/HUD.tsx`, add the import and render:

```tsx
import { DomainSwitcher } from './DomainSwitcher';
```

Add `<DomainSwitcher />` near the top of the HUD's returned JSX (before/after the existing top-bar elements — find a free corner).

- [ ] **Step 3: Manual smoke**

Run: `npm run dev`. Click the toggle.

Expected:
- Toggle reflects state
- Switching to 二次元 reloads anime overlay; switching back to 科幻 brings posters back

- [ ] **Step 4: Commit**

```bash
git add components/ui/DomainSwitcher.tsx components/ui/HUD.tsx
git commit -m "feat(anime): domain switcher in HUD"
```

---

### Task 17: `AnimeDetailCard` — point detail panel

**Files:**
- Create: `components/anime/AnimeDetailCard.tsx`
- Modify: `app/page.tsx`

- [ ] **Step 1: Write the card**

```tsx
// components/anime/AnimeDetailCard.tsx
// 2D HUD overlay: opens when focusedAnimePointId is non-null.
// Loads the point's detail shard on demand.

'use client';

import { useEffect, useState } from 'react';

import { useSceneStore } from '@/lib/sceneStore';
import { loadPointDetail, loadPointsIndex, loadWorks, proxiedImageUrl } from '@/lib/anime/dataLoader';
import type { AnimePoint, AnimePointDetail, AnimeWork } from '@/lib/anime/types';

export function AnimeDetailCard() {
  const { focusedAnimePointId, setFocusedAnimePointId, domain } = useSceneStore();
  const [point, setPoint] = useState<AnimePoint | null>(null);
  const [detail, setDetail] = useState<AnimePointDetail | null>(null);
  const [works, setWorks] = useState<AnimeWork[]>([]);

  useEffect(() => {
    if (!focusedAnimePointId || domain !== 'anime') {
      setPoint(null);
      setDetail(null);
      setWorks([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const [pts, allWorks] = await Promise.all([loadPointsIndex(), loadWorks()]);
      if (cancelled) return;
      const p = pts[focusedAnimePointId] ?? null;
      setPoint(p);
      setWorks(p?.workIds.map((id) => allWorks[id]).filter(Boolean) ?? []);
      const d = await loadPointDetail(focusedAnimePointId);
      if (!cancelled) setDetail(d);
    })().catch(() => {
      if (!cancelled) {
        setPoint(null);
        setDetail(null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [focusedAnimePointId, domain]);

  if (!focusedAnimePointId || domain !== 'anime' || !point) return null;

  return (
    <div className="pointer-events-auto fixed bottom-6 right-6 z-30 w-[360px] max-w-[calc(100vw-48px)] bg-deep/85 backdrop-blur-md border border-stardust/15 px-6 py-5">
      <div className="flex items-baseline justify-between">
        <div className="text-stardust/85 text-[11px] tracking-cosmic uppercase">
          界门 · 巡礼
        </div>
        <button
          type="button"
          onClick={() => setFocusedAnimePointId(null)}
          className="text-stardust/35 hover:text-stardust/85 text-lg leading-none transition-colors"
          aria-label="Close"
        >
          ×
        </button>
      </div>

      {point.imageUrl && (
        <img
          src={proxiedImageUrl(point.imageUrl) ?? ''}
          alt=""
          crossOrigin="anonymous"
          className="mt-4 w-full h-44 object-cover bg-stardust/5"
        />
      )}

      <div className="mt-4 text-stardust text-[15px] tracking-wider2">
        {point.nameZh ?? point.name ?? point.id}
      </div>
      {point.name && point.nameZh && point.name !== point.nameZh && (
        <div className="text-stardust/55 text-[11px] tracking-wider2">{point.name}</div>
      )}

      {detail?.mark && (
        <p className="mt-3 text-stardust/75 text-[12px] tracking-wider2 leading-relaxed">
          {detail.mark}
        </p>
      )}

      {works.length > 0 && (
        <div className="mt-4 border-t border-stardust/10 pt-3">
          <div className="text-stardust/45 text-[10px] tracking-cosmic uppercase mb-2">
            作品 · Works
          </div>
          <ul className="space-y-1">
            {works.map((w) => (
              <li key={w.id} className="text-stardust/85 text-[12px] tracking-wider2">
                {w.titleZh}
                {w.titleOrigin && w.titleOrigin !== w.titleZh && (
                  <span className="text-stardust/45"> · {w.titleOrigin}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {detail?.origin && (
        <div className="mt-3 text-stardust/35 text-[10px] tracking-wider2 leading-relaxed">
          来源：{detail.origin}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Mount in page**

In `app/page.tsx`, add inside `<main>`:

```tsx
import { AnimeDetailCard } from '@/components/anime/AnimeDetailCard';
```

```tsx
        <AnimeDetailCard />
```

- [ ] **Step 3: Manual smoke**

Run: `npm run dev`, switch to 二次元, zoom in to mid LOD, click a marker.

Expected: detail card slides in bottom-right with image (proxied) + name + work titles.

- [ ] **Step 4: Commit**

```bash
git add components/anime/AnimeDetailCard.tsx app/page.tsx
git commit -m "feat(anime): point detail card"
```

---

## Phase 5 — AI Anime Journey

### Task 18: Search candidate selection

**Files:**
- Create: `lib/anime/searchClient.ts`

- [ ] **Step 1: Write the helper**

```ts
// lib/anime/searchClient.ts
// Token-overlap scorer: given the user's query and a search index,
// rank pointIds by how many query tokens appear in their token bag.
// Returns top-K candidates — the LLM is then asked to pick a route
// from these.
//
// Used server-side by /api/animeJourney; importable client-side too.

import type { AnimeSearchIndex, PointId } from './types';

function tokenize(s: string): string[] {
  if (!s) return [];
  const lower = s.toLowerCase();
  const out = new Set<string>();
  for (const piece of lower.split(/[\s,，、。.\-—_/()（）【】「」『』：:;；!?·]+/)) {
    if (!piece) continue;
    out.add(piece);
    if (/[一-鿿぀-ヿ]/.test(piece) && piece.length > 1) {
      for (const ch of piece) out.add(ch);
    }
  }
  return [...out];
}

export function selectCandidates(
  query: string,
  index: AnimeSearchIndex,
  topK = 50
): PointId[] {
  const qToks = new Set(tokenize(query));
  if (qToks.size === 0) return [];
  const scored: Array<{ id: PointId; score: number }> = [];
  for (const [pid, toks] of Object.entries(index.pointTokens)) {
    let score = 0;
    for (const t of toks) if (qToks.has(t)) score++;
    if (score > 0) scored.push({ id: pid, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK).map((s) => s.id);
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/anime/searchClient.ts
git commit -m "feat(anime): token-overlap candidate scorer"
```

---

### Task 19: `/api/animeJourney`

**Files:**
- Create: `app/api/animeJourney/route.ts`

- [ ] **Step 1: Write the route**

```ts
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
```

- [ ] **Step 2: Verify**

Run: `npm run lint && npm run build`
Expected: success.

- [ ] **Step 3: Manual smoke**

Run: `npm run dev`. With `.env.local` populated, in browser console:

```js
await fetch('/api/animeJourney', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ mood: '想看秩父和你的名字相关地标' })
}).then(r => r.json())
```

Expected: `{ ok: true, journey: { mood, stops: [...], closing } }` with 4–6 valid pointIds.

- [ ] **Step 4: Commit**

```bash
git add app/api/animeJourney/route.ts
git commit -m "feat(anime): /api/animeJourney route with token-overlap candidates"
```

---

### Task 20: Wire Navigator → anime API

**Files:**
- Modify: `components/navigator/Navigator.tsx`

- [ ] **Step 1: Branch on domain inside `submit`**

Add to imports:

```tsx
import type { AnimeJourneyApiResponse } from '@/lib/anime/animeJourneyTypes';
```

In the `Navigator` component body, also pull the new state:

```tsx
const {
  domain,
  setAnimeNavigatorPhase,
  setAnimeJourney,
  setAnimeJourneyStopIndex,
  // ... existing
} = useSceneStore();
```

Replace the body of `submit` with:

```ts
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
```

- [ ] **Step 2: Update placeholder strings when in anime domain**

Above the existing `PLACEHOLDERS` const, add:

```tsx
const ANIME_PLACEHOLDERS = [
  '想去秩父巡礼…',
  '想看东京塔和咖啡馆相关的地标',
  '《你的名字》取景地',
  '想找京都的动画地点',
  '夏日祭典的地标',
  '海边小镇巡礼'
];
```

In the JSX where `placeholder={PLACEHOLDERS[placeholderIdx]}` is used, change to:

```tsx
placeholder={(domain === 'anime' ? ANIME_PLACEHOLDERS : PLACEHOLDERS)[placeholderIdx % (domain === 'anime' ? ANIME_PLACEHOLDERS.length : PLACEHOLDERS.length)]}
```

And in the rotation effect, the modulo is fine because `placeholderIdx` is just an int.

- [ ] **Step 3: Commit**

```bash
git add components/navigator/Navigator.tsx
git commit -m "feat(anime): Navigator branches to /api/animeJourney in anime domain"
```

---

### Task 21: Anime journey playback controller

**Files:**
- Create: `components/anime/AnimeJourneyController.tsx`
- Modify: `app/page.tsx`

**Strategy note:** scifi journey playback uses `JourneyController` which leans on `setFocused` / `setFocusedArtifact` to drive the camera through `CameraRig`. For anime stops the “target” is a lat/lng on Earth's surface — not a planet body and not an artifact. The simplest cinematic path that respects existing systems:

1. Set `focused = 'earth'` so the rig flies the camera to Earth.
2. After the rig completes, take over with a small per-frame override that rotates the camera around the surface point. We do this by directly tweening `controlsRef.current.target` toward the stop's world position and keeping the camera at a small radius offset — outside `CameraRig`, in the anime controller's own `useFrame`.

This avoids touching `CameraRig.tsx`. If conflicts emerge, a future iteration can add an `'animePoint'` focus mode there.

- [ ] **Step 1: Write the controller**

```tsx
// components/anime/AnimeJourneyController.tsx
// Drives the camera through an AnimeJourney's stops. Each stop:
//   1. Set focused='earth' so CameraRig flies us to Earth at orbit alt
//   2. After ~3s settle, lerp orbitControls.target toward the lat/lng
//      world position and pull camera radius down to ~0.45 over 4s
//   3. Hold ~5.5s with subtitle visible; advance to next stop
//
// We pre-fetch nothing here (TTS is out of scope for the anime domain
// in MVP per Out of scope). Subtitles are shown in the Subtitle layer
// when `animeNavigatorPhase === 'running'` — see Step 3 of Task 22.

'use client';

import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

import { useSceneStore } from '@/lib/sceneStore';
import { latLngToEarthSurface } from '@/lib/anime/coords';
import { loadPointsIndex } from '@/lib/anime/dataLoader';
import type { AnimePoint, PointId } from '@/lib/anime/types';

const EARTH_RADIUS = 1.7;
const STOP_HOLD_MS = 5500;
const SETTLE_MS = 3000;

export function AnimeJourneyController() {
  const {
    domain,
    animeNavigatorPhase,
    animeJourney,
    animeJourneyStopIndex,
    setAnimeJourneyStopIndex,
    setAnimeNavigatorPhase,
    setFocusedAnimePointId,
    setFocused,
    planets,
    controlsRef
  } = useSceneStore();

  const { camera } = useThree();
  const pointsRef = useRef<Record<PointId, AnimePoint> | null>(null);
  const localTarget = useRef(new THREE.Vector3());
  const desiredCam = useRef(new THREE.Vector3());
  const earthCentre = useRef(new THREE.Vector3());
  const phaseRef = useRef<'settling' | 'descending' | 'holding' | 'idle'>('idle');
  const phaseStartedAt = useRef(0);

  useEffect(() => {
    loadPointsIndex().then((p) => (pointsRef.current = p)).catch(() => {});
  }, []);

  // On (re)entering 'running', pin focused=earth so CameraRig lifts us.
  useEffect(() => {
    if (
      domain === 'anime' &&
      animeNavigatorPhase === 'running' &&
      animeJourney &&
      animeJourneyStopIndex < animeJourney.stops.length
    ) {
      setFocused('earth');
      phaseRef.current = 'settling';
      phaseStartedAt.current = performance.now();
      const stop = animeJourney.stops[animeJourneyStopIndex];
      setFocusedAnimePointId(stop.pointId);
    }
    if (animeNavigatorPhase !== 'running') {
      phaseRef.current = 'idle';
    }
  }, [
    domain,
    animeNavigatorPhase,
    animeJourney,
    animeJourneyStopIndex,
    setFocused,
    setFocusedAnimePointId
  ]);

  useFrame(() => {
    if (
      domain !== 'anime' ||
      animeNavigatorPhase !== 'running' ||
      !animeJourney ||
      !pointsRef.current ||
      !controlsRef.current
    ) {
      return;
    }
    const stop = animeJourney.stops[animeJourneyStopIndex];
    if (!stop) return;
    const point = pointsRef.current[stop.pointId];
    if (!point) return;

    const earth = planets.get('earth');
    if (!earth?.ref.current) return;
    earth.ref.current.getWorldPosition(earthCentre.current);

    // local-frame surface position → world-space.
    localTarget.current
      .copy(latLngToEarthSurface(point.lat, point.lng, EARTH_RADIUS, 0.005))
      .add(earthCentre.current);

    const now = performance.now();
    const elapsed = now - phaseStartedAt.current;

    if (phaseRef.current === 'settling') {
      // CameraRig handles the move to Earth; just wait.
      if (elapsed > SETTLE_MS) {
        phaseRef.current = 'descending';
        phaseStartedAt.current = now;
      }
      return;
    }

    if (phaseRef.current === 'descending' || phaseRef.current === 'holding') {
      // Lerp target toward surface point + pull camera radius in.
      const t = Math.min(1, (now - phaseStartedAt.current) / 4000);
      controlsRef.current.target.lerp(localTarget.current, t * 0.05);
      const dirToCam = camera.position.clone().sub(controlsRef.current.target);
      const len = dirToCam.length();
      const desiredRadius = THREE.MathUtils.lerp(8, 0.45, t);
      dirToCam.multiplyScalar(desiredRadius / Math.max(len, 0.0001));
      desiredCam.current.copy(controlsRef.current.target).add(dirToCam);
      camera.position.lerp(desiredCam.current, 0.04);
      camera.lookAt(controlsRef.current.target);

      if (phaseRef.current === 'descending' && t >= 1) {
        phaseRef.current = 'holding';
        phaseStartedAt.current = now;
      }
      if (phaseRef.current === 'holding' && now - phaseStartedAt.current > STOP_HOLD_MS) {
        const next = animeJourneyStopIndex + 1;
        if (next < animeJourney.stops.length) {
          setAnimeJourneyStopIndex(next);
          phaseRef.current = 'settling';
          phaseStartedAt.current = now;
          const nstop = animeJourney.stops[next];
          setFocusedAnimePointId(nstop.pointId);
        } else {
          setAnimeNavigatorPhase('summary');
        }
      }
    }
  });

  return null;
}
```

- [ ] **Step 2: Mount in `app/page.tsx`**

```tsx
import { AnimeJourneyController } from '@/components/anime/AnimeJourneyController';
```

The controller uses `useFrame`, so it must live inside the R3F Canvas. **It cannot be a sibling of `<Scene>`** — instead, expose it through `Scene`:

In `components/space/Scene.tsx`, inside the `<Suspense>` block, after `<CameraRig />`:

```tsx
        {domain === 'anime' && <AnimeJourneyController />}
```

and import it at the top:

```tsx
import { AnimeJourneyController } from '@/components/anime/AnimeJourneyController';
```

- [ ] **Step 3: Add a small Subtitle bridge**

`components/navigator/Subtitle.tsx` reads `journey` and `journeyStopIndex`. Either:
- (a) make it also read `animeJourney` / `animeJourneyStopIndex` when `domain === 'anime'`, or
- (b) create a thin wrapper.

Pick (a) for fewer files. In `components/navigator/Subtitle.tsx`, branch on `domain` to pick which `journey` + `stopIndex` to read. The card body becomes the stop's `narration` directly.

> Concrete edit: read the file first; locate the `useSceneStore` destructure; change to use `domain === 'anime' ? animeJourney : journey` and similarly for the index. Defer this micro-edit until you're in this Task — the diff is mechanical.

- [ ] **Step 4: Manual smoke**

Run: `npm run dev`. Switch to 二次元. ⌘K, type a query, submit.

Expected:
- `previewing` shows a 4–6 stop preview (reuse the existing JourneyPreview if simple, or skip preview entirely and go straight to running — your call. **For MVP, jump straight from `previewing` to `running` after 1.2 s** to avoid having to fork the preview UI; mark this with a TODO line in `AnimeJourneyController` only if you skip preview).
- `running` flies the camera to Earth, descends near each stop, hold ~5.5s, advances; subtitles show narration.
- After last stop, `summary` takes over — it can be the existing `JourneySummary` reading `animeJourney`/`mood`/`closing` (apply same domain-branching pattern as Subtitle).

- [ ] **Step 5: Commit**

```bash
git add components/anime/AnimeJourneyController.tsx components/space/Scene.tsx components/navigator/Subtitle.tsx
git commit -m "feat(anime): journey playback controller + subtitle bridge"
```

---

## Phase 6 — Polish & Verification

### Task 22: Screenshot export verification

**Why this exists:** A core acceptance criterion is that screenshots include poster textures (proves canvas isn't tainted). `html-to-image` is already in `package.json`. The HUD likely already exposes a screenshot button — if not, this Task adds a minimal one.

**Files:**
- Verify: `components/ui/HUD.tsx`
- (Maybe) Modify: `components/ui/HUD.tsx`

- [ ] **Step 1: Locate the screenshot trigger**

Run: `grep -n "html-to-image\|toCanvas\|toBlob\|screenshot\|截图" -r components`
Expected: at least one hit. If none, add a button with `import { toBlob } from 'html-to-image'` calling `toBlob(canvas)` and downloading the result. Bind to a small camera icon in the HUD.

- [ ] **Step 2: Capture in anime mode**

Run: `npm run dev`. Switch to 二次元, zoom to near LOD with at least 4 visible posters loaded. Trigger the screenshot.

Expected: Saved PNG **contains** the poster images (not blank rectangles). If posters are blank, the canvas is tainted — debug by checking that all texture URLs go through `/api/img` and that `crossOrigin="anonymous"` is set on the loader.

- [ ] **Step 3: Capture in scifi mode (regression)**

Switch back to 科幻. Trigger screenshot.
Expected: still includes scifi posters as before — sanity check that the proxy didn't break the existing flow.

- [ ] **Step 4: Commit (if changes)**

```bash
git add components/ui/HUD.tsx
git commit -m "feat(anime): verify screenshot export incl. poster textures"
```

If no code changes were needed, skip the commit.

---

### Task 23: README + comments cleanup

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add a section under "添加内容"**

Append:

```markdown
### 添加 / 更新二次元领域数据

二次元（anime）文化领域使用 anitabi 圣地巡礼数据，以预构建的静态包形式落在 `public/data/anime/anitabi/`。仓库中已包含一个最小演示数据集（约 30 部作品），如需重建：

```bash
npm run build:anime           # 抓取 anitabi 全量并写入 public/data/anime/anitabi/
npm run build:anime:demo      # 截取演示子集（top N 作品）—— 提交到仓库
```

切换到二次元领域：右上角胶囊「二次元 · Anime」。点击地球表面的地标查看详情；按 ⌘K 让 AI 策划一条巡礼路线。

详细架构见 `docs/2026-05-16-portal-anitabi-anime-domain-design.md` 与 `docs/superpowers/plans/2026-05-17-anime-cultural-domain.md`。
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: anime domain build + usage notes"
```

---

### Task 24: End-to-end smoke

**No file changes.** This is a final manual pass against the Definition of Done from the design doc.

- [ ] **Step 1: Far view — clusters render, no jank**

Run: `npm run dev`. Default landing → 二次元.
Expected: Earth visible from overview, surface dotted with clusters. FPS in DevTools Performance ≥ 50 on mid-range laptop.

- [ ] **Step 2: Mid view — markers click → detail card**

Wheel-zoom toward Earth until clusters resolve into points. Click any marker.
Expected: Detail card opens bottom-right with image (proxied through `/api/img`), name, work titles.

- [ ] **Step 3: Near view — posters load**

Zoom further. Posters appear, ≤24 simultaneously, with placeholder colour while textures load.
Expected: textures finish loading within ~3s on broadband.

- [ ] **Step 4: Screenshot export contains textures**

Trigger screenshot. Verify posters are visible in the saved file.

- [ ] **Step 5: AI journey runs**

⌘K, enter `想看《你的名字》系列地标` (or similar). Submit.
Expected: 4–6 stops, camera flies to Earth then descends near each landmark, narration shown as subtitles, advances ~9s/stop, summary at the end.

- [ ] **Step 6: Domain switch keeps scifi intact**

Switch back to 科幻. Trigger an old scifi journey via ⌘K.
Expected: works exactly as before — no anime artifacts persist.

- [ ] **Step 7: Final lint + build**

Run: `npm run lint && npm run build`
Expected: zero errors. Bundle size should not regress more than ~30 KB gzipped vs the pre-feature baseline (the data pack is loaded as static JSON, not bundled).

- [ ] **Step 8: Final commit (if any cleanups)**

```bash
git add -p
git commit -m "chore(anime): post-smoke cleanups"
```

---

## Self-Review

**1. Spec coverage**

| Spec section | Implemented in |
|---|---|
| §3.1 G1 — 二次元领域切换 | Task 1, 2, 16 |
| §3.1 G2 — 远景聚类 / 中景点位 / 近景海报 | Tasks 12, 13, 14, 15 |
| §3.1 G3 — 点击地标详情 | Task 17 |
| §3.1 G4 — 截图含贴图 | Tasks 9, 22 |
| §3.1 G5 — `/api/animeJourney` AI 路线 | Tasks 5, 18, 19, 20, 21 |
| §3.1 G6 — 数据包内置 + 在线更新 | Tasks 6–8, 10 (IndexedDB cache acts as the “在线更新” substrate; no UI button in MVP — listed as an Out-of-scope deferral) |
| §4 不扩展 PlanetId/SpacecraftId 封闭联合 | File Structure 段明确 “不修改” + Task 5 用独立类型 |
| §6.x 数据包 schema | Tasks 6, 7, 8 输出与 schema 对齐 |
| §7 LOD | Tasks 12, 13, 14 |
| §8 图片代理 | Task 9 |
| §9 AnimeJourney schema + 检索→候选→LLM | Tasks 5, 18, 19 |
| §10 风险与降级 (占位贴图、并发上限、IndexedDB 覆盖) | Tasks 10, 13 (`MAX_VISIBLE`, `FALLBACK_COLOR`) |
| §11 Definition of Done | Task 24 |

**Gaps consciously deferred:** “在线更新”按钮 UI、anime TTS、聚类算法 R-tree 替换、热度统计 `stats.json` —— 列在 Out of scope 与 §12 未决项。

**2. Placeholder scan**

- No “TBD” / “TODO” / “fill in later” strings (the one TODO mention is an *instruction* about how to skip Preview if doing MVP-fast, not a placeholder in produced code).
- No `Similar to Task N` shorthand.
- One soft-handoff in Task 21 Step 3 (Subtitle bridge): the diff is mechanical and the file's small enough that the implementer reading the file once is the right call. This isn't a placeholder — the rule is described concretely and the surface area is 5 lines.

**3. Type consistency**

- `PointId` (string), `WorkId` (number) defined in `lib/anime/types.ts` Task 3 — used identically in Tasks 5, 10, 11, 13, 17, 18, 19, 21.
- `AnimeStop.workId: WorkId | null` — set by API (Task 19), consumed by client only as display data; consistent.
- `loadPointDetail`, `loadDetailShard`, `loadPointsIndex`, `loadWorks`, `loadSearchIndex`, `proxiedImageUrl` — exported from Task 10, imported (matching names) in Tasks 11, 17, 19, 21. Verified.
- `useAnimeData` returned shape `{ status: 'ready'; manifest; works; points }` — same destructure in Task 14 (`AnimeOverlay`) and would be in Task 17 if used (currently uses raw loaders for fewer renders — intentional).
- `setFocusedAnimePointId`, `setAnimeNavigatorPhase`, `setAnimeJourney`, `setAnimeJourneyStopIndex` defined in Task 2, used in Tasks 13, 16, 17, 20, 21 — names match.
- `domain` selector in `useSceneStore`: spelling `domain` (not `culturalDomain`) consistent across Tasks 2, 15, 16, 17, 20, 21.

**Risk that wasn't worth a re-review:** if the anitabi point-tuple field order has shifted since the design doc was written, `decode.mjs` (Task 6) will produce wrong `name`/`image` mappings. The script is tolerant (out-of-range → null) so it won't crash, but a sanity check at Step 5 of Task 7 should be: open `points_index.json` and verify some point has both `nameZh` and `imageUrl` set. Added that note to Task 7 Step 5? — yes, the build script logs counts; if "points with detail" is suspiciously low, re-check the tuple order against `https://www.anitabi.cn` source.

---

## Execution Notes

- **Anitabi terms / robots:** the site publishes these JSONs publicly with no auth and no listed prohibition; the build pipeline includes a deliberate `User-Agent` and respects upstream caching. Avoid hammering — `_raw/` cache + `--force` flag means most runs are local-only.
- **Data pack size:** the `npm run build:anime:demo` step is mandatory for any commit that ships data; the full pack should never be committed (~hundreds of MB). Future CI should reject commits where `public/data/anime/anitabi/` exceeds 5 MB.
- **One-task-at-a-time:** the plan is structured so each Task is independently runnable + verifiable; subagent-driven-development is recommended.

