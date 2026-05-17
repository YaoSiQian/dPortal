import { PLANET_VERTEX } from './noise';

// Texture-driven Moon — Apollo / LRO derived surface with maria.

export const moonVertex = PLANET_VERTEX;

export const moonFragment = /* glsl */ `
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
  float terminator = smoothstep(-0.12, 0.28, NdotL);

  vec3 col = base * (terminator * (1.0 - uAmbient) + uAmbient);
  gl_FragColor = vec4(col, 1.0);
}
`;
