# Portal × anitabi（二次元文化领域）接入设计（方案 B）

日期：2026-05-16  
状态：草案（待确认后进入实现计划）  

## 1. 背景与上下文

Portal 是一个基于 Next.js 14（App Router）+ React + R3F（React Three Fiber）构建的 Web 3D 太阳系探索 demo。现有数据体系包含 **Planet / Spacecraft / Film** 三类核心实体，且它们的 `id` 被建模为 **封闭联合类型**，由静态 TS 字典驱动，运行时通过 `sceneStore` 做世界坐标注册与相机飞行。

本次目标是在 Portal 中新增“二次元文化领域”，用 **anitabi（圣地巡礼）**数据作为 demo 内容来源，并保持现有工程不变量与类型约束，不对现有三类实体做破坏式扩展。

## 2. 已确认决策（来自讨论）

1) 数据接入方式：**混合模式**（内置静态数据包 + 可选在线更新入口）  
2) 内容组织：**按地点/地标**（不是按作品）  
3) 星球落点：**只落在地球**（现实经纬度 → 地球球面坐标）  
4) 数据量偏好：**尽可能全量索引**（通过 LOD/聚类控制渲染压力）  
5) 实现策略：选择 **方案 B：预处理成 Portal 专用数据包**  
6) AI：新增 **anime 导航**（不强行复用现有 `/api/journey` schema）  
7) 截图：**必须包含贴图**（因此需要同源/可 CORS 的图片加载链路）  
8) LOD 视觉节奏：**远景=聚类点，近景=海报**

## 3. 目标 / 非目标

### 3.1 目标（MVP）
- 在“二次元文化领域”切换后，地球表面展示巡礼地标，并支持：
  - 远景聚类点（或热力点）、中景点位、近景海报卡片逐级展开（LOD）
  - 点击地标：展示地标详情（地名/备注/来源等）+ 可关联作品信息
- 提供图片加载链路，使 WebGL 画布可被导出，且导出图片包含海报/实景贴图。
- 新增 `/api/animeJourney`（LLM 驱动）输出 4–6 站地标路线，前端可自动飞行与高亮。
- 数据包内置可离线运行；另提供“在线更新”入口（不强制实现增量差分）。

### 3.2 非目标（本阶段不做）
- 不提供应用内多人编辑/协作与审核流。
- 不把海量地标映射成 `SpacecraftId` 或 `PlanetId` 的扩展项（避免破坏封闭联合类型）。
- 不追求对 anitabi 图片/封面的 100% 可用性（必须有占位/失败提示与降级策略）。

## 4. 关键约束（必须遵守）

来自《Portal 数据源适配规范》的硬约束（节选）：
- `PlanetId / SpacecraftId` 是封闭联合类型；二次元地标不得加入这些 union。
- 依赖方向唯一：`Spacecraft → Planet`、`Film → Planet`；二次元领域使用 **独立文件与索引** 承载，不混入现有索引。
- 文案约束：二次元领域的 AI narration 也应避免“让我们/出发”等导游词；叙述主体必须是 stop 本身。

此外，本次接入的技术约束：
- anitabi 公开接口为“全量静态 JSON 下发 + 客户端过滤”，无传统查询 API。
- 外链图片直接贴进 WebGL 可能造成画布污染，影响截图导出；必须通过同源/可 CORS 方式加载贴图。

## 5. 总体架构

### 5.1 新增模块边界（不侵入现有三实体）

建议以“文化领域”作为一级边界，为二次元领域新增独立模块：

- `lib/anime/`：二次元领域数据类型、索引加载、检索与工具函数
- `public/data/anime/anitabi/`：构建期产物（Portal 专用数据包）
- `app/api/animeJourney/route.ts`：二次元领域 LLM 路线规划接口
- `app/api/img/route.ts`：图片代理（同源输出 + CORS 头，支持贴图可截图）
- `components/anime/`：二次元地标渲染（LOD/聚类/交互卡片）

### 5.2 运行时数据流

