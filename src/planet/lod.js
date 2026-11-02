// Seamless planet level of detail: a cube-sphere where each of the 6 faces is a quadtree.
// Chunks near the camera split into 4 smaller, more detailed chunks; far ones merge back.
// Each chunk's vertices are stored relative to the chunk's centre, so precision holds
// even metres above the ground of an Earth-sized planet.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { R, EXAG } from './terrain.js';
import { mulberry32, hashString } from '../world.js';

const SEG = 16;           // grid cells per chunk side
const MIN_LEVEL = 2;      // always at least this detailed (96 chunks)
const MAX_LEVEL = 16;     // ~150 m chunks, ~10 m facets
const TREE_LEVEL = 14;    // trees appear on chunks this detailed (~600 m)
const SPLIT = 1.7;        // split when camera is closer than SPLIT × chunk size
const BUILD_BUDGET = 8;   // new chunks per frame

// Cube face (u, v in -1..1) -> point on the cube
function cubePoint(face, u, v, out) {
  switch (face) {
    case 0: return out.set(1, v, -u);
    case 1: return out.set(-1, v, u);
    case 2: return out.set(u, 1, -v);
    case 3: return out.set(u, -1, v);
    case 4: return out.set(u, v, 1);
    default: return out.set(-u, v, -1);
  }
}
// Cube -> sphere with evenly sized cells (spherified cube)
function toSphere(p) {
  const x2 = p.x * p.x, y2 = p.y * p.y, z2 = p.z * p.z;
  return p.set(
    p.x * Math.sqrt(1 - y2 / 2 - z2 / 2 + (y2 * z2) / 3),
    p.y * Math.sqrt(1 - z2 / 2 - x2 / 2 + (z2 * x2) / 3),
    p.z * Math.sqrt(1 - x2 / 2 - y2 / 2 + (x2 * y2) / 3),
  );
}
const dirAt = (face, u, v, out = new THREE.Vector3()) => toSphere(cubePoint(face, u, v, out));

// Shared tree shapes, in km (exaggerated a little so they read at ground level)
const pineGeo = mergeGeometries([
  new THREE.CylinderGeometry(0.0018, 0.0026, 0.012, 5).translate(0, 0.006, 0),
  new THREE.ConeGeometry(0.009, 0.024, 6).translate(0, 0.022, 0),
  new THREE.ConeGeometry(0.0065, 0.017, 6).translate(0, 0.033, 0),
]);
const roundGeo = mergeGeometries([
  new THREE.CylinderGeometry(0.0018, 0.0026, 0.014, 5).translate(0, 0.007, 0),
  new THREE.IcosahedronGeometry(0.011, 0).translate(0, 0.022, 0),
].map((g) => g.index ? g.toNonIndexed() : g));
const TREE_COL = {
  forest: ['#3f7d3c', '#4f8f45', '#5d9a4b'], jungle: ['#2f6e33', '#3b7a3a', '#467f36'],
  grass: ['#5f9e43', '#6aa84f'], savanna: ['#7f9a4a', '#8fa252'], tundra: ['#3f6b52', '#4a7458'],
};
const TREE_DENSITY = { forest: 1, jungle: 1, grass: 0.12, savanna: 0.06, tundra: 0.2 };
const PINE_BIOMES = new Set(['tundra', 'forest']);

