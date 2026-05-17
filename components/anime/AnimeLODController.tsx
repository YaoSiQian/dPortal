'use client';

import { createContext, useContext, useRef, useState, type ReactNode } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

import { useSceneStore } from '@/lib/sceneStore';
import { pickLod, type LodLevel } from '@/lib/anime/cluster';

const LodCtx = createContext<LodLevel>('far');
export const useAnimeLod = () => useContext(LodCtx);

export function AnimeLODController({ children }: { children: ReactNode }) {
  const { planets } = useSceneStore();
  const { camera } = useThree();
  const [lod, setLod] = useState<LodLevel>('far');
  const scratch = useRef(new THREE.Vector3());

  useFrame(() => {
    const earth = planets.get('earth');
    if (!earth?.ref.current) return;
    earth.ref.current.getWorldPosition(scratch.current);
    const d = camera.position.distanceTo(scratch.current);
    const next = pickLod(d);
    if (next !== lod) setLod(next);
  });

  return <LodCtx.Provider value={lod}>{children}</LodCtx.Provider>;
}
