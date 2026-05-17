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

const TOP_N = 3;
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
