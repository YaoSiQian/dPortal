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
