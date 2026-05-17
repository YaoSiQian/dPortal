// scripts/anime/build-anitabi.mjs
// Portal × anitabi build pipeline. Fetches the public static JSON,
// decodes the compact arrays, normalises URLs, shards detail JSON
// by geohash prefix, builds a search index, writes everything to
// public/data/anime/anitabi/.
//
// Run: npm run build:anime [--force]

import fs from 'node:fs/promises';
import path from 'node:path';

import {
  fetchJsonCached,
  ensureDir,
  log,
  OUT_DIR
} from './utils.mjs';
import { decodeWork, decodePoint } from './decode.mjs';
import { shardByPrefix } from './shard.mjs';
import { buildSearchIndex } from './buildSearchIndex.mjs';

const force = process.argv.includes('--force');
const DETAIL_PREFIX_LEN = 2;

async function main() {
  await ensureDir(OUT_DIR);
  await ensureDir(path.join(OUT_DIR, 'points_detail_shards'));

  // 1) Fetch g.json (works + points_flat)
  const gRaw = await fetchJsonCached('/d/g.json', { force });
  if (!Array.isArray(gRaw) || !Array.isArray(gRaw[0])) {
    throw new Error('Unexpected g.json shape');
  }
  const [bangumiList, , modifiedTs] = gRaw;
  log('g.json works:', bangumiList.length);

  const works = {};
  const points = {};
  for (const arr of bangumiList) {
    const w = decodeWork(arr);
    if (!w.id) continue;
    works[w.id] = {
      id: w.id,
      titleZh: w.titleZh,
      titleOrigin: w.titleOrigin,
      city: w.city,
      tags: w.tags,
      themeColor: w.themeColor,
      coverUrl: w.coverUrl
    };
    for (const p of w.points) {
      if (!points[p.id]) {
        points[p.id] = {
          id: p.id,
          lat: p.lat,
          lng: p.lng,
          workIds: [],
          name: null,
          nameZh: null,
          imageUrl: null
        };
      }
      if (!points[p.id].workIds.includes(w.id)) {
        points[p.id].workIds.push(w.id);
      }
    }
  }

  // 2) Fetch g0..g5 (point details)
  const detailMap = {};
  for (let n = 0; n <= 5; n++) {
    const detailRaw = await fetchJsonCached(`/d/g${n}.json`, { force });
    if (!Array.isArray(detailRaw)) continue;
    for (const entry of detailRaw) {
      // entry: [bangumi_id, theme_meta, points[], modified]
      const wid = entry?.[0];
      const pts = entry?.[2];
      if (!Array.isArray(pts)) continue;
      for (const p of pts) {
        const decoded = decodePoint(p, wid);
        if (!decoded.id) continue;
        if (!detailMap[decoded.id]) {
          detailMap[decoded.id] = {
            id: decoded.id,
            mark: decoded.mark,
            origin: decoded.origin,
            originLink: decoded.originLink,
            episodes: []
          };
        }
        if (decoded.episode.workId) {
          detailMap[decoded.id].episodes.push(decoded.episode);
        }
        // Promote name / nameZh / imageUrl into points_index
        const idx = points[decoded.id];
        if (idx) {
          if (!idx.name && decoded.name) idx.name = decoded.name;
          if (!idx.nameZh && decoded.nameZh) idx.nameZh = decoded.nameZh;
          if (!idx.imageUrl && decoded.imageUrl) idx.imageUrl = decoded.imageUrl;
        }
      }
    }
  }
  log('points indexed:', Object.keys(points).length);
  log('points with detail:', Object.keys(detailMap).length);

  // 3) Search index
  const search = buildSearchIndex(works, points);

  // 4) Manifest
  const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12);
  const manifest = {
    source: 'anitabi',
    version: stamp,
    modified: typeof modifiedTs === 'number' ? modifiedTs : Date.now(),
    counts: { works: Object.keys(works).length, points: Object.keys(points).length },
    sharding: { strategy: 'geohash-prefix', detailPrefixLen: DETAIL_PREFIX_LEN }
  };

  // 5) Write outputs
  await fs.writeFile(path.join(OUT_DIR, 'manifest.json'), JSON.stringify(manifest));
  await fs.writeFile(path.join(OUT_DIR, 'works.min.json'), JSON.stringify(works));
  await fs.writeFile(path.join(OUT_DIR, 'points_index.json'), JSON.stringify(points));
  await fs.writeFile(path.join(OUT_DIR, 'search.index.json'), JSON.stringify(search));

  const shards = shardByPrefix(detailMap, DETAIL_PREFIX_LEN);
  // Wipe old shards first so removed prefixes don't linger.
  const shardDir = path.join(OUT_DIR, 'points_detail_shards');
  for (const f of await fs.readdir(shardDir).catch(() => [])) {
    if (f.endsWith('.json')) await fs.unlink(path.join(shardDir, f));
  }
  for (const [prefix, payload] of Object.entries(shards)) {
    await fs.writeFile(
      path.join(shardDir, `${prefix}.json`),
      JSON.stringify(payload)
    );
  }
  log('done. version', manifest.version);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
