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
