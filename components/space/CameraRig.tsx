'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import gsap from 'gsap';

import { useSceneStore } from '@/lib/sceneStore';
import { SPACECRAFT } from '@/lib/journeyInventory';

// Cinematic camera system. Modes:
//   transitioning   — GSAP focus change along an arced Catmull-Rom curve
//   dwelling        — journey-only: after the curve ends, the camera
//                     actively orbits the current target so motion never
//                     stalls (the next curve picks up from a moving state)
//   focused planet  — OrbitControls + parallax overlay, target follows
//                     the focused planet's world position
//   focused artifact — same as focused planet, but target is a spacecraft's
//                     live world position with a much closer approach distance
//   free-fly        — WASD takes over (disabled inside a running journey)
//   voyaging        — yields to <Voyage />
//
// WASD keys:   W/S = forward/back, A/D = strafe, Q/E = down/up
// Speed scales with distance from target — slow when close, fast when far.

const OVERVIEW_DIST = 260;
const OVERVIEW_TARGET = new THREE.Vector3(0, 0, 0);
const PAR_THETA_MAX = 0.18;
const PAR_PHI_MAX = 0.10;

// Journey orbital dwell — angular speed (rad/sec) at which the camera
// circles the target during the hold portion of each stop. ~5°/sec.
const DWELL_ORBIT_SPEED = 0.087;

function rotateAroundTarget(
  camera: THREE.Camera,
  target: THREE.Vector3,
  deltaTheta: number,
  deltaPhi: number,
  scratch: THREE.Vector3
) {
  scratch.subVectors(camera.position, target);
  const radius = scratch.length();
  if (radius < 0.0001) return;
  const theta = Math.atan2(scratch.x, scratch.z);
  const phi = Math.acos(THREE.MathUtils.clamp(scratch.y / radius, -1, 1));
  const newTheta = theta + deltaTheta;
  const newPhi = THREE.MathUtils.clamp(phi + deltaPhi, 0.08, Math.PI - 0.08);
  const sinPhi = Math.sin(newPhi);
  scratch.x = radius * sinPhi * Math.sin(newTheta);
  scratch.y = radius * Math.cos(newPhi);
  scratch.z = radius * sinPhi * Math.cos(newTheta);
  camera.position.copy(target).add(scratch);
  camera.lookAt(target);
}

type KeyState = {
  w: boolean;
  a: boolean;
  s: boolean;
  d: boolean;
  q: boolean;
  e: boolean;
};

