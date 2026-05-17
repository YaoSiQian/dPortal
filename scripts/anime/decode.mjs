// scripts/anime/decode.mjs
// Anitabi compact-array decoder. Field indices are calibrated against
// the live anitabi schema captured during the first build run; see
// docs/superpowers/plans/2026-05-17-anime-cultural-domain.md for the
// reverse-engineered tuple layout. The schema has shifted before, so
// missing/typewrong fields degrade to null rather than crashing.

import { absolutiseUrl } from './utils.mjs';

/** Strings appear as the literal number 0 when absent in some fields.
 *  Treat any non-string (or empty string) as null. */
function s(v) {
  return typeof v === 'string' && v.length > 0 ? v : null;
}

export function decodeWork(arr) {
  // Work tuple length is ~17. We only consume the indices we use.
  const id = arr?.[0];
  const titleZh = s(arr?.[1]) ?? '';
  const titleEn = s(arr?.[2]);
  const titleJa = s(arr?.[3]);
  // Prefer the Japanese original when present; fall back to the
  // English alt; fall back to titleZh so we always have something.
  const titleOrigin = titleJa ?? titleEn ?? titleZh;
  const city = s(arr?.[4]);
  const themeColor = s(arr?.[5]);
  const coverUrl = absolutiseUrl(s(arr?.[6]));
  const typeTag = s(arr?.[8]);
  const pointsFlat = arr?.[12];
  const extraTags = Array.isArray(arr?.[14]) ? arr[14].filter((t) => typeof t === 'string') : [];

  const tags = typeTag ? [typeTag, ...extraTags] : extraTags;

  const points = [];
  if (Array.isArray(pointsFlat)) {
    for (let i = 0; i + 2 < pointsFlat.length; i += 4) {
      const pid = pointsFlat[i];
      const lat = pointsFlat[i + 1];
      const lng = pointsFlat[i + 2];
      if (typeof pid === 'string' && typeof lat === 'number' && typeof lng === 'number') {
        points.push({ id: pid, lat, lng });
      }
    }
  }

  return {
    id: typeof id === 'number' ? id : Number(id),
    titleZh,
    titleOrigin,
    city,
    tags,
    coverUrl,
    themeColor,
    points
  };
}

export function decodePoint(arr, workId) {
  // Point tuple length is ~15. The live schema currently has:
  //   [0] id, [1] name, [2] nameZh, [6] image, [9] origin, [10] mark
  // Fields not yet identified are skipped.
  const id = s(arr?.[0]) ?? '';
  const name = s(arr?.[1]);
  const nameZh = s(arr?.[2]);
  const imageUrl = absolutiseUrl(s(arr?.[6]));
  const origin = s(arr?.[9]);
  const mark = s(arr?.[10]);

  return {
    id,
    name,
    nameZh,
    imageUrl,
    mark,
    origin,
    originLink: null,
    episode: { workId, ep: null, time: null }
  };
}
