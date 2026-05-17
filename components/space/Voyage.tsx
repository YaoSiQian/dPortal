'use client';

import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import gsap from 'gsap';

import { useSceneStore } from '@/lib/sceneStore';
import { buildVoyageCurve, voyageDuration } from '@/lib/voyageCurve';
import { Ship } from './Ship';

// Third-person SIDE-tracking voyage:
//  - Ship glides along the Catmull-Rom curve, oriented along its tangent.
//  - Camera tracks the ship from its right-hand side (`tangent × worldUp`),
//    lifted slightly so we see the dorsal silhouette. Classic lateral
//    tracking shot — what Interstellar / NASA hero shots use.
//  - The look target sits on the ship most of the trip, then drifts onto
//    the destination planet in the final 22% for a clean arrival reveal.
//  - On complete: hands camera back to <CameraRig />.

const TRACK_DISTANCE = 8;
const TRACK_HEIGHT = 2.2;
const WORLD_UP = new THREE.Vector3(0, 1, 0);

export function Voyage() {
  const { camera } = useThree();
  const { status, voyageFrom, voyageTo, planets, controlsRef, completeVoyage } = useSceneStore();

  const shipRef = useRef<THREE.Group>(null);
  const curveRef = useRef<THREE.CatmullRomCurve3 | null>(null);
  const tweenRef = useRef<gsap.core.Tween | null>(null);
  const progress = useRef({ value: 0 });
  // Scale track distance with voyage length so short hops still frame the ship.
  const trackScale = useRef(1);

  const shipPos = useRef(new THREE.Vector3());
  const tangent = useRef(new THREE.Vector3());
  const sideDir = useRef(new THREE.Vector3());
  const orientHelper = useRef(new THREE.Vector3());
  const camTarget = useRef(new THREE.Vector3());
  const lookTarget = useRef(new THREE.Vector3());
  const lookSmoothed = useRef(new THREE.Vector3());
  const destPos = useRef(new THREE.Vector3());

  useEffect(() => {
    if (status !== 'voyaging' || !voyageFrom || !voyageTo) return;
    const from = planets.get(voyageFrom);
    const to = planets.get(voyageTo);
    if (!from?.ref.current || !to?.ref.current) return;

    const fromPos = new THREE.Vector3();
    const toPos = new THREE.Vector3();
    from.ref.current.getWorldPosition(fromPos);
    to.ref.current.getWorldPosition(toPos);

    curveRef.current = buildVoyageCurve(fromPos, toPos, from.approachDistance, to.approachDistance);
    progress.current.value = 0;

    const distance = fromPos.distanceTo(toPos);
    const duration = voyageDuration(distance);
    trackScale.current = THREE.MathUtils.clamp(distance / 30, 0.35, 1);

    // Snap ship + camera onto the start of the curve so the first frame
    // doesn't show the ship blipping in from elsewhere.
    curveRef.current.getPointAt(0, shipPos.current);
    curveRef.current.getTangent(0, tangent.current).normalize();

    sideDir.current.crossVectors(tangent.current, WORLD_UP);
    if (sideDir.current.lengthSq() < 0.01) sideDir.current.set(1, 0, 0);
    sideDir.current.normalize();

    if (shipRef.current) {
      shipRef.current.position.copy(shipPos.current);
      orientHelper.current.copy(shipPos.current).add(tangent.current);
      shipRef.current.lookAt(orientHelper.current);
    }

    camTarget.current
      .copy(shipPos.current)
      .addScaledVector(sideDir.current, TRACK_DISTANCE * trackScale.current);
    camTarget.current.y += TRACK_HEIGHT * trackScale.current;
    camera.position.copy(camTarget.current);
    lookSmoothed.current.copy(shipPos.current);
    camera.lookAt(lookSmoothed.current);

    tweenRef.current = gsap.to(progress.current, {
      value: 1,
      duration,
      ease: 'power2.inOut',
      onComplete: () => {
        const dest = planets.get(voyageTo);
        if (dest?.ref.current && controlsRef.current) {
          dest.ref.current.getWorldPosition(controlsRef.current.target);
        }
        completeVoyage();
      }
    });

    return () => {
      tweenRef.current?.kill();
      tweenRef.current = null;
    };
  }, [status, voyageFrom, voyageTo, planets, controlsRef, completeVoyage, camera]);

  useFrame((_, dt) => {
    if (status !== 'voyaging' || !curveRef.current || !voyageTo) return;
    const curve = curveRef.current;
    const t = progress.current.value;

    curve.getPointAt(t, shipPos.current);
    curve.getTangent(t, tangent.current).normalize();

    sideDir.current.crossVectors(tangent.current, WORLD_UP);
    if (sideDir.current.lengthSq() < 0.01) sideDir.current.set(1, 0, 0);
    sideDir.current.normalize();

    if (shipRef.current) {
      shipRef.current.position.copy(shipPos.current);
      orientHelper.current.copy(shipPos.current).add(tangent.current);
      shipRef.current.lookAt(orientHelper.current);
    }

    // Lateral tracking shot: camera stays on the ship's right-hand side,
    // lifted slightly for a 3/4 dorsal view.
    camTarget.current
      .copy(shipPos.current)
      .addScaledVector(sideDir.current, TRACK_DISTANCE * trackScale.current);
    camTarget.current.y += TRACK_HEIGHT * trackScale.current;

    const posSmooth = 1 - Math.pow(0.001, dt * 2.0);
    camera.position.lerp(camTarget.current, posSmooth);

    lookTarget.current.copy(shipPos.current);
    if (t > 0.78) {
      const dest = planets.get(voyageTo);
      if (dest?.ref.current) {
        dest.ref.current.getWorldPosition(destPos.current);
        const blend = THREE.MathUtils.smoothstep(t, 0.78, 1.0);
        lookTarget.current.lerp(destPos.current, blend);
      }
    }

    const lookSmooth = 1 - Math.pow(0.001, dt * 3.0);
    lookSmoothed.current.lerp(lookTarget.current, lookSmooth);
    camera.lookAt(lookSmoothed.current);
  });

  return (
    <group ref={shipRef} visible={status === 'voyaging'}>
      <Ship />
    </group>
  );
}
