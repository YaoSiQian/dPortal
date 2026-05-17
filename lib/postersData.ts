import type { PlanetId } from './sceneStore';

// Posters classified by their primary planetary association. Films that
// touch multiple bodies are mapped to the body that carries the strongest
// visual memory (e.g. The Wandering Earth → Jupiter for the slingshot).

const P = '/textures/picture';

export const POSTERS_BY_PLANET: Record<PlanetId, string[]> = {
  mercury: [`${P}/太阳浩劫.jpg`],
  venus: [],
  earth: [
    `${P}/地心引力.jpg`,
    `${P}/超时空接触.jpg`,
    `${P}/降临.jpg`,
    `${P}/银翼杀手2049.jpg`
  ],
  moon: [
    `${P}/阿波罗13号.png`,
    `${P}/登陆月球.png`,
    `${P}/登月第一人.png`,
    `${P}/独行月球.png`,
    `${P}/太空登月记.png`,
    `${P}/威震太阳神.png`,
    `${P}/月球.png`,
    `${P}/月球旅行记.png`,
    `${P}/月球陨落.png`,
    `${P}/最先登上月球的人.png`
  ],
  mars: [
    `${P}/红色星球.webp`,
    `${P}/火星救援.webp`,
    `${P}/火星任务.webp`,
    `${P}/火星幽灵.webp`,
    `${P}/异星觉醒.png`
  ],
  jupiter: [
    `${P}/2001太空漫游.png`,
    `${P}/木星上行.png`,
    `${P}/欧罗巴报告.png`,
    `${P}/流浪地球.png`,
    `${P}/飞向太空.jpg`,
    `${P}/2010太空漫游.jpg`
  ],
  saturn: [`${P}/星际穿越.png`],
  uranus: [],
  neptune: [`${P}/星际探索.jpg`]
};

// Per-planet visual tuning. baseHeight tunes physical poster size;
// orbitBase tunes how far they float from the planet centre.
// Tuned so that at the planet's APPROACH distance + camera FOV 42°, the
// outermost orbiting poster sits inside the half-FOV cone (atan(R/D) < 21°).
export const POSTER_PLACEMENT: Record<PlanetId, { baseHeight: number; orbitBase: number }> = {
  mercury: { baseHeight: 0.55, orbitBase: 3 },
  venus:   { baseHeight: 0.70, orbitBase: 4 },
  earth:   { baseHeight: 0.85, orbitBase: 4 },
  moon:    { baseHeight: 0.44, orbitBase: 1.3 },
  mars:    { baseHeight: 0.77, orbitBase: 3.0 },
  jupiter: { baseHeight: 1.80, orbitBase: 8.5 },
  saturn:  { baseHeight: 2.40, orbitBase: 14.5 },
  uranus:  { baseHeight: 1.25, orbitBase: 6.5 },
  neptune: { baseHeight: 1.25, orbitBase: 6.5 }
};

// Reverse index: poster path → its associated planet. Built once at module
// load so the Library panel can cheaply navigate "click film → fly to that
// film's home planet" without scanning the per-planet arrays.
export const PLANET_BY_POSTER: Record<string, PlanetId> = (() => {
  const map: Record<string, PlanetId> = {};
  (Object.entries(POSTERS_BY_PLANET) as Array<[PlanetId, string[]]>).forEach(
    ([planetId, posters]) => {
      for (const p of posters) map[p] = planetId;
    }
  );
  return map;
})();