export function CameraRig() {
  const { camera } = useThree();
  const {
    focused,
    focusedArtifact,
    status,
    planets,
    artifacts,
    controlsRef,
    navigatorPhase,
    domain,
    animeNavigatorPhase
  } = useSceneStore();

  const planetPos = useRef(new THREE.Vector3());
  const desiredTarget = useRef(new THREE.Vector3());
  const offset = useRef(new THREE.Vector3());
  const scratch = useRef(new THREE.Vector3());
  const flyDir = useRef(new THREE.Vector3());
  const flyRight = useRef(new THREE.Vector3());
  const flyMove = useRef(new THREE.Vector3());

  const parTheta = useRef(0);
  const parPhi = useRef(0);
  const prevParTheta = useRef(0);
  const prevParPhi = useRef(0);

  const keysRef = useRef<KeyState>({ w: false, a: false, s: false, d: false, q: false, e: false });
  const freeFly = useRef(false);

  // `transitioning` (React state) drives OrbitControls.enabled. The hot path
  // inside useFrame reads `transitioningRef` instead, updated synchronously
  // inside the focus-change effect to avoid a one-frame "tracking peek"
  // between the focus change and the GSAP tween starting.
  const [transitioning, setTransitioning] = useState(false);
  const transitioningRef = useRef(false);
  const transitionRef = useRef({
    curve: null as THREE.CatmullRomCurve3 | null,
    curveType: 'simple' as 'simple' | 'dramatic',
    progress: { value: 0 },
    startTarget: new THREE.Vector3(),
    endTarget: new THREE.Vector3(),
    tween: null as gsap.core.Tween | null
  });

  // Orbital dwell state — populated by the GSAP onComplete when we're
  // inside a running journey. While `dwell.active` is true, useFrame
  // ignores tracking and instead updates the camera angle each tick.
  const dwellRef = useRef({
    active: false,
    angle: 0, // theta around target Y axis
    radius: 0,
    height: 0
  });

  const lastStatusRef = useRef(status);
  const lastFocusedRef = useRef(focused);
  const lastFocusedArtifactRef = useRef(focusedArtifact);

  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k in keysRef.current) (keysRef.current as Record<string, boolean>)[k] = true;
    };
    const onUp = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k in keysRef.current) (keysRef.current as Record<string, boolean>)[k] = false;
    };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
    };
  }, []);

  // Any focus change re-engages tracking by clearing the free-fly flag.
  useEffect(() => {
    freeFly.current = false;
  }, [focused, focusedArtifact]);

  // Leaving the running phase clears the dwell so plain tracking takes over
  // for the summary / closed states. An anime journey kicking into 'running'
  // also clears dwell — CameraRig stands down entirely while the anime
  // controller owns the camera.
  useEffect(() => {
    const inAnimeJourney = domain === 'anime' && animeNavigatorPhase === 'running';
    if (navigatorPhase !== 'running' || inAnimeJourney) {
      dwellRef.current.active = false;
    }
  }, [navigatorPhase, domain, animeNavigatorPhase]);

  useEffect(() => {
    const t = transitionRef.current;
    const prevStatus = lastStatusRef.current;
    const prevFocused = lastFocusedRef.current;
    const prevArtifact = lastFocusedArtifactRef.current;
    lastStatusRef.current = status;
    lastFocusedRef.current = focused;
    lastFocusedArtifactRef.current = focusedArtifact;

    parTheta.current = 0;
    parPhi.current = 0;
    prevParTheta.current = 0;
    prevParPhi.current = 0;

    if (status === 'voyaging') {
      t.tween?.kill();
      t.tween = null;
      transitioningRef.current = false;
      dwellRef.current.active = false;
      setTransitioning(false);
      return;
    }

    if (prevStatus === 'voyaging') return;

    if (focused === prevFocused && focusedArtifact === prevArtifact) return;
    if (!controlsRef.current) return;
    const controls = controlsRef.current;

    let endTarget: THREE.Vector3;
    let endDist: number;

    if (focusedArtifact) {
      const info = artifacts.get(focusedArtifact);
      if (!info?.ref.current) return;
      const p = new THREE.Vector3();
      info.ref.current.getWorldPosition(p);
      endTarget = p;
      endDist = info.approachDistance;
    } else if (focused) {
      const info = planets.get(focused);
      if (!info?.ref.current) return;
      const p = new THREE.Vector3();
      info.ref.current.getWorldPosition(p);
      endTarget = p;
      endDist = info.approachDistance;
    } else {
      endTarget = new THREE.Vector3(0, 0, 0);
      endDist = OVERVIEW_DIST;
    }

    const startCamPos = camera.position.clone();
    const startTarget = controls.target.clone();
    const dir = new THREE.Vector3().subVectors(startCamPos, startTarget);
    if (dir.lengthSq() < 0.0001) dir.set(0, 0.25, 1);
    dir.normalize();

    // For artifact targets we override `dir` so the camera arrives on the
    // host planet's *outside*. The naive "carry the previous viewing
    // direction" fallback can put the camera through the planet body,
    // and the ensuing orbital dwell then sweeps inside the planet.
    //
    // Strategy:
    //   surface  — outward radial from host through artifact + sizable Y
    //              lift so the camera ends up looking *down* at the
    //              landing site rather than horizontally across the
    //              surface (which clips into the host immediately).
    //   orbit    — outward radial from host through artifact, no Y lift
    //              needed; this guarantees the camera sits further out
    //              than the artifact's orbit radius.
    //   deepspace — keep the carried-over dir; Voyager 1 has no host so
    //               anchoring to one would be meaningless.
    let endCamDir = dir;
    if (focusedArtifact) {
      const meta = SPACECRAFT[focusedArtifact];
      const host = planets.get(meta.hostPlanet);
      if (host?.ref.current && meta.kind !== 'deepspace') {
        const hostPos = new THREE.Vector3();
        host.ref.current.getWorldPosition(hostPos);
        const outward = endTarget.clone().sub(hostPos);
        if (outward.lengthSq() > 0.0001) {
          outward.normalize();
          if (meta.kind === 'surface') {
            outward.y += 0.6;
            outward.normalize();
          }
          endCamDir = outward;
        }
      }
    }

    const endCamPos = endTarget.clone().addScaledVector(endCamDir, endDist);

    const distance = startCamPos.distanceTo(endCamPos);

    // Curve shapes:
    //   dramatic   — manual planet → planet outside a journey (2 lifted CPs)
    //   journey    — 4 control points: start → pullback → mid → end. The
    //                pullback sits along the start-target outgoing direction
    //                so the camera first drifts AWAY from the previous
    //                subject (it shrinks behind us) before turning toward
    //                the next. Mid is a high arc that clears any planets
    //                lying on the chord.
    //   simple     — overview ↔ planet, or planet ↔ artifact zoom-in.
    const isPlanetToPlanet =
      prevFocused !== null && focused !== null && !focusedArtifact && !prevArtifact;
    const inAnimeJourney = domain === 'anime' && animeNavigatorPhase === 'running';
    const inJourney = navigatorPhase === 'running' || inAnimeJourney;
    const useDramatic = isPlanetToPlanet && !inJourney;
    // "Subject-to-subject" inside a journey: prior frame had a target (planet
    // or artifact) and so does the new one. Pure overview→first-stop falls
    // through to the simple branch (no pullback needed when starting fresh).
    const useJourneyCurve =
      inJourney && (prevFocused !== null || prevArtifact !== null);

    let curve: THREE.CatmullRomCurve3;
    if (useDramatic) {
      const mid1 = startCamPos.clone().lerp(endCamPos, 0.28);
      mid1.y += distance * 0.40;
      const mid2 = startCamPos.clone().lerp(endCamPos, 0.72);
      mid2.y += distance * 0.40;
      curve = new THREE.CatmullRomCurve3(
        [startCamPos, mid1, mid2, endCamPos],
        false,
        'centripetal'
      );
    } else if (useJourneyCurve) {
      // Pullback: from current cam pos, continue the (cam − startTarget)
      // direction outward by ~1.6× the prior approach radius. This is the
      // direction the camera was already orbiting around the previous
      // subject, so picking up its velocity feels organic.
      const prevRadius = startCamPos.distanceTo(startTarget);
      const pullback = startCamPos
        .clone()
        .addScaledVector(dir, prevRadius * 1.6);
      // Soften the pullback height so the arc doesn't dip in the middle:
      // bias it toward the average of pullback.y and mid.y later.
      // Mid sits at the chord midpoint, lifted enough to clear bodies
      // living on the y≈0 ecliptic. Floor of 6 units guarantees clearance
      // even on short hops.
      const mid = pullback.clone().lerp(endCamPos, 0.55);
      const lift = Math.max(distance * 0.22, 6);
      mid.y = Math.max(pullback.y, endCamPos.y) + lift;

      curve = new THREE.CatmullRomCurve3(
        [startCamPos, pullback, mid, endCamPos],
        false,
        'centripetal'
      );
    } else {
      // Plain simple curve. For artifact targets we lift the midpoint
      // significantly so the camera's path arcs over the host planet
      // rather than skimming through it. Distance here is small (we're
      // usually zooming in from a planet view to a spacecraft on / over
      // that same planet), so a fixed minimum lift matters more than
      // a percent-of-distance lift.
      const isArtifactZoom = focusedArtifact !== null;
      const lift = isArtifactZoom ? 0.5 : isPlanetToPlanet ? 0.12 : 0.06;
      const mid = startCamPos.clone().lerp(endCamPos, 0.5);
      mid.y += distance * lift;
      if (isArtifactZoom) {
        // Also push the mid-point out along endCamDir, away from the
        // host body, so the arc sits clearly above the planet.
        mid.addScaledVector(endCamDir, endDist * 0.6);
      }
      curve = new THREE.CatmullRomCurve3(
        [startCamPos, mid, endCamPos],
        false,
        'centripetal'
      );
    }

    t.curve = curve;
    t.curveType = useDramatic ? 'dramatic' : 'simple';
    t.startTarget.copy(startTarget);
    t.endTarget.copy(endTarget);
    t.progress.value = 0;
    t.tween?.kill();

    // Starting a new transition cancels any active dwell.
    dwellRef.current.active = false;

    transitioningRef.current = true;
    setTransitioning(true);

    // Durations
    let minDuration: number;
    let base: number;
    let maxDuration: number;
    if (useDramatic) {
      base = 3.0;
      minDuration = 1.8;
      maxDuration = 3.2;
    } else if (useJourneyCurve) {
      // Pullback adds curve length, so allow more time. Range 4.0–5.5s.
      base = 4.5;
      minDuration = 4.0;
      maxDuration = 5.5;
    } else if (focusedArtifact) {
      base = 1.6;
      minDuration = 1.2;
      maxDuration = 3.2;
    } else {
      base = 2.0;
      minDuration = 1.8;
      maxDuration = 3.2;
    }
    const duration = THREE.MathUtils.clamp(
      (distance / 200) * base,
      minDuration,
      maxDuration
    );

    t.tween = gsap.to(t.progress, {
      value: 1,
      duration,
      // sine.inOut gives a gentle in / gentle out without a peaky middle —
      // the dwell will pick up speed continuously after this.
      ease: inJourney ? 'sine.inOut' : 'power2.inOut',
      onComplete: () => {
        if (t.curve) {
          const ep = t.curve.getPointAt(1, new THREE.Vector3());
          camera.position.copy(ep);
        }
        if (controlsRef.current) {
          controlsRef.current.target.copy(t.endTarget);
          camera.lookAt(controlsRef.current.target);
        }

        // Inside a running scifi journey, kick off orbital dwell instead of
        // handing back to tracking. Capture the current angle / radius so
        // there's no jump. Anime journeys have their own controller driving
        // the camera, so we leave dwell off.
        if (
          navigatorPhase === 'running' &&
          !inAnimeJourney &&
          controlsRef.current
        ) {
          const o = new THREE.Vector3().subVectors(
            camera.position,
            controlsRef.current.target
          );
          dwellRef.current.angle = Math.atan2(o.x, o.z);
          dwellRef.current.height = o.y;
          dwellRef.current.radius = Math.sqrt(o.x * o.x + o.z * o.z);
          dwellRef.current.active = true;
        }

        transitioningRef.current = false;
        setTransitioning(false);
      }
    });
  }, [focused, focusedArtifact, status, planets, artifacts, controlsRef, camera, navigatorPhase, domain, animeNavigatorPhase]);

  useFrame((state, dt) => {
    if (status === 'voyaging') return;
    if (!controlsRef.current) return;
    const controls = controlsRef.current;
    const t = transitionRef.current;
    const inAnimeJourney = domain === 'anime' && animeNavigatorPhase === 'running';

    // ============ Cinematic transition ============
    if (transitioningRef.current && t.curve) {
      const p = t.progress.value;
      t.curve.getPointAt(p, scratch.current);
      camera.position.copy(scratch.current);
      const blend =
        t.curveType === 'dramatic'
          ? THREE.MathUtils.smoothstep(p, 0.22, 0.78)
          : p;
      controls.target.copy(t.startTarget).lerp(t.endTarget, blend);
      camera.lookAt(controls.target);
      return;
    }

    // ============ Anime journey: yield ============
    // The AnimeJourneyController owns the camera entirely while an anime
    // journey runs (it lerps both camera.position and controls.target every
    // frame). Writing anything here would fight it and produce jitter.
    if (inAnimeJourney) {
      return;
    }

    // ============ Journey orbital dwell ============
    // Active in the gap between transitions during a running journey. The
    // camera circles the live world position of the current subject, never
    // sitting still. WASD and OrbitControls are inert while dwell is active.
    if (dwellRef.current.active && navigatorPhase === 'running') {
      // Resolve the live target each frame — handles orbital artifacts that
      // are still drifting around their host.
      let liveTarget: THREE.Vector3 | null = null;
      if (focusedArtifact) {
        const info = artifacts.get(focusedArtifact);
        if (info?.ref.current) {
          info.ref.current.getWorldPosition(planetPos.current);
          liveTarget = planetPos.current;
        }
      } else if (focused) {
        const info = planets.get(focused);
        if (info?.ref.current) {
          info.ref.current.getWorldPosition(planetPos.current);
          liveTarget = planetPos.current;
        }
      }

      if (liveTarget) {
        controls.target.copy(liveTarget);
        dwellRef.current.angle += DWELL_ORBIT_SPEED * dt;
        const a = dwellRef.current.angle;
        const r = dwellRef.current.radius;
        camera.position.set(
          liveTarget.x + r * Math.sin(a),
          liveTarget.y + dwellRef.current.height,
          liveTarget.z + r * Math.cos(a)
        );
        camera.lookAt(controls.target);
      }
      return;
    }

    // ============ WASD free-fly ============
    // Disabled inside a running journey — the journey owns the camera.
    const k = keysRef.current;
    const anyKey =
      navigatorPhase !== 'running' &&
      (k.w || k.a || k.s || k.d || k.q || k.e);

    if (anyKey && !freeFly.current) {
      freeFly.current = true;
    }

    if (freeFly.current && navigatorPhase !== 'running') {
      if (anyKey) {
        camera.getWorldDirection(flyDir.current);
        flyRight.current.crossVectors(flyDir.current, camera.up).normalize();
        flyMove.current.set(0, 0, 0);

        if (k.w) flyMove.current.add(flyDir.current);
        if (k.s) flyMove.current.sub(flyDir.current);
        if (k.d) flyMove.current.add(flyRight.current);
        if (k.a) flyMove.current.sub(flyRight.current);
        if (k.e) flyMove.current.y += 1;
        if (k.q) flyMove.current.y -= 1;

        if (flyMove.current.lengthSq() > 0) {
          const dist = camera.position.distanceTo(controls.target);
          const speed = Math.max(2, dist * 0.9) * dt;
          flyMove.current.normalize().multiplyScalar(speed);
          camera.position.add(flyMove.current);
          controls.target.add(flyMove.current);
        }
      }

      controls.minDistance = 0.3;
      controls.autoRotateSpeed = 0;
      controls.update();
      return;
    }

    // ============ Tracking free mode ============
    if (prevParTheta.current !== 0 || prevParPhi.current !== 0) {
      rotateAroundTarget(
        camera,
        controls.target,
        -prevParTheta.current,
        -prevParPhi.current,
        scratch.current
      );
    }

    let desiredDist: number;
    let useParallax = false;

    if (focusedArtifact) {
      const info = artifacts.get(focusedArtifact);
      if (info?.ref.current) {
        info.ref.current.getWorldPosition(planetPos.current);
        desiredTarget.current.copy(planetPos.current);
        desiredDist = info.approachDistance;
      } else {
        desiredTarget.current.copy(OVERVIEW_TARGET);
        desiredDist = OVERVIEW_DIST;
      }
    } else if (focused) {
      const info = planets.get(focused);
      if (info?.ref.current) {
        info.ref.current.getWorldPosition(planetPos.current);
        desiredTarget.current.copy(planetPos.current);
        desiredDist = info.approachDistance;
      } else {
        desiredTarget.current.copy(OVERVIEW_TARGET);
        desiredDist = OVERVIEW_DIST;
      }
    } else {
      desiredTarget.current.copy(OVERVIEW_TARGET);
      desiredDist = OVERVIEW_DIST;
      useParallax = true;
    }

    const followK = Math.min(dt * (focusedArtifact ? 3.0 : 1.4), 1);
    controls.target.lerp(desiredTarget.current, followK);

    offset.current.subVectors(camera.position, controls.target);
    const currentDist = offset.current.length();
    if (currentDist < 0.001) offset.current.set(0, 0.2, 1).normalize();
    else offset.current.divideScalar(currentDist);

    const newDist = currentDist + (desiredDist - currentDist) * followK;
    camera.position.copy(controls.target).addScaledVector(offset.current, newDist);

    controls.minDistance = focusedArtifact
      ? 0.15
      : focused
        ? Math.max(0.5, (planets.get(focused)?.radius ?? 1) * 1.1)
        : 50;
    controls.autoRotateSpeed = focusedArtifact ? 0 : focused ? 0.30 : 0.18;

    controls.update();

    const desiredTheta = useParallax ? state.pointer.x * PAR_THETA_MAX : 0;
    const desiredPhi = useParallax ? -state.pointer.y * PAR_PHI_MAX : 0;
    const parSmoothing = 1 - Math.pow(0.001, dt * 2.5);
    parTheta.current += (desiredTheta - parTheta.current) * parSmoothing;
    parPhi.current += (desiredPhi - parPhi.current) * parSmoothing;

    rotateAroundTarget(
      camera,
      controls.target,
      parTheta.current,
      parPhi.current,
      scratch.current
    );
    prevParTheta.current = parTheta.current;
    prevParPhi.current = parPhi.current;
  });

  // OrbitControls is disabled in three places:
  //   · voyaging — Voyage owns the camera
  //   · transitioning — GSAP owns the camera mid-flight
  //   · journey running — dwell + curves own the camera (scifi) or the
  //     AnimeJourneyController owns it (anime); either way user input is
  //     locked out so the cinematic isn't disturbed
  const inJourneyRunning =
    navigatorPhase === 'running' ||
    (domain === 'anime' && animeNavigatorPhase === 'running');
  return (
    <OrbitControls
      ref={controlsRef}
      enabled={status !== 'voyaging' && !transitioning && !inJourneyRunning}
      enableDamping
      dampingFactor={0.05}
      enablePan={false}
      enableZoom
      rotateSpeed={0.38}
      zoomSpeed={0.4}
      minDistance={0.15}
      maxDistance={620}
      minPolarAngle={Math.PI / 5}
      maxPolarAngle={Math.PI - Math.PI / 5}
      autoRotate={!inJourneyRunning}
      autoRotateSpeed={0.18}
    />
  );
}