1) 进入二次元领域：加载 `manifest.json` + 轻量索引（作品/点位概览）  
2) 根据相机距离与视野范围：选择合适 LOD 分片（聚类 or 点位 or 海报）  
3) 点击点位：按需加载点位详情/作品详情  
4) 图片贴图：统一经 `/api/img?url=...` 拉取，再交给 TextureLoader（保证可截图导出）  
5) AI 导航：用户输入 → `/api/animeJourney` → 返回 stops(pointId) → 前端飞行与高亮

## 6. 数据包设计（方案 B 产物）

### 6.1 输入来源（构建期抓取）

来自 anitabi 的公开静态 JSON（**本项目只依赖其中一部分**，详见 6.1.1）：
- `/d/g.json`：作品索引 + 地标坐标（含 `points_flat`）
- `/d/g0.json` … `/d/g5.json`：地标详情分页（点位 15 元数组）

明确不导入/不调用（来自你的决定）：
- **不导入** `B3 /d/users.json`
- **不调用** `C1 /api/session`
- **不调用** `C2 POST /api/log/point`

> 说明：原始结构为紧凑数组编码；本方案在构建期 **完全解码 + 归一化**，输出 Portal 专用 JSON。

### 6.1.1 Anitabi 公开 API：完整接口与使用规范（Portal 视角）

> 目标：在设计中提供 anitabi 相关 API 的「完整接口」与「如何使用」。  
> 原则：**只依赖公开静态接口**；对“隐藏管理接口”仅做识别与排除，不作为依赖。

#### A) BaseURL 与通用约定

- BaseURL：`https://www.anitabi.cn`
- 缓存破坏参数：大多数静态资源支持 `?d={ver}`（例如 `qh8b`），用于 CDN 强缓存刷新；**可省略**，通常仍能返回最新版本。
- 数据模型特征：**无传统“查询 API”**。初始即全量下发静态 JSON，客户端做缓存与内存过滤。

#### B) 数据下载 API（公开、无需登录）— Portal 使用与不使用的清单

##### B1) `GET /d/g.json`（必用）

- 用途：全量作品索引 + 每作品地标的“坐标列表”
- 请求：
  - `GET https://www.anitabi.cn/d/g.json`
  - 或 `GET https://www.anitabi.cn/d/g.json?d={ver}`
- 响应顶层结构：`[bangumiList[], pageSize, modified_timestamp]`
- `bangumiList[]` 单条为紧凑数组（需要解码）。其中：
  - `cover`：可能是绝对 URL 或相对路径（如 `/images/bangumi/<id>.jpg`），相对路径需拼接 BaseURL
  - `points_flat[]`：4 元一组 `[pointId, lat, lng, priority, ...]`
    - `pointId` 为 6 字符 base32 geohash（如 `8bulvz`），既是唯一键也可用于分片/聚类
- Portal 用法：
  - **构建期**：拉取并解码，形成 `works.min.json` 与点位基础索引（至少包含 `lat/lng/workIds`）
  - **运行时**：默认不直连 anitabi；“在线更新”入口才通过你的代理拉取并重建本地数据包/IndexedDB

##### B2) `GET /d/g{N}.json`（必用，N=0..5）

- 用途：地标详情分页（补齐地标的地名、图片、备注、来源等）
- 请求：
  - `GET https://www.anitabi.cn/d/g0.json` … `GET https://www.anitabi.cn/d/g5.json`
  - 可附 `?d={ver}`
- 响应结构：数组；每项：`[bangumi_id, theme_meta, points[], modified]`
- `points[]` 单条为紧凑数组（需要解码），其中：
  - `id`：地标 id（6 位 geohash）
  - `image`：地标实景图，常为相对路径（如 `/images/points/<mid>/<id>_*.jpg`），需拼 BaseURL
  - `mark/origin/originLink/ep/s...`：备注/来源/外链/出现集数等
- Portal 用法：
  - **构建期**：拉取 g0..g5 全部，解码并按 `pointId` 合并到点位索引；输出 `points_detail_shards/*`
  - **运行时**：点位详情按需从你自己的数据包加载（不再请求 anitabi 的 g0..g5）

##### B3) `GET /d/users.json`（完整接口清单中保留，但本项目明确不使用）

