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
