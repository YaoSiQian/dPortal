// Movie metadata indexed by poster file path. Keep descriptions short,
// evocative, and in the same "宇宙记忆" voice as the rest of the project.
//
// `themes` is consumed by the AI Navigator (see /api/journey) to match
// films against a user's mood. Tags span four axes:
//   · 情绪 (emotional core): 孤独/敬畏/恐惧/温暖/迷失/紧迫/平静/好奇
//   · 题材 (narrative theme): 回家/求生/父女/AI/虫洞/末日/殖民/接触异星
//   · 基调 (tone / register): 诗意/冷峻/惊悚/史诗/喜剧/悬疑/纪实/默片
//   · 主体锚点 (subject): 月球/火星/木星/土星/Voyager/ISS/Hubble/Cassini …

export type MovieInfo = {
  titleZh: string;
  titleEn: string;
  year: number;
  director?: string;
  description: string;
  poster: string;
  /** 6-12 thematic keywords (Chinese) used by the LLM for mood matching.
   *  Each tag should be specific enough to disambiguate emotionally. */
  themes: string[];
};

const P = '/textures/picture';

export const MOVIES_BY_PATH: Record<string, MovieInfo> = {
  [`${P}/2001太空漫游.png`]: {
    titleZh: '2001 太空漫游',
    titleEn: '2001: A Space Odyssey',
    year: 1968,
    director: 'Stanley Kubrick',
    description:
      '库布里克的科幻史诗。从月球上发现的黑色石碑指引人类前往木星,探员鲍曼面对人工智能 HAL 9000 的背叛。被誉为最伟大的科幻电影之一。',
    poster: `${P}/2001太空漫游.png`,
    themes: ['敬畏', '宇宙尺度', 'AI失控', '进化', '冷峻', '神秘', '哲学', '木星', '黑色石碑', 'HAL 9000', '史诗', '孤独']
  },
  [`${P}/阿波罗13号.png`]: {
    titleZh: '阿波罗 13 号',
    titleEn: 'Apollo 13',
    year: 1995,
    director: 'Ron Howard',
    description:
      '1970 年阿波罗 13 号在前往月球途中氧气罐爆炸,三名宇航员与地面控制中心争分夺秒,把破损的飞船改造成救生艇返回地球。"Houston, we have a problem"。',
    poster: `${P}/阿波罗13号.png`,
    themes: ['求生', '团队', '工程师精神', '紧迫', '真实事件', '月球任务', '失败转救援', '回家', '冷战时代', '工程感']
  },
  [`${P}/登陆月球.png`]: {
    titleZh: '登陆月球',
    titleEn: 'Destination Moon',
    year: 1950,
    director: 'Irving Pichel',
    description:
      '太空旅行黄金时代的开山之作。私营企业组织首次登月任务,严谨呈现轨道力学、加速失重和登月细节,塑造了之后所有太空科幻片的范式。',
    poster: `${P}/登陆月球.png`,
    themes: ['拓荒', '严谨科学', '探索', '黄金时代', '月球', '工程感', '经典', '乐观', '太空时代序章']
  },
  [`${P}/登月第一人.png`]: {
    titleZh: '登月第一人',
    titleEn: 'First Man',
    year: 2018,
    director: 'Damien Chazelle',
    description:
      '阿姆斯特朗的内在传记。从家庭悲剧到 1969 年的"一小步",呈现登月前后那个沉默男人的内心宇宙。',
    poster: `${P}/登月第一人.png`,
    themes: ['孤独', '克制', '失去', '父亲', '沉默', '内心宇宙', '真实事件', '诗意', '月球', '阿姆斯特朗', '悲伤', '坚忍']
  },
  [`${P}/独行月球.png`]: {
    titleZh: '独行月球',
    titleEn: 'Moon Man',
    year: 2022,
    director: '张吃鱼',
    description:
      '中国科幻喜剧。维修工独自被遗留在月球基地,目睹小行星撞击地球后,与一只袋鼠相伴上演孤独的月球求生剧。',
    poster: `${P}/独行月球.png`,
    themes: ['喜剧', '孤独', '末日', '求生', '月球', '中国科幻', '温暖', '黑色幽默', '离群独活', '荒诞']
  },
  [`${P}/红色星球.webp`]: {
    titleZh: '红色星球',
    titleEn: 'Red Planet',
    year: 2000,
    director: 'Antony Hoffman',
    description:
      '2056 年地球濒临崩溃,宇航员前往火星寻找改造可能。任务机器人 AMEE 在故障中变成猎人,在冷峻荒凉的火星地表追击幸存者。',
    poster: `${P}/红色星球.webp`,
    themes: ['求生', '机器猎杀', '悬疑', '火星殖民', '冷峻', '灾难', '末日逃生', '人机对抗']
  },
  [`${P}/火星救援.webp`]: {
    titleZh: '火星救援',
    titleEn: 'The Martian',
    year: 2015,
    director: 'Ridley Scott',
    description:
      '植物学家瓦特尼被遗留在火星,靠土豆和理性活下来。"Bring him home"——一场用科学战胜孤独的现代奥德赛。',
    poster: `${P}/火星救援.webp`,
    themes: ['求生', '孤独', '理性', '乐观', '回家', '火星', '科学拯救', '个人意志', '现代奥德赛', '坚韧', '黑色幽默']
  },
  [`${P}/火星任务.webp`]: {
    titleZh: '火星任务',
    titleEn: 'Mission to Mars',
    year: 2000,
    director: 'Brian De Palma',
    description:
      '第一支登陆火星的探险队在一场神秘风暴中消失,营救队抵达后,找到了关于人类起源的宇宙级答案。',
    poster: `${P}/火星任务.webp`,
    themes: ['起源之谜', '牺牲', '营救', '火星', '神秘', '史前文明', '兄弟情', '宇宙级答案']
  },
  [`${P}/火星幽灵.webp`]: {
    titleZh: '火星幽灵',
    titleEn: 'Ghosts of Mars',
    year: 2001,
    director: 'John Carpenter',
    description:
      '约翰·卡彭特的赛博朋克火星。22 世纪火星殖民地,警察护送犯人时遭遇被远古火星灵魂附体的工人,恐怖与西部片融合。',
    poster: `${P}/火星幽灵.webp`,
    themes: ['恐怖', '火星殖民', '远古魂魄', '西部片融合', '异星附体', '卡彭特', '赛博朋克', '血腥']
  },
  [`${P}/流浪地球.png`]: {
    titleZh: '流浪地球',
    titleEn: 'The Wandering Earth',
    year: 2019,
    director: '郭帆',
    description:
      '太阳即将毁灭,人类在地球表面建造一万座推进器,把整颗行星推离太阳系。木星引力弹射成为这场两千五百年大迁徙最危险的瞬间。',
    poster: `${P}/流浪地球.png`,
    themes: ['末日', '牺牲', '集体主义', '木星引力弹射', '中国科幻', '史诗', '父亲', '回家', '大刘', '大迁徙', '希望']
  },
  [`${P}/木星上行.png`]: {
    titleZh: '木星上行',
    titleEn: 'Jupiter Ascending',
    year: 2015,
    director: 'The Wachowskis',
    description:
      '沃卓斯基姐妹的太空歌剧。地球清洁工被告知自己是宇宙皇室继承人,木星轨道上的星际豪门为继承权展开杀戮。',
    poster: `${P}/木星上行.png`,
    themes: ['太空歌剧', '木星轨道', '阶级', '命运', '视觉奇观', '浪漫', '沃卓斯基', '皇室', '幻想']
  },
  [`${P}/欧罗巴报告.png`]: {
    titleZh: '欧罗巴报告',
    titleEn: 'Europa Report',
    year: 2013,
    director: 'Sebastián Cordero',
    description:
      '私募火箭公司派出六名宇航员前往木星卫星欧罗巴寻找冰下海洋的生命。found footage 风格的冷静纪实科幻。',
    poster: `${P}/欧罗巴报告.png`,
    themes: ['异星生命', '木卫二欧罗巴', 'found footage', '牺牲', '冷静纪实', '探索代价', '冰下海洋', '硬科幻', '幽闭']
  },
  [`${P}/太空登月记.png`]: {
    titleZh: '太空登月记',
    titleEn: 'First Men in the Moon',
    year: 1964,
    director: 'Nathan Juran',
    description:
      '改编自 H.G. Wells 1901 年同名小说。维多利亚时代两位发明家乘反重力金属飞船登陆月球,发现月球深处的虫族文明。',
    poster: `${P}/太空登月记.png`,
    themes: ['复古科幻', '月球虫族', '维多利亚时代', '想象力', '经典改编', 'H.G. Wells', '反重力', '冒险']
  },
  [`${P}/威震太阳神.png`]: {
    titleZh: '威震太阳神',
    titleEn: 'Marooned',
    year: 1969,
    director: 'John Sturges',
    description:
      '冷战时代的太空营救悬念。阿波罗任务返回失败,三名宇航员被困在轨道上,地面飞控和苏联援助同时与时间赛跑。',
    poster: `${P}/威震太阳神.png`,
    themes: ['营救', '冷战', '时间赛跑', '轨道困境', '三人被困', '紧迫', '真实感', '美苏合作', '工程感']
  },
  [`${P}/星际穿越.png`]: {
    titleZh: '星际穿越',
    titleEn: 'Interstellar',
    year: 2014,
    director: 'Christopher Nolan',
    description:
      '诺兰的太空史诗。地球濒临死亡,前飞行员库珀穿过土星附近的虫洞,在另一个星系寻找人类新家园。爱跨越时空,引力承载父女血脉。',
    poster: `${P}/星际穿越.png`,
    themes: ['父女', '虫洞', '时间错乱', '引力', '土星', '爱穿越时空', '史诗', '诺兰', '寻找新家', '浩瀚', '牺牲', '泪点']
  },
  [`${P}/异星觉醒.png`]: {
    titleZh: '异星觉醒',
    titleEn: 'Life',
    year: 2017,
    director: 'Daniel Espinosa',
    description:
      '国际空间站发现来自火星的远古单细胞生物。复活后它从微生物迅速进化为致命猎手,封闭舱内的求生悬念。',
    poster: `${P}/异星觉醒.png`,
    themes: ['恐怖', '国际空间站', '异星生命', '火星单细胞', '进化', '封闭空间', '求生', '紧迫', '惊悚']
  },
  [`${P}/月球.png`]: {
    titleZh: '月球',
    titleEn: 'Moon',
    year: 2009,
    director: 'Duncan Jones',
    description:
      '邓肯·琼斯的导演首作。山姆·贝尔在月球氦-3 矿场孤独度过三年,与人工智能 GERTY 为伴,发现的真相比孤独更冷。',
    poster: `${P}/月球.png`,
    themes: ['孤独', '月球氦-3', 'AI陪伴', '真相揭露', '悬疑', '复制人', '邓肯·琼斯', '冷峻', '反乌托邦', '身份认同', '克制']
  },
  [`${P}/月球旅行记.png`]: {
    titleZh: '月球旅行记',
    titleEn: 'A Trip to the Moon',
    year: 1902,
    director: 'Georges Méliès',
    description:
      '梅里爱的 14 分钟黑白默片。炮弹载着天文学家撞入月球的眼睛——电影史上第一部科幻片,人类对月球的想象正式进入银幕。',
    poster: `${P}/月球旅行记.png`,
    themes: ['默片', '经典', '月球', '想象力萌芽', '黑白', '梅里爱', '1902', '电影史源头', '童话感', '复古']
  },
  [`${P}/月球陨落.png`]: {
    titleZh: '月球陨落',
    titleEn: 'Moonfall',
    year: 2022,
    director: 'Roland Emmerich',
    description:
      '艾默里希的灾难片。月球被未知力量推离轨道,正向地球坠落,前宇航员组织最后一支飞行队探索月球本身的真相。',
    poster: `${P}/月球陨落.png`,
    themes: ['灾难', '月球失控', '末日', '阴谋', '史诗', '艾默里希', '阴谋论', '视觉奇观']
  },
  [`${P}/最先登上月球的人.png`]: {
    titleZh: '最先登上月球的人',
    titleEn: 'The First Men in the Moon',
    year: 2010,
    director: 'Damon Thomas',
    description:
      'BBC 重拍 H.G. Wells 经典科幻。1909 年的英国发明家发现反重力物质,与冒险家乘金属球登月,在月球地表与异种相遇。',
    poster: `${P}/最先登上月球的人.png`,
    themes: ['反重力', '月球异种', '维多利亚时代', '复古', 'BBC', 'H.G. Wells改编', '冒险', '想象力']
  },

  // ──── Curated additions for richer Navigator coverage ────────────────
  // These fill thematic / spatial gaps in the original 20: Neptune,
  // Mercury, ISS+Hubble, deep-space wonder, Earth-set sci-fi.
  [`${P}/星际探索.jpg`]: {
    titleZh: '星际探索',
    titleEn: 'Ad Astra',
    year: 2019,
    director: 'James Gray',
    description:
      'Brad Pitt 飞越火星、土星,直至海王星轨道,寻找失踪二十多年的父亲。Villeneuve 般克制冷峻的太空孤独诗,关于父亲、距离与回不去的家。',
    poster: `${P}/星际探索.jpg`,
    themes: ['孤独', '父子', '远征', '海王星', '克制', '诗意', '冷峻', '太空孤独', '回不去的家', '寻找', '失语']
  },
  [`${P}/地心引力.jpg`]: {
    titleZh: '地心引力',
    titleEn: 'Gravity',
    year: 2013,
    director: 'Alfonso Cuarón',
    description:
      '哈勃望远镜维护任务遭遇高速碎片云,Sandra Bullock 失去同伴后独自漂浮在低地球轨道,从国际空间站到神舟,一次孤注一掷的回家。',
    poster: `${P}/地心引力.jpg`,
    themes: ['求生', '孤独', '失重', '哈勃望远镜', '国际空间站', '回家', '紧迫', '惊悚', '近地轨道', '碎片灾难', '一镜到底', '母亲']
  },
  [`${P}/超时空接触.jpg`]: {
    titleZh: '超时空接触',
    titleEn: 'Contact',
    year: 1997,
    director: 'Robert Zemeckis',
    description:
      'Jodie Foster 的天文学家收到来自织女星的无线电信号,人类首次回应外星文明。信仰与科学、孤独与好奇、父女与宇宙——卡尔·萨根原著。',
    poster: `${P}/超时空接触.jpg`,
    themes: ['宇宙好奇', '父女', '信仰vs科学', 'SETI', '深空信号', '敬畏', '孤独', '宇宙尺度', 'Voyager精神', '萨根', '诗意', '探索']
  },
  [`${P}/降临.jpg`]: {
    titleZh: '降临',
    titleEn: 'Arrival',
    year: 2016,
    director: 'Denis Villeneuve',
    description:
      '十二艘外星飞船无声降落在地球。语言学家 Louise 试图破解七肢桶的非线性语言,在过程中重新理解时间、女儿与告别。',
    poster: `${P}/降临.jpg`,
    themes: ['母女', '时间感知', '非线性时间', '语言', '接触异星', 'Villeneuve', '诗意', '克制', '悲伤', '告别', '敬畏', '地球']
  },
  [`${P}/太阳浩劫.jpg`]: {
    titleZh: '太阳浩劫',
    titleEn: 'Sunshine',
    year: 2007,
    director: 'Danny Boyle',
    description:
      '太阳即将熄灭,Icarus II 号飞船载着核弹飞向太阳,试图重新点燃恒星。Danny Boyle 的硬科幻 + 哲学惊悚,关于敬畏与渺小。',
    poster: `${P}/太阳浩劫.jpg`,
    themes: ['敬畏', '太阳', '末日', '牺牲', '宇宙尺度', '惊悚', '哲学', '硬科幻', '人类渺小', '燃尽', '内心黑暗']
  },
  [`${P}/银翼杀手2049.jpg`]: {
    titleZh: '银翼杀手 2049',
    titleEn: 'Blade Runner 2049',
    year: 2017,
    director: 'Denis Villeneuve',
    description:
      'K 在加州废墟与拉斯维加斯橙色雾里寻找复制人产下的孩子,与寻找自己是否真实的过程。Villeneuve 沉思的赛博朋克,孤独与记忆。',
    poster: `${P}/银翼杀手2049.jpg`,
    themes: ['孤独', '记忆', '身份认同', '复制人', '反乌托邦', '地球', 'Villeneuve', '诗意', '冷峻', '雨', '橙色雾', '父子']
  },
  [`${P}/飞向太空.jpg`]: {
    titleZh: '飞向太空',
    titleEn: 'Solaris',
    year: 1972,
    director: 'Andrei Tarkovsky',
    description:
      '塔可夫斯基的太空诗。心理学家来到环绕索拉里斯星的空间站,这颗有意识的海洋行星把他失去的妻子从记忆中实体化召回。',
    poster: `${P}/飞向太空.jpg`,
    themes: ['记忆', '亡妻', '意识海洋', '塔可夫斯基', '诗意', '哲学', '宇宙意识', '内心宇宙', '失去', '苏联科幻', '克制', '梦境']
  },
  [`${P}/2010太空漫游.jpg`]: {
    titleZh: '2010 太空漫游',
    titleEn: '2010: The Year We Make Contact',
    year: 1984,
    director: 'Peter Hyams',
    description:
      '《2001》正传续集。美苏联合远征木星,搜寻 Discovery 号与失踪的鲍曼,重启 HAL 9000,见证木星变成第二颗太阳的奇迹。',
    poster: `${P}/2010太空漫游.jpg`,
    themes: ['木星', '美苏合作', 'HAL 9000', '续集', '冷战', '宇宙转变', '敬畏', '神秘', '黑色石碑', '科幻经典']
  }
};

