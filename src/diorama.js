// Builds the diorama meshes and shows the world state on them:
// terrain, sea (level comes from the world's water), trees (growth from the world), clouds.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { R, BASE_DEPTH, mulberry32, clamp01, smoothstep } from './world.js';

const C = (hex) => new THREE.Color(hex);
const PAL = {
  sand: C('#e9d39b'), seabed: C('#cdb47d'), rock: C('#8f8a84'), rockDark: C('#726d68'),
  dirt: C('#a08a6a'), dirtDark: C('#8a755a'), dryBed: C('#b9a27a'),
  alpine: C('#9c9b7c'), snow: C('#f3f6fa'),
  grass: [C('#93cf6a'), C('#6aa84f'), C('#a9a052'), C('#7f8f66')],
  leaf: [C('#a8db6c'), C('#5f9e43'), null /* per tree */, C('#8a6a4a')],
  autumn: [C('#e07b39'), C('#dba73a'), C('#c4452f'), C('#e8c547'), C('#b8562e')],
  pine: C('#2f6b4a'),
  shallow: C('#8be3d2'), mid: C('#3fb0bf'), deep: C('#1d5f8f'), foam: C('#e8fbf6'),
};
const SEABED_MIN = -1.45;

/** Grid over the disc; vertices outside the rim are pulled onto it so the edge is a clean circle. */
function discGrid(segs, yFn) {
  const step = (2 * R) / segs;
  const pos = [];
  const v = (i, j) => {
    let x = -R + i * step, z = -R + j * step;
    const r = Math.hypot(x, z);
    const out = r > R;
    if (out) { x *= R / r; z *= R / r; }
    return [x, yFn(x, z), z, out];
  };
  const tri = (a, b, c) => {
    if (a[3] && b[3] && c[3]) return;
    pos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
  };
  for (let i = 0; i < segs; i++) for (let j = 0; j < segs; j++) {
    const a = v(i, j), b = v(i + 1, j), c = v(i, j + 1), d = v(i + 1, j + 1);
    if ((i + j) % 2) { tri(a, c, b); tri(b, c, d); } else { tri(a, c, d); tri(a, d, b); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals(); // non-indexed => flat, faceted shading
  g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(pos.length), 3));
  return g;
}

function paintTriangles(geom, colorOf) {
  const p = geom.attributes.position.array, n = geom.attributes.normal.array, col = geom.attributes.color.array;
  const c = new THREE.Color();
  for (let t = 0; t < p.length; t += 9) {
    const x = (p[t] + p[t + 3] + p[t + 6]) / 3, y = (p[t + 1] + p[t + 4] + p[t + 7]) / 3, z = (p[t + 2] + p[t + 5] + p[t + 8]) / 3;
    colorOf(c, x, y, z, n[t + 1], t / 9);
    for (let k = 0; k < 9; k += 3) { col[t + k] = c.r; col[t + k + 1] = c.g; col[t + k + 2] = c.b; }
  }
  geom.attributes.color.needsUpdate = true;
}

