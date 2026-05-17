# 界门 · Portal

> 在人类抵达星辰之前，我们已经在幻想中航行了很久。

一个沉浸式 3D 太阳系网页体验。用户描述自己想探索的故事 / 主题 / 幻想，系统通过 LLM 策展一条 4–5 站的电影感太空路线，沿途穿越真实行星、NASA 航天器，配以严选的中文科幻作品作为延展观影路线。

气质来源：Denis Villeneuve · Christopher Nolan · NASA Deep Space · Apple Vision Pro Spatial Experience。

---

## 快速开始

```bash
# 安装依赖
npm install

# 配置环境变量
cp .env.local.example .env.local
# 编辑 .env.local 填入 OPENAI_API_KEY、OPENAI_BASE_URL、NAVIGATOR_MODEL

# 启动开发服务器
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)。

### 环境变量

`.env.local` 必填字段：

```bash
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx
OPENAI_BASE_URL=https://api.openai-next.com/v1   # 或 https://api.openai.com/v1
NAVIGATOR_MODEL=gpt-4o                            # tts-1 / claude-3-5-sonnet 等也可以
```

`OPENAI_API_KEY` **永远不进客户端**——所有 LLM 调用都走 `/app/api/journey` 服务端代理。

---

## 技术栈

| 层 | 选型 |
|---|---|
| 框架 | Next.js 14 (App Router) + React 18 + TypeScript |
| 3D | React Three Fiber 8 · Drei · @react-three/postprocessing |
| 动画 | GSAP（相机过渡）+ CSS transitions（UI 淡入淡出） |
| 样式 | Tailwind 3 + 自定义色板（`deep` / `stardust` / `nebula`） |
| LLM | OpenAI 协议兼容（默认 `gpt-4o`） |
| 语音输入 | Web Speech API（`webkitSpeechRecognition`） |
| 导出 | `html-to-image`（journey 总结卡 → PNG） |

---

## 体验流程

```
Landing (2 页电影感开场)
    ↓
主太阳系 + 选择模式（首次居中显示）
    ├─→ 自主探索  → 右侧 Library 资料库浏览电影 / 航天器
    └─→ 领航员引导 → 输入主题 → LLM 策展 4-5 站路线
                                        ↓
                                    沿太阳系飞行
                                        ↓
                                  每站字幕 + 海报推荐
                                        ↓
                                   旅程总结卡 + PNG 导出
