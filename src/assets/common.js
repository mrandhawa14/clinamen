// Shared building blocks for procedural assets.
// Every asset returns { object, update(t, time) }: t is the event's progress 0..1,
// time is seconds for idle motion (flicker, drift).
import * as THREE from 'three';
import { createNoise3D } from 'simplex-noise';
import { mulberry32, smoothstep, clamp01 } from '../world.js';

export { mulberry32, smoothstep, clamp01, createNoise3D };

/** Progress of t through the span a..b, clamped to 0..1. */
export const phase = (t, a, b) => clamp01((t - a) / (b - a));
export const easeOut = (x) => 1 - (1 - x) ** 3;
export const easeIn = (x) => x * x * x;

// --- Textures -------------------------------------------------------------------
const texCache = new Map();
export function glowTexture(stops = [[0, 'rgba(255,255,255,1)'], [0.2, 'rgba(255,255,255,0.55)'], [1, 'rgba(255,255,255,0)']], size = 128) {
  const key = JSON.stringify(stops) + size;
  if (texCache.has(key)) return texCache.get(key);
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [o, col] of stops) gr.addColorStop(o, col);
  g.fillStyle = gr;
  g.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  texCache.set(key, tex);
  return tex;
}
export const softDot = () => glowTexture([[0, 'rgba(255,255,255,1)'], [0.35, 'rgba(255,255,255,0.6)'], [1, 'rgba(255,255,255,0)']], 64);
export const puffDot = () => glowTexture([[0, 'rgba(255,255,255,0.9)'], [0.6, 'rgba(255,255,255,0.35)'], [1, 'rgba(255,255,255,0)']], 64);

export function glowSprite(color, scale, opacity = 1) {
  const m = new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity, toneMapped: false });
  const s = new THREE.Sprite(m);
  s.scale.setScalar(scale);
  return s;
}

// --- Particles ------------------------------------------------------------------
/** A Points cloud whose positions (and optional colours) the asset writes every update. */
export function makeParticles(n, { size = 0.2, color = '#ffffff', additive = true, opacity = 1, vertexColors = false, map = softDot() } = {}) {
  const geom = new THREE.BufferGeometry();
  const pos = new Float32Array(n * 3);
  geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  let col = null;
  if (vertexColors) { col = new Float32Array(n * 3); geom.setAttribute('color', new THREE.BufferAttribute(col, 3)); }
  const mat = new THREE.PointsMaterial({
    size, map, color, transparent: true, opacity, depthWrite: false, vertexColors,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, sizeAttenuation: true, toneMapped: !additive,
  });
  const points = new THREE.Points(geom, mat);
  points.frustumCulled = false;
  return {
    points, pos, col, mat,
    set(i, x, y, z) { pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z; },
    color(i, c, k = 1) { col[i * 3] = c.r * k; col[i * 3 + 1] = c.g * k; col[i * 3 + 2] = c.b * k; },
    commit() { geom.attributes.position.needsUpdate = true; if (col) geom.attributes.color.needsUpdate = true; },
  };
}

// --- Low-poly solids -------------------------------------------------------------
/** A lumpy low-poly rock (asteroid, impactor, comet nucleus). */
export function makeRock(radius, seed, colors = ['#6f6a64', '#57524d'], { detail = 1, rough = 0.25 } = {}) {
  const rnd = mulberry32(seed), n3 = createNoise3D(rnd);
  const g = new THREE.IcosahedronGeometry(radius, detail); // non-indexed: faceted
  const p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    v.multiplyScalar(1 + rough * n3((v.x * 1.7) / radius, (v.y * 1.7) / radius, (v.z * 1.7) / radius));
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  const cols = colors.map((c) => new THREE.Color(c)), ca = new Float32Array(p.count * 3);
  for (let f = 0; f < p.count; f += 3) {
    const c = cols[(rnd() * cols.length) | 0];
    for (let k = 0; k < 3; k++) ca.set([c.r, c.g, c.b], (f + k) * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(ca, 3));
  return new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95 }));
}

/** Copy chosen faces of a non-indexed geometry into a new geometry. */
export function subsetFaces(geom, faces) {
  const src = geom.attributes.position.array, out = new Float32Array(faces.length * 9);
  faces.forEach((f, k) => out.set(src.subarray(f * 9, f * 9 + 9), k * 9));
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(out, 3));
  g.computeVertexNormals();
  g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(out.length), 3));
  return g;
}

// --- Physics-based colour ----------------------------------------------------------
/** Colour of a black body at temperature K (Tanner Helland's fit). Stars' real colours. */
export function kelvinToColor(K) {
  const t = K / 100;
  let r, g, b;
  if (t <= 66) {
    r = 255;
    g = 99.4708025861 * Math.log(t) - 161.1195681661;
    b = t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  } else {
    r = 329.698727446 * Math.pow(t - 60, -0.1332047592);
    g = 288.1221695283 * Math.pow(t - 60, -0.0755148492);
    b = 255;
  }
  const c = (x) => Math.min(255, Math.max(0, x)) / 255;
  return new THREE.Color().setRGB(c(r), c(g), c(b), THREE.SRGBColorSpace);
}

/** Emission-line colours of glowing gas, by element (real wavelengths). */
export const EMISSION = {
  H: '#ff4f6d',   // hydrogen-alpha, 656 nm: the red of star-forming clouds
  He: '#ffe39a',  // helium I, 588 nm: yellow
  O: '#39d5c4',   // oxygen III, 501 nm: teal-green
  S: '#ff7a3a',   // sulfur II, 672 nm: deep red, shown warmer to tell it from hydrogen
};