export function buildDiorama(height, seed) {
  const rnd = mulberry32(seed ^ 0x9e3779b9);
  const group = new THREE.Group();
  const flat = (o = {}) => new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.9, metalness: 0, ...o });

  // --- Basin geometry for the world simulation (sea level <-> water volume) ---
  const cellH = [], N = 80, st = (2 * R) / N, A = st * st;
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const x = -R + (i + 0.5) * st, z = -R + (j + 0.5) * st;
    if (Math.hypot(x, z) <= R) cellH.push(height(x, z));
  }
  const volumeAt = (L) => { let v = 0; for (const h of cellH) if (L > h) v += (L - h) * A; return v; };
  const LEVELS = [], VOLS = [];
  for (let L = SEABED_MIN; L <= 2.0001; L += 0.01) { LEVELS.push(L); VOLS.push(volumeAt(L)); }
  const levelFor = (V) => {
    let i = 1;
    while (i < VOLS.length - 1 && VOLS[i] < V) i++;
    const t = clamp01((V - VOLS[i - 1]) / (VOLS[i] - VOLS[i - 1] || 1));
    return LEVELS[i - 1] + t * (LEVELS[i] - LEVELS[i - 1]);
  };

  // --- Terrain -----------------------------------------------------------
  const terrainGeom = discGrid(96, height);
  const triRand = new Float32Array(terrainGeom.attributes.position.count / 3).map(() => rnd());
  const terrain = new THREE.Mesh(terrainGeom, flat({ vertexColors: true }));
  terrain.castShadow = terrain.receiveShadow = true;
  group.add(terrain);

  // --- Sea (hidden until the world has water) -----------------------------
  const waterGeom = discGrid(64, () => 0);
  const wp = waterGeom.attributes.position.array;
  const waterBase = Float32Array.from(wp);
  const water = new THREE.Mesh(waterGeom, flat({ vertexColors: true, transparent: true, opacity: 0.86, roughness: 0.25 }));
  water.receiveShadow = true;
  group.add(water);
  const wallGeom = new THREE.CylinderGeometry(R * 1.003, R * 1.003, 1, 128, 1, true).translate(0, 0.5, 0);
  const wall = new THREE.Mesh(wallGeom, flat({ color: '#2f8a99', transparent: true, opacity: 0.7 }));
  group.add(wall);

  // --- Base block (cut-away diorama sides + wooden plinth) ----------------
  const sideGeom = new THREE.CylinderGeometry(R, R, BASE_DEPTH, 128, 48, true).toNonIndexed();
  sideGeom.translate(0, -BASE_DEPTH / 2, 0);
  sideGeom.computeVertexNormals();
  sideGeom.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(sideGeom.attributes.position.count * 3), 3));
  const layers = [C('#7d6b58'), C('#d9c08a'), C('#7a5a3c'), C('#5e4430'), C('#47342a')];
  paintTriangles(sideGeom, (c, x, y, z) => {
    const a = Math.atan2(z, x);
    const yy = y + Math.sin(a * 7) * 0.06 + Math.sin(a * 17 + 1) * 0.04;
    c.copy(yy > -1.35 ? layers[0] : yy > -1.6 ? layers[1] : yy > -2.1 ? layers[2] : yy > -2.6 ? layers[3] : layers[4]);
  });
  const sides = new THREE.Mesh(sideGeom, flat({ vertexColors: true }));
  sides.receiveShadow = true;
  group.add(sides);

  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(R * 1.05, R * 1.08, 0.45, 96), flat({ color: '#3a2a20', roughness: 0.7 }));
  plinth.position.y = -BASE_DEPTH - 0.22;
  plinth.receiveShadow = true;
  group.add(plinth);

  // --- Tree spots (where plant life can grow) -------------------------------
  const slope = (x, z) => {
    const e = 0.15, dx = height(x + e, z) - height(x - e, z), dz = height(x, z + e) - height(x, z - e);
    return Math.hypot(dx, dz) / (2 * e);
  };
  const trees = [];
  for (let i = 0; i < 8000 && trees.length < 450; i++) {
    const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * R * 0.95;
    const x = Math.cos(a) * r, z = Math.sin(a) * r, y = height(x, z);
    if (y < 0 || y > 3.9 || slope(x, z) > 0.75) continue;
    const pine = y > 1.8 ? rnd() < 0.85 : rnd() < 0.25;
    trees.push({ x, y: y - 0.05, z, pine, s: 0.7 + rnd() * 0.6, rot: rnd() * 6.28, autumn: PAL.autumn[(rnd() * PAL.autumn.length) | 0], j: rnd() });
  }
  const spots = trees.map((t) => ({ x: t.x, z: t.z, y: t.y + 0.05, nbrs: [] }));
  for (let i = 0; i < trees.length; i++) for (let k = 0; k < trees.length; k++) {
    if (i !== k && Math.hypot(trees[i].x - trees[k].x, trees[i].z - trees[k].z) < 2.2) spots[i].nbrs.push(k);
  }

  const trunkGeom = new THREE.CylinderGeometry(0.045, 0.07, 0.4, 5).translate(0, 0.2, 0);
  const pineGeom = mergeGeometries([
    new THREE.ConeGeometry(0.3, 0.7, 6).translate(0, 0.6, 0),
    new THREE.ConeGeometry(0.22, 0.55, 6).translate(0, 0.95, 0),
  ]);
  const leafGeom = new THREE.IcosahedronGeometry(0.34, 0).translate(0, 0.62, 0);
  let np = 0, nd = 0;
  for (const t of trees) t.idx = t.pine ? np++ : nd++;
  const trunks = new THREE.InstancedMesh(trunkGeom, flat({ color: '#6b4a32' }), trees.length);
  const pineMesh = new THREE.InstancedMesh(pineGeom, flat(), np);
  const leafMesh = new THREE.InstancedMesh(leafGeom, flat(), nd);
  for (const m of [trunks, pineMesh, leafMesh]) { m.castShadow = true; m.receiveShadow = true; group.add(m); }
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), P = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
  const place = (mesh, i, t, scale) => {
    Q.setFromAxisAngle(UP, t.rot); P.set(t.x, t.y, t.z); S.setScalar(Math.max(0.0001, t.s * scale));
    mesh.setMatrixAt(i, M.compose(P, Q, S));
  };

  // --- Rocks ------------------------------------------------------------
  const rocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.22, 0), flat({ color: '#9a958e' }), 60);
  let nr = 0;
  for (let i = 0; i < 3000 && nr < 60; i++) {
    const a = rnd() * 6.28, r = Math.sqrt(rnd()) * R * 0.9, x = Math.cos(a) * r, z = Math.sin(a) * r, y = height(x, z);
    if (y < -0.2 || !(slope(x, z) > 0.6 || (y < 0.3 && rnd() < 0.3))) continue;
    Q.setFromEuler(new THREE.Euler(rnd() * 3, rnd() * 3, rnd() * 3)); P.set(x, y, z);
    S.set(0.6 + rnd(), 0.4 + rnd() * 0.6, 0.6 + rnd());
    rocks.setMatrixAt(nr++, M.compose(P, Q, S));
  }
  rocks.count = nr; rocks.castShadow = rocks.receiveShadow = true;
  group.add(rocks);

  // --- Clouds (only once the world has water) --------------------------------
  const cloudMat = flat({ color: '#ffffff', transparent: true, opacity: 0.94, roughness: 1 });
  const clouds = [];
  for (let i = 0; i < 5; i++) {
    const parts = [];
    const n = 3 + ((rnd() * 3) | 0);
    for (let k = 0; k < n; k++) {
      parts.push(new THREE.IcosahedronGeometry(0.5 + rnd() * 0.5, 0).translate((k - n / 2) * 0.65, rnd() * 0.3, (rnd() - 0.5) * 0.6));
    }
    const cloud = new THREE.Mesh(mergeGeometries(parts), cloudMat);
    cloud.castShadow = true;
    cloud.userData = { a: rnd() * 6.28, r: 3 + rnd() * 6, y: 6.5 + rnd() * 2, speed: 0.012 + rnd() * 0.012 };
    clouds.push(cloud); group.add(cloud);
  }

  // --- Showing the world state --------------------------------------------
  const lerpKey = (keys, k, t, autumnColor, out) =>
    out.lerpColors(keys[k] ?? autumnColor, keys[(k + 1) % 4] ?? autumnColor, t);

  // Coarse "greenness" map: land is green only near living plants.
  const G = 48, gst = (2 * R) / G, green = new Uint8Array(G * G);
  const gIdx = (x, z) => Math.min(G - 1, Math.max(0, ((x + R) / gst) | 0)) * G + Math.min(G - 1, Math.max(0, ((z + R) / gst) | 0));
  function rebuildGreen(veg) {
    green.fill(0);
    trees.forEach((t, i) => {
      if (veg[i] < 0.3) return;
      const rad = 1.4 * veg[i];
      for (let gx = -3; gx <= 3; gx++) for (let gz = -3; gz <= 3; gz++) {
        const x = t.x + gx * gst, z = t.z + gz * gst;
        if (Math.hypot(gx * gst, gz * gst) <= rad) green[gIdx(x, z)] = 1;
      }
    });
  }

  function paintTerrain(s, sea) {
    const wet = sea !== null;
    const grass = lerpKey(PAL.grass, s.k, s.t, null, new THREE.Color());
    const snowLine = 4.5 - s.snow * 4.1;
    paintTriangles(terrainGeom, (c, x, y, z, ny, i) => {
      const r = triRand[i];
      if (wet && y < sea - 0.05) c.lerpColors(PAL.seabed, PAL.rockDark, clamp01((sea - y) / 1.6) * 0.5);
      else if (ny < 0.55) c.copy(r > 0.5 ? PAL.rock : PAL.rockDark);
      else if (!wet && y < 0) c.copy(PAL.dryBed);
      else if (wet && y < sea + 0.28) c.copy(PAL.sand);
      else if (wet && (y > snowLine || (s.snow > 0 && ny > 0.85 && r < s.snow * 0.9))) c.copy(PAL.snow);
      else if (green[gIdx(x, z)]) c.copy(y > 3.5 ? c.lerpColors(grass, PAL.alpine, smoothstep(3.5, 4.2, y)) : grass);
      else c.copy(r > 0.5 ? PAL.dirt : PAL.dirtDark);
      c.multiplyScalar(0.93 + r * 0.14); // per-facet jitter = low-poly charm
    });
  }

  function paintWater(sea) {
    paintTriangles(waterGeom, (c, x, _y, z) => {
      const d = sea - height(x, z);
      if (d < 0.06) c.copy(PAL.foam);
      else if (d < 0.5) c.lerpColors(PAL.shallow, PAL.mid, smoothstep(0.06, 0.5, d));
      else c.lerpColors(PAL.mid, PAL.deep, smoothstep(0.5, 1.3, d));
    });
  }

  function paintTrees(s, veg) {
    const c = new THREE.Color();
    for (let i = 0; i < trees.length; i++) {
      const t = trees[i], g = veg[i];
      place(trunks, i, t, g);
      if (t.pine) {
        c.copy(PAL.pine).multiplyScalar(0.85 + t.j * 0.3).lerp(PAL.snow, s.snow * 0.55);
        pineMesh.setColorAt(t.idx, c);
        place(pineMesh, t.idx, t, g);
      } else {
        lerpKey(PAL.leaf, s.k, s.t, t.autumn, c).multiplyScalar(0.88 + t.j * 0.24);
        if (s.snow > 0) c.lerp(PAL.snow, s.snow * 0.6);
        leafMesh.setColorAt(t.idx, c);
        const keep = 1 - smoothstep(t.j * 0.5, t.j * 0.5 + 0.5, s.bare); // leaves drop tree by tree
        place(leafMesh, t.idx, t, g * keep);
      }
    }
    for (const m of [trunks, pineMesh, leafMesh]) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
  }

  let keys = {};
  /** view = { season, sea (number | null), veg (array 0..1 per spot) } */
  function show({ season, sea, veg }) {
    const seasonKey = `${season.k}|${season.t.toFixed(2)}|${season.snow.toFixed(2)}|${season.bare.toFixed(2)}`;
    const seaKey = sea === null ? 'dry' : sea.toFixed(2);
    let vegKey = 0;
    for (const g of veg) vegKey += g >= 0.3 ? 1 : 0;
    const vegSum = veg.reduce((a, b) => a + b, 0).toFixed(1);

    if (vegKey !== keys.veg) rebuildGreen(veg);
    if (seasonKey !== keys.season || seaKey !== keys.sea || vegKey !== keys.veg) paintTerrain(season, sea);
    if (seaKey !== keys.sea && sea !== null) paintWater(sea);
    if (seasonKey !== keys.season || vegSum !== keys.vegSum) paintTrees(season, veg);
    keys = { season: seasonKey, sea: seaKey, veg: vegKey, vegSum };

    water.visible = wall.visible = sea !== null;
    if (sea !== null) { water.position.y = sea; wall.position.y = SEABED_MIN; wall.scale.y = Math.max(0.01, sea - SEABED_MIN); }
    for (const cl of clouds) cl.visible = sea !== null;
  }

  function tick(time) {
    if (water.visible) {
      for (let i = 0; i < wp.length; i += 3) {
        const x = waterBase[i], z = waterBase[i + 2];
        wp[i + 1] = 0.035 * Math.sin(x * 1.3 + time * 0.9) + 0.025 * Math.sin(z * 1.7 - time * 1.1) + 0.015 * Math.sin((x + z) * 2.3 + time * 1.7);
      }
      waterGeom.attributes.position.needsUpdate = true;
      waterGeom.computeVertexNormals();
    }
    for (const cl of clouds) {
      const u = cl.userData;
      const a = u.a + time * u.speed;
      cl.position.set(Math.cos(a) * u.r, u.y + Math.sin(time * 0.3 + u.a) * 0.15, Math.sin(a) * u.r);
      cl.rotation.y = -a;
    }
  }

  return { group, show, tick, geo: { volumeAt, levelFor, spots }, counts: { spots: trees.length, rocks: nr } };
}
