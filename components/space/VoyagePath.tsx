'use client';

import { Line } from '@react-three/drei';
import { useMemo } from 'react';
import * as THREE from 'three';

import { useSceneStore } from '@/lib/sceneStore';
import { buildVoyageCurve } from '@/lib/voyageCurve';

// Trajectory line.
//   - Active (during voyage): bright dashed
//   - Memorial (after arrival, while still observing destination): dimmer, calmer
//   - Hidden everywhere else
// The curve is rebuilt whenever from/to or scene-state changes — so as the
// user picks endpoints, the path previews update with current planet positions.

export function VoyagePath() {
  const { status, focused, voyageFrom, voyageTo, planets } = useSceneStore();

  const shouldShow = status === 'voyaging' || (focused !== null && focused === voyageTo);

  const points = useMemo(() => {
    if (!shouldShow || !voyageFrom || !voyageTo) return null;
    const from = planets.get(voyageFrom);
    const to = planets.get(voyageTo);
    if (!from?.ref.current || !to?.ref.current) return null;

    const fromPos = new THREE.Vector3();
    const toPos = new THREE.Vector3();
    from.ref.current.getWorldPosition(fromPos);
    to.ref.current.getWorldPosition(toPos);

    const curve = buildVoyageCurve(fromPos, toPos, from.approachDistance, to.approachDistance);
    return curve.getPoints(180);
  }, [shouldShow, voyageFrom, voyageTo, planets]);

  if (!shouldShow || !points) return null;

  const active = status === 'voyaging';

  return (
    <Line
      points={points}
      color={active ? '#9bb6ff' : '#7a8fc8'}
      lineWidth={active ? 1.4 : 1.0}
      transparent
      opacity={active ? 0.6 : 0.32}
      dashed
      dashScale={18}
      dashSize={2}
      gapSize={1.6}
    />
  );
}
