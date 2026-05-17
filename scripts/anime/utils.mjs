// scripts/anime/utils.mjs
// Tiny helpers shared by build-anitabi.mjs / decode.mjs.
// Node 20+ (global fetch); no external deps.

import fs from 'node:fs/promises';
import path from 'node:path';

export const BASE_URL = 'https://www.anitabi.cn';
export const RAW_DIR = path.resolve('public/data/anime/anitabi/_raw');
export const OUT_DIR = path.resolve('public/data/anime/anitabi');

export function log(...args) {
  // eslint-disable-next-line no-console
  console.log('[anime-build]', ...args);
}

export async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

/** Fetch with 3 retries + exponential backoff. Caches body to RAW_DIR
 *  on first success; subsequent runs read from disk unless `force`. */
export async function fetchJsonCached(relPath, { force = false } = {}) {
  await ensureDir(RAW_DIR);
  const cacheFile = path.join(RAW_DIR, relPath.replace(/[\/]/g, '_'));
  if (!force) {
    try {
      const raw = await fs.readFile(cacheFile, 'utf8');
      log('cache hit', relPath);
      return JSON.parse(raw);
    } catch {
      /* miss */
    }
  }
  const url = `${BASE_URL}${relPath}`;
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      log('GET', url, attempt > 0 ? `(retry ${attempt})` : '');
      const res = await fetch(url, {
        headers: { 'User-Agent': 'PortalAnimeBuild/0.1' }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      await fs.writeFile(cacheFile, text);
      return JSON.parse(text);
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
    }
  }
  throw new Error(`fetchJsonCached(${relPath}) failed: ${lastErr?.message}`);
}

export function absolutiseUrl(maybeRel) {
  if (!maybeRel) return null;
  if (/^https?:\/\//i.test(maybeRel)) return maybeRel;
  return `${BASE_URL}${maybeRel.startsWith('/') ? '' : '/'}${maybeRel}`;
}
