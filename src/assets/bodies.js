// Planet and moon: the bodies that accidents happen to.
import * as THREE from 'three';
import { mulberry32, createNoise3D, subsetFaces, glowSprite } from './common.js';

const C = (h) => new THREE.Color(h);

/**
 * A low-poly planet with three looks:
 *  'molten' – dark crust cracked open over glowing lava
 *  'crust'  – cooled grey-brown rock
 *  'ocean'  – oceans fill the low ground (amount 0..1)
 */
export function makePlanet({ radius = 3, seed = 7 } = {}) {
  const rnd = mulberry32(seed), n3 = createNoise3D(rnd), n3c = createNoise3D(rnd);
  const group = new THREE.Group();

  const base = new THREE.IcosahedronGeometry(radius, 5);
  const p = base.attributes.position, v = new THREE.Vector3();
  const fbm = (x, y, z) => { let f = 0, a = 1, s = 0, q = 1.1; for (let o = 0; o < 4; o++) { f += a * n3(x * q, y * q, z * q); s += a; a *= 0.5; q *= 2; } return f / s; };
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).divideScalar(radius);
    const e = fbm(v.x, v.y, v.z);
    v.multiplyScalar(radius * (1 + 0.06 * e));
    p.setXYZ(i, v.x, v.y, v.z);
  }
  base.computeVertexNormals();

  const faces = p.count / 3, elev = new Float32Array(faces), crack = new Uint8Array(faces), jit = new Float32Array(faces);
  for (let f = 0; f < faces; f++) {
    v.set(0, 0, 0);
    for (let k = 0; k < 3; k++) v.add(new THREE.Vector3().fromBufferAttribute(p, f * 3 + k));
    v.divideScalar(3);
    elev[f] = v.length() / radius - 1;
    v.normalize();
    crack[f] = Math.abs(n3c(v.x * 2.6, v.y * 2.6, v.z * 2.6)) < 0.11 ? 1 : 0; // ridged lines = lava cracks
    jit[f] = rnd();
  }
  const all = [...Array(faces).keys()];
  const crustAll = subsetFaces(base, all);
  const crustCracked = subsetFaces(base, all.filter((f) => !crack[f]));
  const crackedIdx = all.filter((f) => !crack[f]);
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95 });
  const solid = new THREE.Mesh(crustAll, mat), cracked = new THREE.Mesh(crustCracked, mat);
  const lava = new THREE.Mesh(new THREE.IcosahedronGeometry(radius * 0.995, 3), new THREE.MeshBasicMaterial({ color: '#ff6a1f', toneMapped: false }));
  const lavaGlow = glowSprite('#ff7a2a', radius * 3.4, 0.55);
  const ocean = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 4),
    new THREE.MeshStandardMaterial({ color: '#2a6f9e', flatShading: true, roughness: 0.65, transparent: true, opacity: 0.93 }));
  const air = glowSprite('#8cc8ff', radius * 3.0, 0);
  for (const o of [lava, lavaGlow, solid, cracked, ocean, air]) group.add(o);

  const paint = (geom, idx, colorOf) => {
    const col = geom.attributes.color.array, c = new THREE.Color();
    idx.forEach((f, k) => { colorOf(c, f); for (let j = 0; j < 3; j++) col.set([c.r, c.g, c.b], (k * 3 + j) * 3); });
    geom.attributes.color.needsUpdate = true;
  };
  const SEA = 0.0;
  let last = '';
  function setState(state, amount = 1) {
    const key = state + (state === 'ocean' ? amount.toFixed(2) : '');
    if (key === last) return;
    last = key;
    lava.visible = lavaGlow.visible = cracked.visible = state === 'molten';
    solid.visible = state !== 'molten';
    ocean.visible = state === 'ocean' && amount > 0;
    air.material.opacity = state === 'ocean' ? 0.35 * amount : state === 'crust' ? 0.08 : 0;
    if (state === 'molten') {
      const a = C('#3a3431'), b = C('#2b2624');
      paint(crustCracked, crackedIdx, (c, f) => c.lerpColors(a, b, jit[f]));
    } else {
      const lo = C('#7a6f63'), hi = C('#968a79'), sea = C('#55636c'), land = C('#8f7f62'), high = C('#a69a86');
      const level = -0.06 + (SEA + 0.06) * amount;
      paint(crustAll, all, (c, f) => {
        if (state === 'ocean' && elev[f] < level) c.copy(sea);
        else if (state === 'ocean') c.lerpColors(land, high, Math.min(1, (elev[f] - level) / 0.05));
        else c.lerpColors(lo, hi, Math.min(1, Math.max(0, elev[f] / 0.06 + 0.5)));
        c.multiplyScalar(0.92 + jit[f] * 0.16);
      });
      ocean.scale.setScalar(radius * (1 + level + 0.004));
    }
  }
  setState('molten');
  return { group, setState };
}

/** A grey, cratered low-poly moon. */
export function makeMoon({ radius = 0.8, seed = 3 } = {}) {
  const rnd = mulberry32(seed);
  const g = new THREE.IcosahedronGeometry(radius, 4);
  const p = g.attributes.position, v = new THREE.Vector3();
  const craters = Array.from({ length: 9 }, () => ({
    d: new THREE.Vector3(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1).normalize(),
    r: 0.22 + rnd() * 0.35, depth: 0.08 + rnd() * 0.08,
  }));
  const floor = new Float32Array(p.count);
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).normalize();
    let h = 0;
    for (const c of craters) {
      const ang = v.angleTo(c.d);
      if (ang < c.r) { h -= c.depth * (1 - (ang / c.r) ** 2); floor[i] = 1; }
      else if (ang < c.r * 1.35) h += c.depth * 0.35 * (1 - (ang - c.r) / (c.r * 0.35));
    }
    v.multiplyScalar(radius * (1 + h));
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  const col = new Float32Array(p.count * 3), light = C('#bdb9b3'), dark = C('#75716c'), c = new THREE.Color();
  for (let f = 0; f < p.count; f += 3) {
    c.copy(floor[f] + floor[f + 1] + floor[f + 2] >= 2 ? dark : light).multiplyScalar(0.92 + rnd() * 0.16);
    for (let k = 0; k < 3; k++) col.set([c.r, c.g, c.b], (f + k) * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 }));
}
