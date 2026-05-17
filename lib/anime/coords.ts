// lib/anime/coords.ts
// Lat/lng → Earth surface XYZ in scene units. Earth's display radius
// is hard-coded at 1.7 in components/planets/Earth.tsx; we accept it
// as a parameter to keep this pure.

import * as THREE from 'three';

/**
 * Map (lat, lng) on a unit sphere of `radius` to scene-local XYZ.
 *
 * Convention chosen to match three.js's Y-up coordinate system AND
 * the existing earth shader (which uses uv from a standard
 * SphereGeometry). lng = 0 lands on +X, lng = 90 on +Z, north pole on
 * +Y. The inset ε avoids landmarks z-fighting with the cloud shell.
 */
export function latLngToEarthSurface(
  lat: number,
  lng: number,
  radius: number,
  surfaceInset = 0.001
): THREE.Vector3 {
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = ((lng + 180) * Math.PI) / 180;
  const r = radius + surfaceInset;
  const x = -r * Math.sin(phi) * Math.cos(theta);
  const y = r * Math.cos(phi);
  const z = r * Math.sin(phi) * Math.sin(theta);
  return new THREE.Vector3(x, y, z);
}

/** Outward-pointing surface normal at (lat, lng). Used to orient
 *  marker / poster planes so they sit flush with the surface. */
export function latLngNormal(lat: number, lng: number): THREE.Vector3 {
  return latLngToEarthSurface(lat, lng, 1, 0).normalize();
}
