// Planet surface: elevation, moisture and biome colour for any point on the sphere.
// Units are kilometres. Points are unit vectors (direction from the planet's centre).
//
// For now land comes from noise. Later it will come from the simulation
// (plates, volcanoes, erosion); this module is where that will plug in.
import * as THREE from 'three';
import { createNoise3D } from 'simplex-noise';
import { mulberry32, smoothstep } from '../world.js';

export const R = 6371;   // planet radius, km (Earth-sized)
export const EXAG = 8;   // vertical exaggeration so relief reads from orbit

// lat/lon (radians) <-> unit vector. North pole = +y. Longitude increases eastward.
export function dirOf(lat, lon, out = new THREE.Vector3()) {
  return out.set(Math.cos(lat) * Math.cos(lon), Math.sin(lat), -Math.cos(lat) * Math.sin(lon));
}
export function latLonOf(v) {
  const l = v.length();
  return { lat: Math.asin(v.y / l), lon: Math.atan2(-v.z, v.x) };
}

export function makeTerrain(seed) {
  const rnd = mulberry32(seed);
  const nW = createNoise3D(rnd), nC = createNoise3D(rnd), nR = createNoise3D(rnd);
  const nD = createNoise3D(rnd), nM = createNoise3D(rnd);
  const seaBias = (rnd() - 0.5) * 0.28; // how much of this world is land

  function fbm(n, x, y, z, oct, f) {
    let s = 0, a = 1, norm = 0;
    for (let i = 0; i < oct; i++) { s += a * n(x * f, y * f, z * f); norm += a; a *= 0.5; f *= 2; }
    return s / norm;
  }
  function ridged(n, x, y, z, oct, f) {
    let s = 0, a = 1, norm = 0;
    for (let i = 0; i < oct; i++) { const r = 1 - Math.abs(n(x * f, y * f, z * f)); s += a * r * r; norm += a; a *= 0.5; f *= 2; }
    return s / norm;
  }

  /** Elevation in km above sea level. `detail` = extra octaves (more when zoomed in). */
  function elevation(x, y, z, detail = 4) {
    const w = 0.35;
    const wx = x + w * nW(x * 1.3, y * 1.3, z * 1.3);
    const wy = y + w * nW(y * 1.3 + 5.2, z * 1.3, x * 1.3);
    const wz = z + w * nW(z * 1.3 + 9.1, x * 1.3, y * 1.3);
    const c = fbm(nC, wx, wy, wz, 5, 1.0) + seaBias;               // continents
    const land = smoothstep(-0.02, 0.3, c);
    let e = c < 0 ? c * 9 : c * 2.0;                                // ocean depth / lowland height
    e += ridged(nR, wx, wy, wz, 4, 2.2) ** 2 * land * 5.5;          // mountain ranges
    if (detail > 0) e += fbm(nD, x, y, z, detail, 24) * (0.15 + 0.6 * land); // hills, down to metres
    return e;
  }
  const moisture = (x, y, z) => fbm(nM, x, y, z, 3, 2.0);

  // Biome colours (same palette family as the diorama island).
  const P = {
    sand: new THREE.Color('#e9d39b'), seabed: new THREE.Color('#c9b27c'), deepbed: new THREE.Color('#5d6f78'),
    grass: new THREE.Color('#7fbf5a'), forest: new THREE.Color('#4f8f45'), jungle: new THREE.Color('#3b7a3a'),
    savanna: new THREE.Color('#b8ae5e'), desert: new THREE.Color('#dcb878'), tundra: new THREE.Color('#9a9b7c'),
    snow: new THREE.Color('#f3f6fa'), rock: new THREE.Color('#8f8a84'), rockDark: new THREE.Color('#726d68'),
  };

  /** Temperature 0 (polar) .. 1 (tropical), falling with latitude and height. */
  const temperature = (y, e) => 1 - Math.abs(y) * 1.1 - Math.max(0, e) * 0.09;

  /** Biome name at a point. `up` = how level the ground is (1 flat, lower = steep). */
  function biome(x, y, z, e, up) {
    if (e < 0) return 'sea';
    const t = temperature(y, e), m = moisture(x, y, z);
    if (up < 0.82) return 'rock';
    if (t < 0.12 || e > 4.3) return 'snow';
    if (e < 0.04) return t > 0.25 ? 'sand' : 'rock';
    if (t < 0.3) return 'tundra';
    if (m < -0.22 && t > 0.5) return 'desert';
    if (m < 0) return t > 0.55 ? 'savanna' : 'grass';
    if (m > 0.22) return t > 0.7 ? 'jungle' : 'forest';
    return 'grass';
  }

  function colorOf(out, b, e, jitter) {
    if (b === 'sea') return out.lerpColors(P.seabed, P.deepbed, Math.min(1, -e / 3));
    if (b === 'rock') out.copy(jitter > 0.5 ? P.rock : P.rockDark);
    else out.copy(P[b]);
    return out.multiplyScalar(0.92 + jitter * 0.16); // per-facet jitter: the low-poly look
  }

  return { elevation, moisture, biome, colorOf, temperature, seaBias };
}
