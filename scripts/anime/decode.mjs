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
