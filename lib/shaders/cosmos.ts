import { NOISE_GLSL } from './noise';

// Inverted sphere behind everything. A milky-way band tilted across the sky,
// procedural nebula clouds, and a sprinkling of faint background "specks".

export const nebulaVertex = /* glsl */ `
varying vec3 vPos;
void main(){
  vPos = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const nebulaFragment = /* glsl */ `
varying vec3 vPos;
uniform float uTime;

${NOISE_GLSL}

mat3 rotZ(float a){
  float c = cos(a);
  float s = sin(a);
  return mat3(c, -s, 0.0, s, c, 0.0, 0.0, 0.0, 1.0);
}

void main(){
  vec3 dir = normalize(vPos);
  vec3 r = rotZ(0.42) * dir;

  // Milky-way band hugs the rotated XZ plane.
  float bandY = r.y;
  float band = exp(-bandY * bandY * 10.0);

  // Multi-scale clouds.
  float n1 = fbm(dir * 2.2 + vec3(0.0, uTime * 0.004, 0.0));
  float n2 = fbm(dir * 5.4 + vec3(uTime * 0.003, 0.0, 0.0));
  float n3 = fbm(dir * 12.0);

  float cloud = smoothstep(0.05, 0.75, n1 * 0.6 + n2 * 0.4);

  vec3 deepSpace = vec3(0.005, 0.008, 0.018);
  vec3 violet = vec3(0.20, 0.10, 0.34);
  vec3 indigo = vec3(0.07, 0.14, 0.38);
  vec3 magenta = vec3(0.32, 0.08, 0.22);
  vec3 dustGold = vec3(0.28, 0.18, 0.10);

  vec3 col = deepSpace;
  col += violet * cloud * band * 0.55;
  col += indigo * smoothstep(0.15, 0.85, n2) * band * 0.45;
  col += magenta * smoothstep(0.55, 1.0, n1 * n2) * band * 0.32;
  col += dustGold * smoothstep(0.6, 1.0, n3) * band * 0.20;

  // Far-distance specks (very faint background stars).
  float specks = pow(smoothstep(0.78, 1.0, fbm(dir * 92.0)), 4.0);
  col += vec3(0.78, 0.85, 1.0) * specks * 0.55;

  // Vignette toward galactic poles to keep the band readable.
  float poleFade = 1.0 - smoothstep(0.55, 0.95, abs(bandY));
  col *= 0.7 + 0.6 * poleFade;

  gl_FragColor = vec4(col, 1.0);
}
`;

// Foreground starfield as additive points. The shader hands each star a
// twinkle phase derived from its own position so they breathe out of sync.

export const starVertex = /* glsl */ `
attribute float aSize;
attribute float aSeed;
attribute vec3 aColor;
varying vec3 vColor;
varying float vSize;
uniform float uTime;
uniform float uPixelRatio;

void main(){
  vColor = aColor;
  vSize = aSize;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  float twinkle = 0.55 + 0.45 * sin(uTime * 1.4 + aSeed * 6.28);
  gl_PointSize = aSize * twinkle * uPixelRatio * (320.0 / max(-mv.z, 1.0));
  gl_Position = projectionMatrix * mv;
}
`;

export const starFragment = /* glsl */ `
varying vec3 vColor;
varying float vSize;

void main(){
  vec2 d = gl_PointCoord - 0.5;
  float r = length(d);
  if (r > 0.5) discard;

  float core = pow(1.0 - smoothstep(0.0, 0.45, r), 2.6);

  // Cross flare only on bigger stars.
  float bigness = smoothstep(2.0, 3.5, vSize);
  float flareX = (1.0 - smoothstep(0.04, 0.5, abs(d.y))) * (1.0 - smoothstep(0.0, 0.5, abs(d.x)));
  float flareY = (1.0 - smoothstep(0.04, 0.5, abs(d.x))) * (1.0 - smoothstep(0.0, 0.5, abs(d.y)));
  float flare = max(flareX, flareY) * bigness * 0.55;

  float a = max(core, flare);
  gl_FragColor = vec4(vColor * a, a);
}
`;
