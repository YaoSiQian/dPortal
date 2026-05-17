import { NOISE_GLSL } from './noise';

// Sun: flowing plasma with limb brightening. Bloom in PostFX turns the
// emissive output into a real corona, so the shader stays compact.

export const sunVertex = /* glsl */ `
varying vec3 vObjPos;
varying vec3 vNormal;
varying vec3 vViewDir;

void main(){
  vObjPos = position;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vNormal = normalize(normalMatrix * normal);
  vViewDir = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}
`;

export const sunFragment = /* glsl */ `
varying vec3 vObjPos;
varying vec3 vNormal;
varying vec3 vViewDir;

uniform float uTime;
uniform vec3 uColorCore;
uniform vec3 uColorMid;
uniform vec3 uColorEdge;

${NOISE_GLSL}

void main(){
  vec3 p = normalize(vObjPos);

  // Layered plasma. Slow drift on top of a faster turbulent layer.
  float n1 = fbm(p * 2.4 + vec3(0.0, uTime * 0.13, uTime * 0.05));
  float n2 = fbm(p * 5.6 - vec3(uTime * 0.20, 0.0, 0.0));
  float n3 = fbm(p * 11.0 + vec3(uTime * 0.05, uTime * 0.04, 0.0));

  float h = n1 * 0.55 + n2 * 0.35 + n3 * 0.10;
  h = smoothstep(-0.5, 0.9, h);

  vec3 col = mix(uColorEdge, uColorMid, smoothstep(0.0, 0.55, h));
  col = mix(col, uColorCore, smoothstep(0.50, 0.95, h));

  // Limb brightening (the sun glows brighter at its rim before fading to corona).
  float fresnel = pow(1.0 - max(dot(vNormal, vViewDir), 0.0), 1.6);
  col += uColorEdge * fresnel * 1.4;

  // Slow breathing pulse, very subtle.
  col *= 1.0 + sin(uTime * 0.55) * 0.025;

  // Push it into the bloom threshold.
  col *= 1.35;

  gl_FragColor = vec4(col, 1.0);
}
`;

// Outer corona shell — additive shader rendered on a slightly larger sphere.
// Creates the soft volumetric glow around the disc.
export const coronaVertex = /* glsl */ `
varying vec3 vNormal;
varying vec3 vViewDir;

void main(){
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vNormal = normalize(normalMatrix * normal);
  vViewDir = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}
`;

export const coronaFragment = /* glsl */ `
varying vec3 vNormal;
varying vec3 vViewDir;

uniform vec3 uColor;
uniform float uPower;
uniform float uIntensity;

void main(){
  float f = pow(1.0 - max(dot(vNormal, vViewDir), 0.0), uPower);
  vec3 col = uColor * f * uIntensity;
  gl_FragColor = vec4(col, f);
}
`;
