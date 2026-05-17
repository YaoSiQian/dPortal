# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

界门 · Portal — an immersive 3D solar-system web experience (Next.js 14 App Router + React Three Fiber). User describes a theme; an LLM curates a 4–5 stop cinematic tour through real planets and NASA spacecraft, with curated Chinese sci-fi film recommendations. See `README.md` for the full feature/feel description and `docs/PRD.md` for the product spec.

## Commands

```bash
npm install
npm run dev      # next dev → http://localhost:3000
npm run build    # next build
npm run lint     # next lint
```

There is **no test runner** configured. Don't invent `npm test`.

### Environment

Required `.env.local` keys (server-only — never expose to the client):

- `OPENAI_API_KEY` — used by `/api/journey` and `/api/tts`
- `OPENAI_BASE_URL` — OpenAI-compatible endpoint (default `https://api.openai.com/v1`)
- `NAVIGATOR_MODEL` — chat model for journey curation (default `gpt-4o`)

All LLM/TTS calls **must** go through the server proxy routes under `app/api/`. The key never reaches the browser.

## Architecture

### State machine (single source of truth)

`lib/sceneStore.tsx` is a React Context store holding all cross-cutting UI state. Two key concurrent state machines:

- `status: 'overview' | 'voyaging'` — overall scene mode
- `navigatorPhase: 'closed' | 'prompting' | 'loading' | 'previewing' | 'running' | 'summary'` — Journey lifecycle

Plus: `focused` (PlanetId), `focusedArtifact` (SpacecraftId), `journey`, `journeyStopIndex`, library/audio prefs, etc. **Always update phase via `setNavigatorPhase` rather than introducing parallel flags.**

### Registration pattern (camera ↔ scene objects)

3D objects (planets, spacecraft) register their live `THREE.Group` refs into `planets` / `artifacts` Maps via hooks at mount:

- `usePlanetInteraction(id, ref, approachDistance, radius)` — for planets
- `useArtifactRegistration(id, ref, approachDistance)` — for spacecraft (called by `SurfaceArtifact`, `OrbitArtifact`, and the inline `<Voyager>` group in `Scene.tsx`)

`CameraRig` reads world positions out of these refs each frame to follow moving targets (orbiting craft, spinning planets). **A new spacecraft must call `useArtifactRegistration` or the Navigator cannot fly to it.**

### LLM curation flow (`app/api/journey/route.ts`)

1. Builds a system prompt by interpolating `buildPlanetsBlock()`, `buildSpacecraftBlock()`, `buildFilmsBlock()` from `lib/journeyInventory.ts` — the LLM only ever sees what the inventory exposes.
2. Calls upstream with `response_format: json_object`.
3. **Validates** every returned `target.id` against `isValidPlanetId` / `isValidSpacecraftId` and every `filmPath` against `isValidFilmPath` — invalid → 502. The first stop is enforced to be near Earth.

When adding a planet, spacecraft, or film, the inventory dictionaries are how the LLM discovers it — **prompts do not need editing**, but TypeScript will list every dictionary you must update. See `README.md` "添加内容" for the exact step list.

### Camera system (`components/space/CameraRig.tsx`)

Five modes coexist in one rig: `transitioning` (GSAP arc to a new focus), `dwelling` (orbit around target during a journey hold), focused-planet / focused-artifact (OrbitControls + parallax), `voyaging` (yields to `<Voyage>`), free-fly (WASD: W/S forward/back, A/D strafe, Q/E down/up — disabled inside a running journey). Speed scales with distance from target.

### Journey playback (`components/navigator/JourneyController.tsx`)

Per stop: aim camera → 4 s settle → subtitle + film card fade in + pre-fetched TTS plays → ~5.8 s hold → advance. **All TTS is prefetched in parallel at journey start** (one `/api/tts` call per stop), stored as blob-URL `Audio` instances in a ref map, revoked on cleanup. Autoplay/network failures fall back silently to subtitles only. Audio mute pref is persisted to `localStorage` under `portal:audioMuted`.

### Render entry point

`app/page.tsx` mounts the `Scene` (R3F Canvas, dynamically imported with `ssr: false`) plus 2D HUD/Navigator/Landing layers, all wrapped in `SceneStoreProvider`. The 3D scene root is `components/space/Scene.tsx`.

## Conventions

- TS path alias `@/*` → repo root. Use `@/lib/...`, `@/components/...`.
- Strict TS is on; `'use client'` is required at the top of any file using hooks/state.
- All user-facing copy is **Chinese (full-width punctuation)** with English secondary labels where shown. Subtitles in particular are tuned for TTS — see the SYSTEM_PROMPT in `app/api/journey/route.ts`.
- Design rules from the README ("Design 原则") are enforced in copy/UI: no white/saturated colours, no tour-guide phrases ("让我们" / "出发" / "开始我们的旅程"), 4–5 s camera transitions, ~5–7 °/s dwell. Apply these when authoring narration prompts or new UI strings.
- Planets/atmospheres use custom GLSL in `lib/shaders/` and ignore scene lights; spacecraft GLBs rely on the `pointLight` + `ambientLight` declared in `Scene.tsx`.
