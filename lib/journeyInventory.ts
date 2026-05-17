// Static inventory the Navigator route gives the LLM as context, and uses
// to validate the LLM's response. Everything the model is allowed to
// reference must appear here.

import { MOVIES_BY_PATH } from './movieInfo';
import { PLANET_FACTS } from './planetInfo';
import type { PlanetId } from './sceneStore';
import type { SpacecraftId } from './journeyTypes';

export const PLANET_IDS: PlanetId[] = [
  'mercury',
  'venus',
  'earth',
  'moon',
  'mars',
  'jupiter',
  'saturn',
  'uranus',
  'neptune'
];

type SpacecraftInfo = {
  id: SpacecraftId;
  /** Cinematic display name shown in subtitles. */
  name: string;
  /** Host planet for camera approach (we fly to the host first). */
  hostPlanet: PlanetId;
  /** surface = sitting on the body; orbit = circling it; deepspace = adrift. */
  kind: 'surface' | 'orbit' | 'deepspace';
  /** One-line poetic description fed to the LLM. */
  description: string;
};

export const SPACECRAFT: Record<SpacecraftId, SpacecraftInfo> = {
  apollo_lm: {
    id: 'apollo_lm',
    name: '阿波罗登月舱',
    hostPlanet: 'moon',
    kind: 'surface',
    description: '1969 年人类首次踏上月球时留下的金色登月舱,静海基地的金属遗骸。'
  },
  viking_1: {
    id: 'viking_1',
    name: '海盗一号',
    hostPlanet: 'mars',
    kind: 'surface',
    description: '1976 年抵达火星的第一艘成功着陆器,在 Chryse Planitia 等待了二十年才停止呼吸。'
  },
  perseverance: {
    id: 'perseverance',
    name: '毅力号',
    hostPlanet: 'mars',
    kind: 'surface',
    description: '2021 年降落 Jezero 火山口的火星车,正在收集等待人类来取的样品管。'
  },
  ingenuity: {
    id: 'ingenuity',
    name: '机智号',
    hostPlanet: 'mars',
    kind: 'surface',
    description: '人类在地球之外第一架受控飞行的直升机,在火星稀薄大气中起飞过 72 次。'
  },
  iss: {
    id: 'iss',
    name: '国际空间站',
    hostPlanet: 'earth',
    kind: 'orbit',
    description: '低地球轨道上 400 公里高的金属结晶,二十多年来从未空过人。'
  },
  hubble: {
    id: 'hubble',
    name: '哈勃望远镜',
    hostPlanet: 'earth',
    kind: 'orbit',
    description: '挂在 540 公里高轨道上的人类视网膜,看见过宇宙诞生后五亿年的光。'
  },
  lro: {
    id: 'lro',
    name: '月球勘测轨道器',
    hostPlanet: 'moon',
    kind: 'orbit',
    description: '绕月十五年的高分辨率眼睛,把每一处阿波罗着陆点都重新拍了一遍。'
  },
  cassini: {
    id: 'cassini',
    name: '卡西尼号',
    hostPlanet: 'saturn',
    kind: 'orbit',
    description: '在土星身边度过十三年,最后一次"壮烈终结"主动俯冲进土星大气层。'
  },
  voyager_1: {
    id: 'voyager_1',
    name: '旅行者一号',
    hostPlanet: 'neptune',
    kind: 'deepspace',
    description: '人类制造的距离地球最远的物体,带着金唱片,孤独地飞向星际空间。'
  }
};

export const SPACECRAFT_IDS = Object.keys(SPACECRAFT) as SpacecraftId[];

// -------- Prompt block builders ---------------------------------------------

// Format the inventory blocks the LLM sees. Keep these terse and structured —
// the model is better at honoring constraints when it sees them as a list.

export function buildPlanetsBlock(): string {
  return PLANET_IDS.map((id) => {
    const f = PLANET_FACTS[id];
    return `  - ${id}（${f.nameZh} / ${f.nameEn}）— ${f.description}`;
  }).join('\n');
}

export function buildSpacecraftBlock(): string {
  return SPACECRAFT_IDS.map((id) => {
    const s = SPACECRAFT[id];
    return `  - ${id}（${s.name}·${s.kind === 'surface' ? `${s.hostPlanet} 表面` : s.kind === 'orbit' ? `${s.hostPlanet} 轨道` : '深空'}）— ${s.description}`;
  }).join('\n');
}

export function buildFilmsBlock(): string {
  // Show full description (already short) + themes line so the LLM can
  // do precise mood matching, not just guess from a 50-char snippet.
  return Object.values(MOVIES_BY_PATH)
    .map(
      (m) =>
        `  - ${m.poster}\n      ${m.titleZh}《${m.titleEn}》${m.year}${m.director ? ` · ${m.director}` : ''}\n      简介: ${m.description}\n      主题: ${m.themes.join(' / ')}`
    )
    .join('\n');
}

// -------- Validation ---------------------------------------------------------

export function isValidPlanetId(s: unknown): s is PlanetId {
  return typeof s === 'string' && (PLANET_IDS as string[]).includes(s);
}

export function isValidSpacecraftId(s: unknown): s is SpacecraftId {
  return typeof s === 'string' && (SPACECRAFT_IDS as string[]).includes(s);
}

export function isValidFilmPath(s: unknown): s is string {
  return typeof s === 'string' && s in MOVIES_BY_PATH;
}