- 用途：贡献者列表（与地标详情的 `uid` 关联）
- 状态：**本项目不导入**（减少产品决策与潜在隐私/展示问题）

##### B4) `GET /api/bangumi/icons.svg`（完整接口清单中保留，但本项目默认不使用）

- 用途：作品 icon sprite 元信息（注意：URL 叫 `.svg` 但返回 JSON）
- 请求：
  - `GET https://www.anitabi.cn/api/bangumi/icons.svg`
  - 可附 `?d={ver}`
- 响应示例：
  - `{ "src": "/images/bangumi-icons.webp?v=...", "ids": [ ... ] }`
- 状态：二次元领域以“海量地标”为核心，icon sprite 价值有限，**默认不使用**（后续若要为作品维度提供 icon，可再接入）

#### C) 系统 API（完整接口清单中保留，但本项目明确不使用）

##### C1) `GET /api/session`（不使用）

- 用途：会话查询（匿名也会调用）
- 状态：**本项目不调用**

##### C2) `POST /api/log/point`（不使用）

- 用途：地标查看埋点（请求体通常为 `["{point_geohash}", "{session_id}"]`）
- 状态：**本项目不调用**（避免引入隐私/统计依赖）

#### D) 隐藏管理接口（识别但不依赖）

前端 bundle 中可能存在 `/api/bangumi/*`、`/api/point/*` 等 CRUD 接口定义，但其对匿名访问可用性与稳定性未知，且可能依赖登录态：
- 状态：**明确不依赖**。Portal 仅依赖 B 节的公开静态接口作为数据源。

### 6.2 输出目录与文件清单（静态资源）

建议放置：`/public/data/anime/anitabi/`

- `manifest.json`
- `works.min.json`（作品字典，轻量）
- `points_index.json`（点位轻量索引，含 lat/lng 与 workIds）
- `points_detail_shards/`（点位详情分片，可按 geohash 前缀分片）
- `search.index.json`（检索索引，用于 AI/搜索）
- （可选）`stats.json`（聚类统计或热度等衍生字段）

### 6.3 JSON schema（建议）

#### manifest.json
```json
{
  "source": "anitabi",
  "version": "YYYYMMDD-hhmm",
  "modified": 0,
  "counts": { "works": 0, "points": 0 },
  "sharding": { "strategy": "geohash-prefix", "detailPrefixLen": 2 }
}
```

#### works.min.json
Key 为 `workId`（bangumi id，数字），值为轻量作品信息：
```json
{
  "543360": {
    "id": 543360,
    "titleZh": "中文名",
    "titleOrigin": "原标题",
    "city": "秩父市",
    "tags": ["tag1", "tag2"],
    "themeColor": "#7aa2ff",
    "coverUrl": "https://www.anitabi.cn/images/bangumi/543360.jpg"
  }
}
```

#### points_index.json
Key 为 `pointId`（6 位 base32 geohash 字符串），值为轻量点位信息：
```json
{
  "8bulvz": {
    "id": "8bulvz",
    "lat": 35.99,
    "lng": 139.08,
    "workIds": [543360, 123456],
    "name": "原文地名",
    "nameZh": "中文地名",
    "imageUrl": "https://www.anitabi.cn/images/points/543360/8bulvz_xxx.jpg"
  }
}
```

#### points_detail_shards/<prefix>.json
按 `pointId.slice(0, detailPrefixLen)` 分片（例如 `detailPrefixLen=2`，则 `8b.json` 存所有 `8b****`）：
```json
{
  "8bulvz": {
    "id": "8bulvz",
    "mark": "备注",
    "origin": "资料来源说明",
    "originLink": "https://...",
    "episodes": [{"workId": 543360, "ep": "01", "time": "00:12:34"}]
  }
}
```

#### search.index.json
用于“文本 → 候选集”的轻量倒排/正排，避免把全量详情塞进 LLM：
```json
{
  "pointTokens": {
    "8bulvz": ["秩父", "神社", "地名", "作品名", "tag"]
  },
  "workTokens": {
    "543360": ["作品名", "别名", "city", "tag"]
  }
}
```