export function makePlanetLOD(terrain, { seed = 1 } = {}) {
  const group = new THREE.Group();
  const landMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95, metalness: 0 });
  const waterMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.35, metalness: 0, transparent: true, opacity: 0.88 });
  const treeMat = new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.9 });
  const T = new THREE.Vector3(), N = new THREE.Vector3(), A = new THREE.Vector3(), B = new THREE.Vector3(), Cc = new THREE.Vector3();
  const col = new THREE.Color();
  let stats = { chunks: 0, built: 0, maxLevel: 0 };

  function makeNode(face, level, x0, y0, size) {
    const n = { face, level, x0, y0, size, children: null, obj: null };
    const d = dirAt(face, x0 + size / 2, y0 + size / 2);
    n.dir = d.clone().normalize();
    n.edge = size * (Math.PI / 4) * R;                     // approx chunk width, km
    n.centre = n.dir.clone().multiplyScalar(R + Math.max(0, terrain.elevation(n.dir.x, n.dir.y, n.dir.z, 2)) * EXAG);
    return n;
  }

  function build(n) {
    const detail = Math.min(12, Math.max(3, n.level - 1));
    const V = SEG + 1, pos = new Float64Array(V * V * 3), elev = new Float64Array(V * V), dirs = new Float64Array(V * V * 3);
    let minE = Infinity;
    for (let j = 0; j < V; j++) for (let i = 0; i < V; i++) {
      const k = j * V + i;
      dirAt(n.face, n.x0 + (n.size * i) / SEG, n.y0 + (n.size * j) / SEG, T).normalize();
      const e = terrain.elevation(T.x, T.y, T.z, detail);
      elev[k] = e; minE = Math.min(minE, e);
      dirs.set([T.x, T.y, T.z], k * 3);
      const r = R + e * EXAG;
      pos.set([T.x * r, T.y * r, T.z * r], k * 3);
    }
    const c = n.centre, land = [], landCol = [], water = [], waterCol = [];
    const rnd = mulberry32(hashString(`${n.face}/${n.level}/${n.x0}/${n.y0}`));
    const P = (k, o) => o.set(pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2]);

    const pushTri = (arr, a, b, cc) => {
      // keep triangles facing outward
      N.subVectors(b, a).cross(T.subVectors(cc, a));
      if (N.dot(a) < 0) { const t = b; b = cc; cc = t; }
      for (const p of [a, b, cc]) arr.push(p.x - c.x, p.y - c.y, p.z - c.z);
    };
    const tri = (ka, kb, kc) => {
      P(ka, A); P(kb, B); P(kc, Cc);
      const e = (elev[ka] + elev[kb] + elev[kc]) / 3;
      const mx = (dirs[ka * 3] + dirs[kb * 3] + dirs[kc * 3]) / 3, my = (dirs[ka * 3 + 1] + dirs[kb * 3 + 1] + dirs[kc * 3 + 1]) / 3, mz = (dirs[ka * 3 + 2] + dirs[kb * 3 + 2] + dirs[kc * 3 + 2]) / 3;
      N.subVectors(B, A).cross(T.subVectors(Cc, A)).normalize();
      const up = Math.abs(N.x * mx + N.y * my + N.z * mz) / Math.hypot(mx, my, mz);
      terrain.colorOf(col, terrain.biome(mx, my, mz, e, up), e, rnd());
      pushTri(land, A.clone(), B.clone(), Cc.clone());
      for (let q = 0; q < 3; q++) landCol.push(col.r, col.g, col.b);
      if (Math.min(elev[ka], elev[kb], elev[kc]) < 0.02) {
        // sea surface at radius R, coloured by depth
        const depth = -e, s = R;
        const a = new THREE.Vector3(dirs[ka * 3], dirs[ka * 3 + 1], dirs[ka * 3 + 2]).multiplyScalar(s);
        const b = new THREE.Vector3(dirs[kb * 3], dirs[kb * 3 + 1], dirs[kb * 3 + 2]).multiplyScalar(s);
        const d = new THREE.Vector3(dirs[kc * 3], dirs[kc * 3 + 1], dirs[kc * 3 + 2]).multiplyScalar(s);
        pushTri(water, a, b, d);
        if (depth < 0.03) col.set('#bfeee4');
        else if (depth < 0.6) col.set('#3fb0bf').lerp(new THREE.Color('#8be3d2'), 1 - depth / 0.6);
        else col.set('#1d5f8f').lerp(new THREE.Color('#123f6b'), Math.min(1, (depth - 0.6) / 4));
        for (let q = 0; q < 3; q++) waterCol.push(col.r, col.g, col.b);
      }
    };
    for (let j = 0; j < SEG; j++) for (let i = 0; i < SEG; i++) {
      const a = j * V + i, b = a + 1, d = a + V, e = d + 1;
      if ((i + j) % 2) { tri(a, d, b); tri(b, d, e); } else { tri(a, d, e); tri(a, e, b); }
    }
    // Skirts: short walls along the edges that hide cracks between chunks of different detail
    const skirt = Math.max(0.05, n.edge * 0.03);
    const edges = [];
    for (let i = 0; i < SEG; i++) edges.push([i, i + 1], [SEG * V + i, SEG * V + i + 1], [i * V, (i + 1) * V], [i * V + SEG, (i + 1) * V + SEG]);
    for (const [ka, kb] of edges) {
      P(ka, A); P(kb, B);
      const a2 = A.clone().addScaledVector(new THREE.Vector3(dirs[ka * 3], dirs[ka * 3 + 1], dirs[ka * 3 + 2]), -skirt);
      const b2 = B.clone().addScaledVector(new THREE.Vector3(dirs[kb * 3], dirs[kb * 3 + 1], dirs[kb * 3 + 2]), -skirt);
      for (const [p, q, r] of [[A.clone(), B.clone(), b2], [A.clone(), b2, a2]]) {
        for (const v of [p, q, r]) land.push(v.x - c.x, v.y - c.y, v.z - c.z);
        terrain.colorOf(col, 'rock', 0, 0.3);
        for (let s = 0; s < 3; s++) landCol.push(col.r, col.g, col.b);
      }
    }

    const obj = new THREE.Group();
    obj.position.copy(c);
    const mk = (arr, cols, mat) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
      g.computeVertexNormals();
      g.computeBoundingSphere();
      return new THREE.Mesh(g, mat);
    };
    obj.add(mk(land, landCol, landMat));
    if (water.length) obj.add(mk(water, waterCol, waterMat));
    if (n.level >= TREE_LEVEL) addTrees(n, obj, rnd, detail);
    n.obj = obj;
    stats.built++;
  }

  function addTrees(n, obj, rnd, detail) {
    const pines = [], rounds = [], M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
    // Same trees per km² at every level: each level down covers a quarter of the area.
    const tries = Math.round(260 / 4 ** (n.level - TREE_LEVEL));
    for (let k = 0; k < tries; k++) {
      const u = n.x0 + rnd() * n.size, v = n.y0 + rnd() * n.size;
      dirAt(n.face, u, v, T).normalize();
      const e = terrain.elevation(T.x, T.y, T.z, detail);
      if (e < 0.03) continue;
      const b = terrain.biome(T.x, T.y, T.z, e, 1);
      if (!(rnd() < (TREE_DENSITY[b] ?? 0))) continue;
      Q.setFromUnitVectors(Y, T);
      A.copy(T).multiplyScalar(R + e * EXAG - 0.002).sub(n.centre);
      S.setScalar(0.7 + rnd() * 0.7);
      const list = PINE_BIOMES.has(b) && (b === 'tundra' || rnd() < 0.5) ? pines : rounds;
      const shades = TREE_COL[b];
      list.push({ m: M.compose(A, Q, S).clone(), c: new THREE.Color(shades[(rnd() * shades.length) | 0]) });
    }
    for (const [list, geo] of [[pines, pineGeo], [rounds, roundGeo]]) {
      if (!list.length) continue;
      const im = new THREE.InstancedMesh(geo, treeMat, list.length);
      list.forEach((t, i) => { im.setMatrixAt(i, t.m); im.setColorAt(i, t.c); });
      im.computeBoundingSphere();
      obj.add(im);
    }
  }

  function dispose(n) {
    if (n.obj) {
      n.obj.traverse((o) => { if (o.geometry && o.geometry !== pineGeo && o.geometry !== roundGeo) o.geometry.dispose(); if (o.isInstancedMesh) o.dispose(); });
      group.remove(n.obj);
      n.obj = null;
    }
    if (n.children) { n.children.forEach(dispose); n.children = null; }
  }
  const hideTree = (n) => { if (n.obj) n.obj.visible = false; n.children?.forEach(hideTree); };
  const show = (n) => { if (!n.obj.parent) group.add(n.obj); n.obj.visible = true; stats.chunks++; stats.maxLevel = Math.max(stats.maxLevel, n.level); };

  // Roots: each face pre-split to MIN_LEVEL
  const roots = [];
  for (let f = 0; f < 6; f++) {
    const k = 2 ** MIN_LEVEL, s = 2 / k;
    for (let j = 0; j < k; j++) for (let i = 0; i < k; i++) {
      const n = makeNode(f, MIN_LEVEL, -1 + i * s, -1 + j * s, s);
      build(n);
      roots.push(n);
    }
  }

  let budget = 0;
  const camDir = new THREE.Vector3();
  function visit(n, cam, camDist, horizon) {
    // Beyond the horizon: nothing to draw
    const ang = Math.acos(Math.max(-1, Math.min(1, n.dir.dot(camDir))));
    if (ang > horizon + (n.edge / R) * 0.8 + 0.1) { hideTree(n); return; }
    const near = cam.distanceTo(n.centre) < n.edge * SPLIT;
    if (near && n.level < MAX_LEVEL) {
      if (!n.children) {
        const h = n.size / 2;
        n.children = [[0, 0], [1, 0], [0, 1], [1, 1]].map(([a, b]) => makeNode(n.face, n.level + 1, n.x0 + a * h, n.y0 + b * h, h));
      }
      for (const ch of n.children) if (!ch.obj && budget > 0) { build(ch); budget--; }
      if (n.children.every((ch) => ch.obj)) {
        if (n.obj) n.obj.visible = false;
        for (const ch of n.children) visit(ch, cam, camDist, horizon);
        return;
      }
      n.children.forEach(hideTree); // children not ready yet: keep showing this chunk
    } else if (n.children) {
      n.children.forEach(dispose);
      n.children = null;
    }
    if (!n.obj) build(n);
    show(n);
  }

  function update(cam) {
    budget = BUILD_BUDGET;
    stats.chunks = 0; stats.maxLevel = 0;
    const camDist = cam.length();
    camDir.copy(cam).normalize();
    const horizon = camDist > R ? Math.acos(R / camDist) : 0.05;
    for (const n of roots) visit(n, cam, camDist, horizon);
    return stats;
  }

  return { group, update, stats: () => stats };
}
