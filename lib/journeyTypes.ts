// Shared types between the /api/journey route and the Navigator client.
// The LLM is asked to return JSON in this exact shape; the route validates
// every field against journeyInventory before sending it back.

import type { PlanetId } from './sceneStore';

export type StopTarget =
  | { kind: 'planet'; id: PlanetId }
  | { kind: 'spacecraft'; id: SpacecraftId };

export type JourneyStop = {
  target: StopTarget;
  /** 1-2 cinematic sentences in Chinese, ~30-60 chars. */
  narration: string;
  /** Path into MOVIES_BY_PATH, OR null when no film in the inventory truly
   *  matches the focal subject (the actual spacecraft / specific moon).
   *  When null, the StopCard falls back to showing the subject's own
   *  description from the inventory. */
  filmPath: string | null;
};

export type Journey = {
  /** 8-12 Chinese chars summarising the user's mood as the LLM read it. */
  mood: string;
  stops: JourneyStop[];
  /** A single closing line, ~20 chars, shown on the summary card. */
  closing: string;
};

export type SpacecraftId =
  | 'apollo_lm'
  | 'viking_1'
  | 'perseverance'
  | 'ingenuity'
  | 'iss'
  | 'hubble'
  | 'lro'
  | 'cassini'
  | 'voyager_1';

export type JourneyApiResponse =
  | { ok: true; journey: Journey }
  | { ok: false; error: string };
