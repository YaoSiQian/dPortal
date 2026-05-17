import { NOISE_GLSL } from './noise';

// Saturn ring system. Flat ring disc shader with radial banding, Cassini gap,
// soft inner/outer fades, and a cast shadow from the planet body so the rings
// dim where the planet eclipses the sun.

export const ringVertex = /* glsl */ `
varying vec3 vObjPos;
varying vec3 vWorldPos;

void main(){
  vObjPos = position;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

export const ringFragment = /* glsl */ `
varying vec3 vObjPos;
varying vec3 vWorldPos;

uniform float uInnerRadius;
uniform float uOuterRadius;
uniform vec3 uPlanetPos;
uniform float uPlanetRadius;

${NOISE_GLSL}

void main(){
  float radius = length(vObjPos.xy);
  float t = (radius - uInnerRadius) / (uOuterRadius - uInnerRadius);
  if (t < 0.0 || t > 1.0) discard;

  // Coarse and fine band structure layered together.
  float fine = sin(radius * 78.0) * 0.5 + 0.5;
  fine = pow(fine, 0.6);
  float mid = sin(radius * 14.0 + 1.2) * 0.5 + 0.5;
  mid = pow(mid, 1.5);
  float noiseBand = fbm3(vec3(radius * 3.5, 0.0, 0.0)) * 0.5 + 0.5;

  // Cassini Division.
  float cassini = smoothstep(0.44, 0.48, t) * (1.0 - smoothstep(0.49, 0.53, t));

  // Encke gap (thinner, further out).
  float encke = smoothstep(0.78, 0.80, t) * (1.0 - smoothstep(0.805, 0.825, t));

  float innerFade = smoothstep(0.0, 0.06, t);
  float outerFade = 1.0 - smoothstep(0.92, 1.0, t);

  float density = mix(fine, mid, 0.55);
  density = mix(density, noiseBand, 0.35);
  density *= 1.0 - cassini * 0.95;
  density *= 1.0 - encke * 0.85;
  density *= innerFade * outerFade;

  vec3 cool = vec3(0.78, 0.66, 0.48);
  vec3 warm = vec3(0.96, 0.86, 0.66);
  vec3 col = mix(cool, warm, density);

  // Planet shadow on the rings. Cast a "soft cylinder" from the planet
  // opposite the sun. Sun lives at world origin.
  vec3 toSun = -vWorldPos;
  float toSunLen = length(toSun);
  vec3 sunDir = toSun / max(toSunLen, 0.0001);
  vec3 toPlanet = uPlanetPos - vWorldPos;
  float tProj = dot(toPlanet, sunDir);
  vec3 closest = vWorldPos + sunDir * tProj;
  float perpDist = length(closest - uPlanetPos);
  float behindPlanet = step(0.0, tProj);
  float shadow = behindPlanet * (1.0 - smoothstep(uPlanetRadius * 0.85, uPlanetRadius * 1.18, perpDist));

  col *= 1.0 - shadow * 0.72;

  float alpha = density * 0.82;
  gl_FragColor = vec4(col, alpha);
}
`;
