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
    cachedWorks = (async (): Promise<Record<WorkId, AnimeWork>> => {
      const m = await loadManifest();
      return loadVersioned(`works:${m.version}`, `${BASE}/works.min.json`, m.version);
    })();
  }
  return cachedWorks;
}

export function loadPointsIndex(): Promise<Record<PointId, AnimePoint>> {
  if (!cachedPoints) {
    cachedPoints = (async (): Promise<Record<PointId, AnimePoint>> => {
      const m = await loadManifest();
      return loadVersioned(`points:${m.version}`, `${BASE}/points_index.json`, m.version);
    })();
  }
  return cachedPoints;
}

export function loadSearchIndex(): Promise<AnimeSearchIndex> {
  if (!cachedSearch) {
    cachedSearch = (async (): Promise<AnimeSearchIndex> => {
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
