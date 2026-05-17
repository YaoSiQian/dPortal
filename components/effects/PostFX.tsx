'use client';

import {
  EffectComposer,
  Bloom,
  Vignette,
  ChromaticAberration
} from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import { Vector2 } from 'three';

// Cinematic postprocessing chain:
//   - Bloom — turns the sun and bright star points into real glow
//   - ChromaticAberration — anamorphic lens hint
//   - Vignette — focuses the eye, sells the deep-space mood

export function PostFX() {
  return (
    <EffectComposer multisampling={0}>
      <Bloom
        intensity={1.15}
        luminanceThreshold={0.22}
        luminanceSmoothing={0.6}
        mipmapBlur
        radius={0.86}
      />
      <ChromaticAberration
        offset={new Vector2(0.00065, 0.00065)}
        radialModulation={false}
        modulationOffset={0}
        blendFunction={BlendFunction.NORMAL}
      />
      <Vignette eskil={false} offset={0.18} darkness={0.88} />
    </EffectComposer>
  );
}
