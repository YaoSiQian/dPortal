import * as THREE from 'three';

// Cinematic Earth–Mars-style flight path. Lifts above the orbital plane
// for a visible arc and sways sideways so it never tunnels through the sun.

export function buildVoyageCurve(
  from: THREE.Vector3,
  to: THREE.Vector3,
  fromApproach: number,
  toApproach: number
): THREE.CatmullRomCurve3 {
  const dir = new THREE.Vector3().subVectors(to, from);
  const distance = dir.length();
  const unitDir = distance > 0.0001 ? dir.clone().divideScalar(distance) : new THREE.Vector3(1, 0, 0);

  // Cap each offset so very short voyages still have curve room.
  const startOffset = Math.min(fromApproach, distance * 0.35);
  const endOffset = Math.min(toApproach, distance * 0.35);

  const startPoint = from.clone().addScaledVector(unitDir, startOffset);
  const endPoint = to.clone().addScaledVector(unitDir, -endOffset);

  const mid = new THREE.Vector3().lerpVectors(startPoint, endPoint, 0.5);
  // Lift the arc out of the orbital plane.
  mid.y += distance * 0.18;

  // Bias sideways perpendicular to the path, so the arc has shape even
  // when the two planets are close together vertically.
  const sidePerp = new THREE.Vector3()
    .crossVectors(unitDir, new THREE.Vector3(0, 1, 0))
    .normalize();
  if (sidePerp.lengthSq() < 0.001) sidePerp.set(1, 0, 0);
  mid.addScaledVector(sidePerp, distance * 0.08);

  const q1 = new THREE.Vector3().lerpVectors(startPoint, mid, 0.5);
  const q3 = new THREE.Vector3().lerpVectors(mid, endPoint, 0.5);

  return new THREE.CatmullRomCurve3([startPoint, q1, mid, q3, endPoint], false, 'centripetal');
}

// Duration scales with distance so short hops feel quick and long hauls
// keep a slow, deliberate pace.
export function voyageDuration(distance: number): number {
  return THREE.MathUtils.clamp((distance / 30) * 7.5, 4, 12);
}
