// Generic atmosphere rim. Front-face sphere slightly larger than the planet,
// additive blending, fresnel-driven alpha. Looks like a thin glowing limb
// when seen from the side, like the iconic blue ring around Earth.

export const atmosphereVertex = /* glsl */ `
varying vec3 vNormal;
varying vec3 vViewDir;

void main(){
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vNormal = normalize(normalMatrix * normal);
  vViewDir = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}
`;

export const atmosphereFragment = /* glsl */ `
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
