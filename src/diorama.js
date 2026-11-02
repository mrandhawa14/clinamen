// Builds the diorama meshes: terrain, water, base block, trees, rocks, clouds.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { R, BASE_DEPTH, mulberry32, clamp01, smoothstep } from './world.js';

const C = (hex) => new THREE.Color(hex);
const PAL = {
  sand: C('#e9d39b'), seabed: C('#cdb47d'), rock: C('#8f8a84'), rockDark: C('#726d68'),
  alpine: C('#9c9b7c'), snow: C('#f3f6fa'),
  grass: [C('#93cf6a'), C('#6aa84f'), C('#a9a052'), C('#7f8f66')],
  leaf: [C('#a8db6c'), C('#5f9e43'), null /* per tree */, C('#8a6a4a')],
  autumn: [C('#e07b39'), C('#dba73a'), C('#c4452f'), C('#e8c547'), C('#b8562e')],
  pine: C('#2f6b4a'),
  shallow: C('#8be3d2'), mid: C('#3fb0bf'), deep: C('#1d5f8f'), foam: C('#e8fbf6'),
};

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

  // --- Terrain -----------------------------------------------------------
  const terrainGeom = discGrid(96, height);
  const triRand = new Float32Array(terrainGeom.attributes.position.count / 3).map(() => rnd());
  const terrain = new THREE.Mesh(terrainGeom, flat({ vertexColors: true }));
  terrain.castShadow = terrain.receiveShadow = true;
  group.add(terrain);

  // --- Water ------------------------------------------------------------
  const waterGeom = discGrid(64, () => 0);
  const wp = waterGeom.attributes.position.array;
  const waterBase = Float32Array.from(wp);
  paintTriangles(waterGeom, (c, x, _y, z) => {
    const d = -height(x, z);
    if (d < 0.06) c.copy(PAL.foam);
    else if (d < 0.5) c.lerpColors(PAL.shallow, PAL.mid, smoothstep(0.06, 0.5, d));
    else c.lerpColors(PAL.mid, PAL.deep, smoothstep(0.5, 1.3, d));
  });
  const water = new THREE.Mesh(waterGeom, flat({ vertexColors: true, transparent: true, opacity: 0.86, roughness: 0.25 }));
  water.receiveShadow = true;
  group.add(water);

  // --- Base block (cut-away diorama sides + wooden plinth) ----------------
  const sideGeom = new THREE.CylinderGeometry(R, R, BASE_DEPTH, 128, 48, true).toNonIndexed();
  sideGeom.translate(0, -BASE_DEPTH / 2, 0);
  sideGeom.computeVertexNormals();
  sideGeom.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(sideGeom.attributes.position.count * 3), 3));
  const layers = [C('#2f7f8f'), C('#d9c08a'), C('#7a5a3c'), C('#5e4430'), C('#47342a')];
  paintTriangles(sideGeom, (c, x, y, z) => {
    const a = Math.atan2(z, x);
    const wob = Math.sin(a * 7) * 0.06 + Math.sin(a * 17 + 1) * 0.04;
    const yy = y + wob;
    c.copy(yy > -1.35 ? layers[0] : yy > -1.6 ? layers[1] : yy > -2.1 ? layers[2] : yy > -2.6 ? layers[3] : layers[4]);
  });
  const sides = new THREE.Mesh(sideGeom, flat({ vertexColors: true }));
  sides.receiveShadow = true;
  group.add(sides);

  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(R * 1.05, R * 1.08, 0.45, 96), flat({ color: '#3a2a20', roughness: 0.7 }));
  plinth.position.y = -BASE_DEPTH - 0.22;
  plinth.receiveShadow = true;
  group.add(plinth);

  // --- Trees ------------------------------------------------------------
  const trunkGeom = new THREE.CylinderGeometry(0.045, 0.07, 0.4, 5).translate(0, 0.2, 0);
  const pineGeom = mergeGeometries([
    new THREE.ConeGeometry(0.3, 0.7, 6).translate(0, 0.6, 0),
    new THREE.ConeGeometry(0.22, 0.55, 6).translate(0, 0.95, 0),
  ]);
  const leafGeom = new THREE.IcosahedronGeometry(0.34, 0).translate(0, 0.62, 0);

  const slope = (x, z) => {
    const e = 0.15, dx = height(x + e, z) - height(x - e, z), dz = height(x, z + e) - height(x, z - e);
    return Math.hypot(dx, dz) / (2 * e);
  };
  const trees = [];
  for (let i = 0; i < 6000 && trees.length < 450; i++) {
    const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * R * 0.95;
    const x = Math.cos(a) * r, z = Math.sin(a) * r, y = height(x, z);
    if (y < 0.35 || y > 3.9 || slope(x, z) > 0.75) continue;
    const forest = Math.sin(x * 0.55 + seed % 7) * Math.cos(z * 0.5) + Math.sin((x + z) * 0.3);
    if (forest < 0.15 && rnd() > 0.06) continue;
    const pine = y > 1.8 ? rnd() < 0.85 : rnd() < 0.25;
    trees.push({ x, y: y - 0.05, z, pine, s: 0.7 + rnd() * 0.6, rot: rnd() * 6.28, autumn: PAL.autumn[(rnd() * PAL.autumn.length) | 0], j: rnd() });
  }
  const pines = trees.filter((t) => t.pine), decid = trees.filter((t) => !t.pine);
  const trunks = new THREE.InstancedMesh(trunkGeom, flat({ color: '#6b4a32' }), trees.length);
  const pineMesh = new THREE.InstancedMesh(pineGeom, flat(), pines.length);
  const leafMesh = new THREE.InstancedMesh(leafGeom, flat(), decid.length);
  for (const m of [trunks, pineMesh, leafMesh]) { m.castShadow = true; m.receiveShadow = true; group.add(m); }
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), P = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
  const place = (mesh, i, t, crownScale = 1) => {
    Q.setFromAxisAngle(UP, t.rot); P.set(t.x, t.y, t.z); S.setScalar(t.s * crownScale);
    mesh.setMatrixAt(i, M.compose(P, Q, S));
  };
  trees.forEach((t, i) => place(trunks, i, t));
  pines.forEach((t, i) => place(pineMesh, i, t));

  // --- Rocks ------------------------------------------------------------
  const rockGeom = new THREE.DodecahedronGeometry(0.22, 0);
  const rocks = new THREE.InstancedMesh(rockGeom, flat({ color: '#9a958e' }), 60);
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

  // --- Clouds -----------------------------------------------------------
  const cloudMat = flat({ color: '#ffffff', transparent: true, opacity: 0.94, roughness: 1 });
  const clouds = [];
  for (let i = 0; i < 5; i++) {
    const parts = [];
    const n = 3 + ((rnd() * 3) | 0);
    for (let k = 0; k < n; k++) {
      parts.push(new THREE.IcosahedronGeometry(0.5 + rnd() * 0.5, 0).translate((k - n / 2) * 0.65, rnd() * 0.3, (rnd() - 0.5) * 0.6));
    }
    const cloud = new THREE.Mesh(mergeGeometries(parts), cloudMat);
    cloud.scale.set(1, 0.7, 1);
    cloud.castShadow = true;
    cloud.userData = { a: rnd() * 6.28, r: 3 + rnd() * 6, y: 6.5 + rnd() * 2, speed: 0.012 + rnd() * 0.012 };
    clouds.push(cloud); group.add(cloud);
  }

  // --- Season painting ----------------------------------------------------
  const lerpKey = (keys, k, t, autumnColor, out) =>
    out.lerpColors(keys[k] ?? autumnColor, keys[(k + 1) % 4] ?? autumnColor, t);

  function applySeason(s) {
    const grass = lerpKey(PAL.grass, s.k, s.t, null, new THREE.Color());
    const snowLine = 4.5 - s.snow * 4.1;
    paintTriangles(terrainGeom, (c, x, y, z, ny, i) => {
      const r = triRand[i];
      if (y < -0.05) c.lerpColors(PAL.seabed, PAL.rockDark, clamp01(-y / 1.6) * 0.5);
      else if (ny < 0.55) c.copy(r > 0.5 ? PAL.rock : PAL.rockDark);
      else if (y < 0.28) c.copy(PAL.sand);
      else if (y > snowLine || (s.snow > 0 && ny > 0.85 && r < s.snow * 0.9)) c.copy(PAL.snow);
      else if (y > 3.5) c.lerpColors(grass, PAL.alpine, smoothstep(3.5, 4.2, y));
      else c.copy(grass);
      if (y >= -0.05) c.multiplyScalar(0.93 + r * 0.14); // per-facet jitter = low-poly charm
    });

    const c = new THREE.Color();
    pines.forEach((t, i) => {
      c.copy(PAL.pine).multiplyScalar(0.85 + t.j * 0.3).lerp(PAL.snow, s.snow * 0.55);
      pineMesh.setColorAt(i, c);
    });
    decid.forEach((t, i) => {
      lerpKey(PAL.leaf, s.k, s.t, t.autumn, c).multiplyScalar(0.88 + t.j * 0.24);
      if (s.snow > 0) c.lerp(PAL.snow, s.snow * 0.6);
      leafMesh.setColorAt(i, c);
      // leaves drop in late autumn: each tree loses its crown at a slightly different time
      const keep = 1 - smoothstep(t.j * 0.5, t.j * 0.5 + 0.5, s.bare);
      place(leafMesh, i, t, Math.max(0.001, keep));
    });
    for (const m of [pineMesh, leafMesh]) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
  }

  function tick(time) {
    for (let i = 0; i < wp.length; i += 3) {
      const x = waterBase[i], z = waterBase[i + 2];
      wp[i + 1] = 0.035 * Math.sin(x * 1.3 + time * 0.9) + 0.025 * Math.sin(z * 1.7 - time * 1.1) + 0.015 * Math.sin((x + z) * 2.3 + time * 1.7);
    }
    waterGeom.attributes.position.needsUpdate = true;
    waterGeom.computeVertexNormals();
    for (const cl of clouds) {
      const u = cl.userData;
      const a = u.a + time * u.speed;
      cl.position.set(Math.cos(a) * u.r, u.y + Math.sin(time * 0.3 + u.a) * 0.15, Math.sin(a) * u.r);
      cl.rotation.y = -a;
    }
  }

  return { group, applySeason, tick, counts: { trees: trees.length, rocks: nr } };
}