```

---

## 项目结构

```
space_demo/
├── app/
│   ├── api/journey/route.ts      # LLM 策展服务端代理
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx                  # 顶层入口,挂载所有 layer
├── components/
│   ├── effects/PostFX.tsx        # Bloom + ChromaticAberration + Vignette
│   ├── landing/                  # 开场 2 页 cinematic intro
│   │   ├── LandingExperience.tsx
│   │   ├── LandingScene.tsx      # 独立 Canvas,深空星 / 尘埃 / 信号
│   │   └── MemoryFragments.tsx   # 漂浮的全息航天器
│   ├── navigator/                # AI 策展层
│   │   ├── Navigator.tsx         # ⌘K 输入面板
│   │   ├── JourneyPreview.tsx    # 路线预览卡
│   │   ├── JourneyController.tsx # 旅程过程编排
│   │   ├── JourneyFocusIndicator.tsx
│   │   ├── Subtitle.tsx          # 底部字幕
│   │   ├── StopCard.tsx          # 单站电影 / 主体卡
│   │   └── JourneySummary.tsx    # 总结卡 + PNG 导出
│   ├── planets/                  # 9 颗行星 + 月球 + 太阳的独立组件
│   ├── space/                    # 主 3D 场景层
│   │   ├── Scene.tsx             # 主 Canvas,所有 3D 内容根
│   │   ├── CameraRig.tsx         # 相机系统(transition / dwell / WASD)
│   │   ├── SurfaceArtifact.tsx   # 表面着陆航天器(Apollo / Viking / Perseverance)
│   │   ├── OrbitArtifact.tsx     # 轨道航天器(ISS / Hubble / LRO / Cassini)
│   │   ├── PostersLayer.tsx      # 海报漂浮层
│   │   ├── PosterAnchor.tsx      # 单张海报的 3D 全息渲染
│   │   ├── Voyage.tsx            # 第三人称飞船过渡(legacy)
│   │   ├── VoyagePath.tsx
│   │   ├── Nebula.tsx            # 背景星云
│   │   └── Starfield.tsx         # 远景星点
│   └── ui/                       # 2D HUD 层
│       ├── HUD.tsx               # 顶层 HUD 协调器
│       ├── PlanetCard.tsx        # 左上行星信息卡
│       ├── ArtifactCard.tsx      # 左上航天器信息卡(替换 PlanetCard)
│       ├── MoviePanel.tsx        # 底部电影详情条
│       ├── LibraryPanel.tsx      # 右侧资料库面板
│       └── VoyagePlot.tsx        # 模式选择条
├── lib/
│   ├── sceneStore.tsx            # 全局 React Context(状态机 + 注册表)
│   ├── journeyTypes.ts           # Journey / Stop 类型
│   ├── journeyInventory.ts       # SPACECRAFT 字典 + LLM prompt 上下文构造
│   ├── planetInfo.ts             # PLANET_FACTS 字典
│   ├── movieInfo.ts              # 28 部电影 + 主题标签
│   ├── postersData.ts            # POSTERS_BY_PLANET + 反查索引
│   ├── shaders/                  # 行星 / 大气 GLSL
│   ├── speechTypes.d.ts          # Web Speech API 类型声明
│   └── useSpeechRecognition.ts   # 语音输入 hook
├── public/
│   ├── models/*.glb              # 9 个 NASA 航天器模型
│   └── textures/
│       ├── planets/              # 行星贴图(Solar System Scope, CC-BY 4.0)
│       ├── earth/                # 地球昼/夜/云/高光多通道贴图
│       └── picture/              # 28 张电影海报
└── tailwind.config.ts
```

---

## 添加内容

### 添加一颗行星 / 卫星

1. `lib/sceneStore.tsx` — 在 `PlanetId` 联合类型加新 id
2. `lib/sceneStore.tsx` — 在 `PLANET_LABELS` 加显示名
3. `lib/planetInfo.ts` — 在 `PLANET_FACTS` 加 facts + description
4. `lib/journeyInventory.ts` — `PLANET_IDS` 数组追加
5. `components/planets/<NewPlanet>.tsx` — 复用 Earth/Mars 等组件作为模板
6. `components/space/Scene.tsx` — 在 JSX 里挂载

TypeScript 会列出所有缺漏字典——按提示补全即可。

### 添加一艘航天器

1. `lib/journeyTypes.ts` — `SpacecraftId` 联合类型加新 id
2. `lib/journeyInventory.ts` — `SPACECRAFT` 字典加条目（name / hostPlanet / kind / description）
3. 把 GLB 文件放到 `public/models/<id>.glb`
4. `components/space/Scene.tsx` 里挂载，按 kind 选组件：
   - `surface` → `<SurfaceArtifact artifactId="..." lat lon surfaceRadius scale />`
   - `orbit` → `<OrbitArtifact artifactId="..." followPlanet orbitRadius orbitSpeed ... />`
   - `deepspace` → 内联 group + `useArtifactRegistration(id, ref, approachDistance)`

### 添加一部电影

1. 把海报放到 `public/textures/picture/<chineseName>.<jpg|png|webp>`
2. `lib/movieInfo.ts` — 在 `MOVIES_BY_PATH` 加条目（路径 = 字典 key = `poster` 字段）
3. `themes` 数组写 6–12 个主题标签（情绪 / 题材 / 基调 / 主体锚点）
4. `lib/postersData.ts` — `POSTERS_BY_PLANET` 关联到对应行星

LLM 自动看到新电影（`buildFilmsBlock()` 直接遍历字典），无需改 prompt。

### 添加 / 更新二次元领域数据

二次元（anime）文化领域使用 anitabi 圣地巡礼数据，以预构建的静态包形式落在 `public/data/anime/anitabi/`。仓库中已包含一个最小演示数据集（约 30 部作品），如需重建：

```bash
npm run build:anime           # 抓取 anitabi 全量并写入 public/data/anime/anitabi/
npm run build:anime:demo      # 截取演示子集（top N 作品）—— 提交到仓库
```

切换到二次元领域：右上角胶囊「二次元 · Anime」。点击地球表面的地标查看详情；按 ⌘K 让 AI 策划一条巡礼路线。

详细架构见 `docs/2026-05-16-portal-anitabi-anime-domain-design.md` 与 `docs/superpowers/plans/2026-05-17-anime-cultural-domain.md`。

---

## 主要功能

- **2 页电影感开场**（深空尘埃 + 漂浮全息航天器）
- **9 行星 + 月球 + 太阳** 真实 NASA 贴图
- **9 NASA 航天器** 真实 GLB + 真实 lat/lon / 轨道参数
- **相机系统**：cinematic GSAP 过渡 / 主动环绕运镜 / 拉远入场 / WASD 自由飞行 / 鼠标视差
- **AI 领航员**：⌘K 输入主题 → LLM 策展 4–5 站路线 → 镜头 cinematic 飞行 + 字幕旁白 + 影片推荐 → 总结卡 PNG 导出
- **资料库面板**：右侧浏览所有电影 / 航天器，按行星筛选，点击直接定位
- **语音输入**：Web Speech API（Chrome/Safari/Edge），中文识别
- **首次引导**：屏幕中央 hero 卡 + "建议开启领航员模式"，使用过后自动收纳到右下角
- **全双语 UI**：所有按钮 / 标签 / 提示中英对照

---

## 设计原则

| 原则 | 体现 |
|---|---|
| 静默压制华丽 | 所有 UI 用 hairline 边 + 玻璃质感 + cosmic 字距，禁纯白 / 鲜艳色 |
| 慢于人 | 相机 4–5 秒过渡 + 5–7°/秒环绕 + 1.2 秒 fade |
| 留白即叙事 | 每站 6 秒 dwell + 字幕单句不超过 2 行 |
| 主体大于镜头 | 镜头不抢主体；行星 / 航天器永远在画面中央 |
| 文案克制 | 禁止"让我们""出发""开始我们的旅程"等导游词 |

---

## 致谢

- **行星贴图** — [Solar System Scope](https://www.solarsystemscope.com/textures/) (CC-BY 4.0)
- **航天器模型** — NASA 3D Resources (公共领域)
- **科幻影片元数据** — 整理自 IMDb / 豆瓣 / 维基百科
- **代码灵感** — `react-three-fiber` 社区示例 / Active Theory / Resn

电影海报为示意性占位图，最终上线版本应替换为对应版权方的真实海报。

---

## 路线图

可预见的下一步（按建议优先级）：

- [ ] **声音设计**：背景 ambient drone + 旅程过渡音 sting + 站点抵达音
- [ ] **TTS 朗读**：调用 `/v1/audio/speech` 把每站旁白朗读出来
- [ ] **旅程历史**：localStorage 存过往路线，可重放
- [ ] **真实航天数据**：NASA Horizons API 拉 Voyager 1 实时距离 / ISS 当前轨道
- [ ] **二维码分享**：旅程总结卡扫码下载
- [ ] **每日主题**：每天一个推荐探索主题作为种子

---

## License

代码部分 MIT。第三方资源版权归原作者所有。
