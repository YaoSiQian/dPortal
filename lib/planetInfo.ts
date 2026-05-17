import type { PlanetId } from './sceneStore';

export type PlanetFacts = {
  nameZh: string;
  nameEn: string;
  category: string;
  /** Static astronomical lines: 半径 / 一日 / 距日 (or 距地 for moon).
   *  Keep this list short — dynamic counts (航天器 / 相关科幻) are appended
   *  by the card itself, not stored here. */
  facts: Array<[string, string]>;
  description: string;
};

export const PLANET_FACTS: Record<PlanetId, PlanetFacts> = {
  mercury: {
    nameZh: '水星',
    nameEn: 'Mercury',
    category: '类地行星',
    facts: [
      ['半径', '2,440 km'],
      ['一日', '58.6 日'],
      ['距日', '0.39 AU']
    ],
    description: '太阳系最内侧的行星。几乎没有大气层，昼夜温差超过 600°C。'
  },
  venus: {
    nameZh: '金星',
    nameEn: 'Venus',
    category: '类地行星',
    facts: [
      ['半径', '6,052 km'],
      ['一日', '243 日 · 逆向'],
      ['距日', '0.72 AU']
    ],
    description: '浓厚硫酸云层制造失控温室效应,是太阳系最热的行星。'
  },
  earth: {
    nameZh: '地球',
    nameEn: 'Earth',
    category: '类地行星 · 生命摇篮',
    facts: [
      ['半径', '6,371 km'],
      ['一日', '24 小时'],
      ['距日', '1.00 AU']
    ],
    description: '已知唯一存在液态水与生命的行星。'
  },
  moon: {
    nameZh: '月球',
    nameEn: 'Luna',
    category: '地球的天然卫星',
    facts: [
      ['半径', '1,737 km'],
      ['一日', '27.3 日 · 潮汐锁定'],
      ['距地', '384,400 km']
    ],
    description: '潮汐锁定使同一面永远朝向地球。阿波罗 11 号 1969 年首次载人登陆。'
  },
  mars: {
    nameZh: '火星',
    nameEn: 'Mars',
    category: '类地行星 · 红色星球',
    facts: [
      ['半径', '3,389 km'],
      ['一日', '24 小时 37 分'],
      ['距日', '1.52 AU']
    ],
    description: '拥有太阳系最高的火山(奥林匹斯山 21 km)与最深的峡谷(水手谷)。'
  },
  jupiter: {
    nameZh: '木星',
    nameEn: 'Jupiter',
    category: '气态巨行星',
    facts: [
      ['半径', '69,911 km'],
      ['一日', '9 小时 56 分'],
      ['距日', '5.20 AU']
    ],
    description: '太阳系最大行星。大红斑是持续至少四百年的反气旋风暴,直径足以装下两个地球。'
  },
  saturn: {
    nameZh: '土星',
    nameEn: 'Saturn',
    category: '气态巨行星',
    facts: [
      ['半径', '58,232 km'],
      ['一日', '10 小时 42 分'],
      ['距日', '9.58 AU']
    ],
    description: '以壮观的环系闻名,环主要由冰粒与岩石碎块组成,最薄处仅约 10 米。'
  },
  uranus: {
    nameZh: '天王星',
    nameEn: 'Uranus',
    category: '冰巨行星',
    facts: [
      ['半径', '25,362 km'],
      ['一日', '17 小时 14 分 · 逆向'],
      ['距日', '19.22 AU']
    ],
    description: '自转轴几乎平躺在公转面上,被称为"侧躺的行星"。'
  },
  neptune: {
    nameZh: '海王星',
    nameEn: 'Neptune',
    category: '冰巨行星',
    facts: [
      ['半径', '24,622 km'],
      ['一日', '16 小时 6 分'],
      ['距日', '30.05 AU']
    ],
    description: '太阳系最遥远的行星。大气中存在比地球任何风暴都猛烈的超音速大气流。'
  }
};
