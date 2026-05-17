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
