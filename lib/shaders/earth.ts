import { PLANET_VERTEX } from './noise';

// Earth surface — texture-driven (NASA Blue Marble derivatives):
//   uDayMap   — full-colour continents + oceans
//   uNightMap — city lights (mostly black with sparse glow)
//   uSpecMap  — ocean specular mask (bright where water)
// Sun lives at world origin, so the day/night terminator is computed in
// world space. uAmbient fills the dark side a little when the camera
// approaches the planet (set by the component on focus).

export const earthVertex = PLANET_VERTEX;

export const earthFragment = /* glsl */ `
varying vec3 vObjPos;
varying vec3 vWorldPos;
varying vec3 vNormal;
varying vec2 vUv;

uniform float uTime;
uniform float uAmbient;
uniform sampler2D uDayMap;
uniform sampler2D uNightMap;
uniform sampler2D uSpecMap;

void main(){
  vec3 dayCol = texture2D(uDayMap, vUv).rgb;
  vec3 nightCol = texture2D(uNightMap, vUv).rgb;
  float oceanMask = texture2D(uSpecMap, vUv).r;

  vec3 lightDir = normalize(-vWorldPos);
  float NdotL = dot(vNormal, lightDir);
  float terminator = smoothstep(-0.18, 0.30, NdotL);

  vec3 dayLit = dayCol * (terminator * (1.0 - uAmbient) + uAmbient);

  float nightSide = 1.0 - terminator;
  vec3 nightLit = nightCol * nightSide * 1.6;

  vec3 col = dayLit + nightLit;

  // Ocean specular highlight only where there is water and only on the lit side.
  vec3 viewDir = normalize(cameraPosition - vWorldPos);
  vec3 halfV = normalize(lightDir + viewDir);
  float specPower = pow(max(dot(vNormal, halfV), 0.0), 80.0);
  col += vec3(0.7, 0.85, 1.0) * specPower * oceanMask * smoothstep(0.0, 0.5, NdotL) * 0.8;

  gl_FragColor = vec4(col, 1.0);
}
`;

// Cloud layer — separate sphere, slightly larger, alpha-blended.
// Uses the same texture but offsets UV.x over time for a subtle wind drift.
export const cloudsFragment = /* glsl */ `
varying vec3 vObjPos;
varying vec3 vWorldPos;
varying vec3 vNormal;
varying vec2 vUv;

uniform float uTime;
uniform sampler2D uCloudsMap;

void main(){
  vec2 cuv = vec2(vUv.x + uTime * 0.0006, vUv.y);
  float cloudMask = texture2D(uCloudsMap, cuv).r;

  vec3 lightDir = normalize(-vWorldPos);
  float NdotL = dot(vNormal, lightDir);
  float lit = smoothstep(-0.10, 0.35, NdotL);

  vec3 col = vec3(1.0) * (lit * 0.95 + 0.05);
  float alpha = cloudMask * (lit * 0.9 + 0.1) * 0.92;
  gl_FragColor = vec4(col, alpha);
}
`;
