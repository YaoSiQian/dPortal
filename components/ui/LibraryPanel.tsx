'use client';

import { useEffect } from 'react';

import {
  PLANET_LABELS,
  useSceneStore,
  type PlanetId
} from '@/lib/sceneStore';
import { PLANET_BY_POSTER, POSTERS_BY_PLANET } from '@/lib/postersData';
import { MOVIES_BY_PATH } from '@/lib/movieInfo';
import { SPACECRAFT, SPACECRAFT_IDS } from '@/lib/journeyInventory';
import type { SpacecraftId } from '@/lib/journeyTypes';

// LibraryPanel — right-side curated index. Two columns of films and
// spacecraft, filterable by planet. Clicking a card flies the camera to
// that subject (existing setFocused / setFocusedArtifact pipeline).
//
// Visual contract: matches Navigator / MoviePanel — dark glass surface
// with hairline borders, cosmic letter-spacing labels, no chromatic
// accents beyond the existing cyan glow. Sits on the right edge so the
// central 3D scene stays the primary focus.

const PLANET_ORDER: PlanetId[] = [
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

// Spacecraft host planet → all spacecraft on that body. Pre-computed so
// rendering doesn't loop through SPACECRAFT every frame.
const SPACECRAFT_BY_PLANET: Record<PlanetId, SpacecraftId[]> = (() => {
  const map = {} as Record<PlanetId, SpacecraftId[]>;
  for (const p of PLANET_ORDER) map[p] = [];
  for (const id of SPACECRAFT_IDS) {
    const host = SPACECRAFT[id].hostPlanet;
    map[host].push(id);
  }
  return map;
})();

const KIND_LABEL: Record<'surface' | 'orbit' | 'deepspace', string> = {
  surface: '表面',
  orbit: '轨道',
  deepspace: '深空'
};

export function LibraryPanel() {
  const {
    introDone,
    status,
    navigatorPhase,
    libraryOpen,
    libraryFilter,
    setLibraryOpen,
    setLibraryFilter,
    setFocused,
    setFocusedArtifact,
    setSelectedPoster,
    focused,
    focusedArtifact
  } = useSceneStore();

  // Only available outside the cinematic / journey states.
  const available =
    introDone && status !== 'voyaging' && navigatorPhase === 'closed';

  // Hide the panel entirely if not available; remember the user's previous
  // open state so it returns when conditions allow again.
  useEffect(() => {
    if (!available && libraryOpen) {
      // Don't actually close — just don't render. We keep state so the
      // panel reopens when the journey / voyage finishes.
    }
  }, [available, libraryOpen]);

  if (!available) return null;

  const onPickFilm = (path: string) => {
    const planet = PLANET_BY_POSTER[path];
    if (!planet) return;
    setFocusedArtifact(null);
    setFocused(planet);
    // Open the bottom film detail strip so the user gets immediate
    // textual context for what they just clicked. MoviePanel only
    // auto-clears when the user returns to overview, so this stays
    // visible during the camera fly-in and orbit.
    setSelectedPoster(path);
  };

  const onPickSpacecraft = (id: SpacecraftId) => {
    const host = SPACECRAFT[id].hostPlanet;
    setFocused(host);
    setFocusedArtifact(id);
  };

  const planetsWithContent = PLANET_ORDER.filter(
    (p) =>
      (POSTERS_BY_PLANET[p]?.length ?? 0) > 0 ||
      (SPACECRAFT_BY_PLANET[p]?.length ?? 0) > 0
  );

  // Build the list of planets to render. 'all' iterates every planet that
  // has anything; specific filter is just one entry.
  const planetsToShow =
    libraryFilter === 'all' ? planetsWithContent : [libraryFilter];

  return (
    <>
      {/* Edge handle — visible whenever the panel is closed. Single tap
          re-opens. Sits flush against the right edge with hairline tab.
          Vertical text uses writing-mode: vertical-rl which stacks Chinese
          characters top-to-bottom in their natural orientation; Latin
          chars get auto-rotated 90° clockwise, which reads as expected on
          a book-spine-style tab. NO additional rotate is needed. */}
      {!libraryOpen && (
        <button
          type="button"
          onClick={() => setLibraryOpen(true)}
          aria-label="Open library"
          className="fixed right-0 top-1/2 -translate-y-1/2 z-20 group flex flex-col items-center gap-2 py-4 pl-2 pr-1.5 border border-r-0 border-stardust/15 bg-deep/70 backdrop-blur-md hover:border-stardust/40 transition-all duration-500"
        >
          <span
            className="text-stardust/70 group-hover:text-stardust/95 text-[10px] tracking-wider2"
            style={{ writingMode: 'vertical-rl' }}
          >
            资料库 · LIBRARY
          </span>
        </button>
      )}

      {/* Main panel */}
      <aside
        className={`fixed right-0 top-0 h-full z-20 w-[360px] max-w-[85vw] bg-deep/85 backdrop-blur-md border-l border-stardust/15 flex flex-col transition-transform duration-700 ease-out ${
          libraryOpen ? 'translate-x-0' : 'translate-x-full pointer-events-none'
        }`}
        style={{ boxShadow: '0 0 60px rgba(155,216,255,0.04)' }}
      >
        {/* Header */}
        <div className="flex items-baseline justify-between px-7 pt-7 pb-5">
          <div>
            <div className="text-stardust/85 text-[11px] tracking-cosmic uppercase">
              Library
            </div>
            <div className="mt-1 text-stardust/35 text-[9px] tracking-wider2 uppercase">
              资料库 · {countTotal(libraryFilter)} 项
            </div>
          </div>
          <button
            type="button"
            onClick={() => setLibraryOpen(false)}
            aria-label="Close"
            className="text-stardust/35 hover:text-stardust/85 text-lg leading-none transition-colors duration-300"
          >
            ×
          </button>
        </div>

        <div className="h-px w-full bg-stardust/10" />

        {/* Filter pills */}
        <div className="px-5 py-3 overflow-x-auto scrollbar-hide">
          <div className="flex items-center gap-1.5">
            <FilterPill
              label="全部"
              active={libraryFilter === 'all'}
              onClick={() => setLibraryFilter('all')}
            />
            {planetsWithContent.map((p) => (
              <FilterPill
                key={p}
                label={planetShortLabel(p)}
                active={libraryFilter === p}
                onClick={() => setLibraryFilter(p)}
              />
            ))}
          </div>
        </div>

        <div className="h-px w-full bg-stardust/10" />

        {/* Body — scrollable grid */}
        <div className="flex-1 overflow-y-auto px-5 pt-5 pb-8">
          {planetsToShow.map((planetId, sectionIdx) => {
            const films = POSTERS_BY_PLANET[planetId] ?? [];
            const ships = SPACECRAFT_BY_PLANET[planetId] ?? [];
            if (films.length === 0 && ships.length === 0) return null;

            const showSectionLabel = libraryFilter === 'all';

            return (
              <div key={planetId} className={sectionIdx > 0 ? 'mt-7' : ''}>
                {showSectionLabel && (
                  <div className="mb-3 flex items-baseline gap-2">
                    <span className="text-stardust/65 text-[11px] tracking-wider2">
                      {PLANET_LABELS[planetId]}
                    </span>
                    <span className="text-stardust/25 text-[9px] tracking-cosmic uppercase">
                      {planetSubLabel(planetId)}
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  {/* Spacecraft first — they're the "real" subjects */}
                  {ships.map((id) => (
                    <SpacecraftCard
                      key={id}
                      id={id}
                      active={focusedArtifact === id}
                      onClick={() => onPickSpacecraft(id)}
                    />
                  ))}
                  {/* Films */}
                  {films.map((path) => (
                    <FilmCard
                      key={path}
                      path={path}
                      active={focused === planetId && !focusedArtifact}
                      onClick={() => onPickFilm(path)}
                    />
                  ))}
                </div>
              </div>
            );
          })}

          {planetsToShow.every(
            (p) =>
              (POSTERS_BY_PLANET[p]?.length ?? 0) === 0 &&
              (SPACECRAFT_BY_PLANET[p]?.length ?? 0) === 0
          ) && (
            <div className="text-stardust/30 text-[11px] tracking-wider2 leading-relaxed text-center mt-12">
              这颗星球暂无关联资料。
            </div>
          )}
        </div>

        <div className="h-px w-full bg-stardust/10" />
        <div className="px-7 py-4 text-stardust/25 text-[9px] tracking-cosmic uppercase select-none">
          Click to navigate · 点击跳转
        </div>
      </aside>
    </>
  );
}

// ----------------------------- Subcomponents -----------------------------

function FilterPill({
  label,
  active,
  onClick
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-shrink-0 px-3 py-1.5 text-[10px] tracking-wider2 transition-all duration-500 border ${
        active
          ? 'border-stardust/55 text-stardust/95 bg-stardust/[0.04]'
          : 'border-stardust/10 text-stardust/45 hover:border-stardust/30 hover:text-stardust/75'
      }`}
    >
      {label}
    </button>
  );
}

function FilmCard({
  path,
  active,
  onClick
}: {
  path: string;
  active: boolean;
  onClick: () => void;
}) {
  const film = MOVIES_BY_PATH[path];
  if (!film) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group text-left transition-all duration-500 ease-out ${
        active ? 'opacity-100' : 'opacity-90 hover:opacity-100'
      }`}
      title={film.titleZh}
    >
      <div
        className={`aspect-[2/3] overflow-hidden border bg-deep transition-all duration-500 ${
          active
            ? 'border-stardust/55 shadow-[0_0_30px_rgba(155,216,255,0.15)]'
            : 'border-stardust/10 group-hover:border-stardust/35'
        }`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={film.poster}
          alt={film.titleZh}
          className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
        />
      </div>
      <div className="mt-2 text-stardust/85 group-hover:text-stardust text-[11px] tracking-wider2 leading-tight truncate transition-colors duration-300">
        {film.titleZh}
      </div>
      <div className="mt-0.5 text-stardust/30 text-[9px] tracking-cosmic uppercase tabular-nums">
        {film.year}
      </div>
    </button>
  );
}

function SpacecraftCard({
  id,
  active,
  onClick
}: {
  id: SpacecraftId;
  active: boolean;
  onClick: () => void;
}) {
  const s = SPACECRAFT[id];
  return (
    <button
      type="button"
      onClick={onClick}
      className="group text-left transition-all duration-500 ease-out"
      title={s.name}
    >
      <div
        className={`aspect-[2/3] flex flex-col justify-between p-3 border bg-deep/60 transition-all duration-500 ${
          active
            ? 'border-[#9bd8ff]/55 shadow-[0_0_30px_rgba(155,216,255,0.18)]'
            : 'border-stardust/12 group-hover:border-stardust/40'
        }`}
      >
        <div className="flex items-start justify-between">
          <span
            className={`block w-1.5 h-1.5 rounded-full transition-colors duration-500 ${
              active ? 'bg-[#9bd8ff]' : 'bg-stardust/35 group-hover:bg-stardust/65'
            }`}
          />
          <span className="text-stardust/30 text-[8px] tracking-cosmic uppercase">
            {KIND_LABEL[s.kind]}
          </span>
        </div>

        <div>
          <div className="text-stardust/95 text-[14px] tracking-wider2 font-light leading-tight">
            {s.name}
          </div>
          <div className="mt-1 text-stardust/30 text-[8px] tracking-cosmic uppercase truncate">
            {id.replace(/_/g, ' ')}
          </div>
        </div>
      </div>
      <div className="mt-2 text-stardust/55 group-hover:text-stardust/85 text-[10px] tracking-cosmic uppercase truncate transition-colors duration-300">
        航天器
      </div>
      <div className="mt-0.5 text-stardust/25 text-[9px] tracking-wider2">
        {PLANET_LABELS[s.hostPlanet]}
      </div>
    </button>
  );
}

// ----------------------------- Helpers -----------------------------

function planetShortLabel(p: PlanetId): string {
  // Compact Chinese labels for filter pills.
  const m: Record<PlanetId, string> = {
    mercury: '水星',
    venus: '金星',
    earth: '地球',
    moon: '月球',
    mars: '火星',
    jupiter: '木星',
    saturn: '土星',
    uranus: '天王星',
    neptune: '海王星'
  };
  return m[p];
}

function planetSubLabel(p: PlanetId): string {
  return PLANET_LABELS[p];
}

function countTotal(filter: PlanetId | 'all'): number {
  if (filter === 'all') {
    let n = 0;
    for (const arr of Object.values(POSTERS_BY_PLANET)) n += arr.length;
    n += SPACECRAFT_IDS.length;
    return n;
  }
  return (
    (POSTERS_BY_PLANET[filter]?.length ?? 0) +
    (SPACECRAFT_BY_PLANET[filter]?.length ?? 0)
  );
}