> 注：token 生成策略可先用简单规则（中英文 lower + 去空格 + 城市/标签/标题），后续再引入分词。

## 7. LOD/聚类与渲染策略

### 7.1 坐标：lat/lng → 地球球面 XYZ

二次元领域仅落在 `earth`，采用标准球面映射：
- `phi = (90 - lat) * π/180`
- `theta = (lng + 180) * π/180`
- `x = R * sin(phi) * cos(theta)`
- `y = R * cos(phi)`
- `z = R * sin(phi) * sin(theta)`

其中 `R` 为地球在场景中的显示半径（与现有地球模型一致）。

### 7.2 LOD 三层（必须）

1) **远景**：只渲染聚类点/热力点  
2) **中景**：渲染“简化点位”（图标/小卡），数量上限需可配置  
3) **近景**：渲染海报平面（贴图）+ 标题；贴图按需加载

控制目标：**数据可全量存在，但永远只渲染当前视野需要的子集**。

## 8. 图片代理与可截图导出

### 8.1 背景
外链图片（封面/地标实景）若直接作为 WebGL 贴图，可能导致 canvas 被污染，导出失败。

### 8.2 方案：/api/img 代理（只代理不缓存）

新增：`GET /api/img?url=<encoded>`

职责：
- 服务端拉取 `url` 指向的图片二进制并转发
- 设置同源可用的响应头（至少包含 CORS 相关头），确保前端 `crossOrigin="anonymous"` 时可用于贴图与截图导出
- 限制允许域名白名单（至少：`www.anitabi.cn`、`image.anitabi.cn`、`lain.bgm.tv` 等；按实际需要配置）

约束：
- 本阶段按“只代理不缓存”实现；但建议让浏览器侧缓存可生效（例如合理的 `Cache-Control`），否则全量场景会非常慢且易触发上游限流。

## 9. AI：/api/animeJourney（新 schema）

### 9.1 Schema
```ts
export type AnimeStop = {
  pointId: string;        // 必须存在于 points_index.json
  narration: string;      // 30-60 字，主体为该点位本身
  workId?: number | null; // 可选：绑定讲述作品
};

export type AnimeJourney = {
  mood: string;           // 8-14 字
  stops: AnimeStop[];     // 4-6 站
  closing: string;        // ≤20 字
};
```

### 9.2 服务端策略（检索 → 候选 → LLM）

1) 输入：用户自然语言（例如“我想看关于秩父的地标”）  
2) 本地检索：用 `search.index.json` 与 `works.min.json/points_index.json` 先筛候选点（例如 Top 50）  
3) LLM 选择路线：把候选点的简要信息（地名/城市/标签/关联作品标题）作为上下文，让 LLM 输出 4–6 站  
4) Validator：
- `pointId` 必须命中 `points_index.json`
- `workId` 若存在必须命中 `works.min.json`
- stops 数量/字数满足约束；禁止导游词

## 10. 风险与降级

- **图片可用性/限流风险**（只代理不缓存）：需要 UI 兜底（占位贴图、重试、失败提示），并尽可能允许客户端缓存生效。
- **全量点位渲染压力**：必须依赖 LOD/聚类，且近景海报贴图必须懒加载、并限制同屏贴图数量。
- **数据更新**：混合模式中的“在线更新”若实现，建议仅更新索引与详情 JSON（不强制更新图片），并写入 IndexedDB 覆盖本地版本。

## 11. 验收标准（Definition of Done）

1) 二次元领域切换后：地球远景不卡顿（聚类点模式）。  
2) 缩放到近景：海报点按需加载、点击能弹出详情。  
3) 使用截图导出：导出图片中包含海报/实景贴图（证明未污染画布）。  
4) `/api/animeJourney`：给定输入能返回 4–6 站有效 `pointId`，前端可依次飞行并高亮。  

## 12. 未决项（如需进一步细化）

- 聚类算法选型（geohash 网格聚合 vs R-tree + 聚类）
- 近景海报上限与加载队列策略（例如同屏最多 N 张贴图并发）
- 在线更新的版本对比策略（manifest `version/modified` 如何生成）
