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
