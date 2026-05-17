// scripts/anime/buildSearchIndex.mjs
// Trivial token bag — lower-case, split on non-alphanumeric (handles
// CJK by NOT splitting CJK runs, treating each run as one token plus
// its city + tag tokens). Good enough for "user said 秩父" → matches.

function tokenize(s) {
  if (!s) return [];
  // Lowercase, then split on whitespace + punctuation; CJK runs stay
  // intact as single tokens. Plus per-character split for CJK so
  // partial substring matches work too.
  const lower = s.toLowerCase();
  const out = new Set();
  for (const piece of lower.split(/[\s,，、。.\-—_/()（）【】「」『』：:;；!?·]+/)) {
    if (!piece) continue;
    out.add(piece);
    // For CJK strings >1 char, also add each character.
    if (/[一-鿿぀-ヿ]/.test(piece) && piece.length > 1) {
      for (const ch of piece) out.add(ch);
    }
  }
  return [...out];
}

export function buildSearchIndex(works, points) {
  const pointTokens = {};
  const workTokens = {};

  for (const w of Object.values(works)) {
    const toks = new Set([
      ...tokenize(w.titleZh),
      ...tokenize(w.titleOrigin),
      ...tokenize(w.city ?? ''),
      ...(w.tags ?? []).flatMap(tokenize)
    ]);
    workTokens[String(w.id)] = [...toks];
  }

  for (const p of Object.values(points)) {
    const ws = (p.workIds ?? []).map((wid) => works[wid]).filter(Boolean);
    const toks = new Set([
      ...tokenize(p.name ?? ''),
      ...tokenize(p.nameZh ?? ''),
      ...ws.flatMap((w) => tokenize(w.titleZh)),
      ...ws.flatMap((w) => tokenize(w.city ?? '')),
      ...ws.flatMap((w) => (w.tags ?? []).flatMap(tokenize))
    ]);
    pointTokens[p.id] = [...toks];
  }

  return { pointTokens, workTokens };
}
