import { PLANET_VERTEX } from './noise';

// Texture-driven Mars — real surface map (continents, Valles Marineris,
// polar caps all live in the photograph).

export const marsVertex = PLANET_VERTEX;

export const marsFragment = /* glsl */ `
varying vec3 vObjPos;
varying vec3 vWorldPos;
varying vec3 vNormal;
varying vec2 vUv;

uniform float uTime;
uniform float uAmbient;
uniform sampler2D uMap;

void main(){
  vec3 base = texture2D(uMap, vUv).rgb;

  vec3 lightDir = normalize(-vWorldPos);
  float NdotL = dot(vNormal, lightDir);
  float terminator = smoothstep(-0.10, 0.30, NdotL);

  vec3 col = base * (terminator * (1.0 - uAmbient) + uAmbient);
  gl_FragColor = vec4(col, 1.0);
}
`;
