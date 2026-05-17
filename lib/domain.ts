// Top-level cultural-domain switch. Each domain owns its own content
// system; the 3D scaffolding (planets, sun, starfield) is shared.
//
// 'scifi' is the original Portal experience (films + spacecraft).
// 'anime' adds anitabi pilgrimage landmarks projected onto Earth.

export type CulturalDomain = 'scifi' | 'anime';

export const DEFAULT_DOMAIN: CulturalDomain = 'scifi';

export const DOMAIN_LABELS: Record<CulturalDomain, { zh: string; en: string }> = {
  scifi: { zh: '科幻', en: 'Sci-Fi' },
  anime: { zh: '二次元', en: 'Anime' }
};
