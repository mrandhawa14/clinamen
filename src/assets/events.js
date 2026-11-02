// Accident events. Each returns { object, update(t, time) } with t = progress 0..1.
import * as THREE from 'three';
import {
  mulberry32, smoothstep, phase, easeOut, makeParticles, makeRock, glowSprite, puffDot,
} from './common.js';
import { makePlanet, makeMoon } from './bodies.js';
import { R as ISLAND_R } from '../world.js';

const C = (h) => new THREE.Color(h);
const lerp = (a, b, k) => a + (b - a) * k;
const randDir = (rnd) => new THREE.Vector3(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1).normalize();

// ---------------------------------------------------------------------------------
// Water from space: icy comets streak in, burst into steam, and oceans fill.
// ---------------------------------------------------------------------------------
export function makeWaterFromSpace({ R = 3, seed = 21, count = 9 } = {}) {
  const rnd = mulberry32(seed);
  const object = new THREE.Group();
  const planet = makePlanet({ radius: R, seed });
  planet.setState('crust');
  object.add(planet.group);

  const TAIL = 46, STEAM = 50;
  const tails = makeParticles(count * TAIL, { size: 0.22, vertexColors: true });
  const steam = makeParticles(count * STEAM, { size: 0.5, vertexColors: true, map: puffDot() });
  object.add(tails.points, steam.points);
  const tailColor = C('#a6dcff'), steamColor = C('#eef6ff');

  const comets = Array.from({ length: count }, (_, i) => {
    const hitDir = randDir(rnd);
    if (hitDir.z < -0.2) hitDir.z *= -1;              // mostly on the side facing the viewer
    const hit = hitDir.clone().multiplyScalar(R);
    const from = hit.clone().add(randDir(rnd).add(hitDir).normalize().multiplyScalar(R * 7));
    const nucleus = makeRock(R * 0.06, seed + i, ['#e6f3fb', '#bcd6e8'], { detail: 1, rough: 0.3 });
    object.add(nucleus);
    const t0 = 0.04 + (i / count) * 0.5 + rnd() * 0.04;
    const puffs = Array.from({ length: STEAM }, () => randDir(rnd).add(hitDir.clone().multiplyScalar(1.4)).normalize());
    return { hit, from, nucleus, t0, dur: 0.12, puffs, hitDir };
  });

  const P = new THREE.Vector3();
  function update(t, time) {
    comets.forEach((c, i) => {
      const k = phase(t, c.t0, c.t0 + c.dur);
      c.nucleus.visible = k > 0 && k < 1;
      P.lerpVectors(c.from, c.hit, k ** 1.6);
      c.nucleus.position.copy(P);
      c.nucleus.rotation.set(time * 2 + i, time * 1.3, 0);
      for (let j = 0; j < TAIL; j++) {
        const kk = Math.max(0, k ** 1.6 - j * 0.006);
        P.lerpVectors(c.from, c.hit, kk);
        const live = k > 0 && k < 1 ? 1 : Math.max(0, 1 - phase(t, c.t0 + c.dur, c.t0 + c.dur + 0.05));
        tails.set(i * TAIL + j, P.x + Math.sin(j * 3.1) * j * 0.004, P.y + Math.cos(j * 2.3) * j * 0.004, P.z);
        tails.color(i * TAIL + j, tailColor, live * (1 - j / TAIL) * (k > 0 ? 1 : 0));
      }
      const s = phase(t, c.t0 + c.dur, c.t0 + c.dur + 0.18);
      c.puffs.forEach((d, j) => {
        P.copy(c.hit).addScaledVector(d, easeOut(s) * R * 0.5);
        steam.set(i * STEAM + j, P.x, P.y, P.z);
        steam.color(i * STEAM + j, steamColor, s > 0 ? 0.55 * (1 - s) : 0);
      });
    });
    tails.commit(); steam.commit();
    const water = smoothstep(0.5, 0.95, t);
    planet.setState(water > 0 ? 'ocean' : 'crust', water);
    planet.group.rotation.y = time * 0.05;
  }
  return { object, update };
}

// ---------------------------------------------------------------------------------
// Moon-forming impact (Theia): a Mars-sized body hits the young planet; the debris
// forms a ring that gathers into a moon.
// ---------------------------------------------------------------------------------
export function makeMoonImpact({ R = 3, seed = 11 } = {}) {
  const rnd = mulberry32(seed);
  const object = new THREE.Group();
  const planet = makePlanet({ radius: R, seed });
  planet.setState('molten');
  object.add(planet.group);

  const theia = makeRock(R * 0.48, seed + 1, ['#8a4b3a', '#6e3b30', '#a35a40'], { detail: 2, rough: 0.12 });
  object.add(theia);
  const contact = new THREE.Vector3(0.75, 0.3, 0.6).normalize().multiplyScalar(R);
  const start = contact.clone().multiplyScalar(5).add(new THREE.Vector3(-R * 3, R * 0.6, R * 2));
  const flash = glowSprite('#fff1c6', 1, 0);
  object.add(flash);

  const N = 1800, ring = makeParticles(N, { size: 0.26, vertexColors: true });
  object.add(ring.points);
  const parts = Array.from({ length: N }, () => ({
    out: contact.clone().normalize().add(randDir(rnd).multiplyScalar(0.9)).normalize(),
    dist: 1.2 + rnd() * 1.6,
    rr: R * (1.45 + rnd() * 1.1),
    a0: rnd() * Math.PI * 2,
    h: (rnd() - 0.5) * 0.1 * R,
    jitter: randDir(rnd).multiplyScalar(rnd() * R * 0.35),
  }));
  const hot = C('#ffb347'), warm = C('#d0603a'), cool = C('#8d837a');
  const moon = makeMoon({ radius: R * 0.27, seed: seed + 2 });
  object.add(moon);
  const MOON_ORBIT = R * 2.6;

  const A = new THREE.Vector3(), B = new THREE.Vector3(), M = new THREE.Vector3(), c = new THREE.Color();
  function update(t, time) {
    const a = phase(t, 0, 0.25);
    theia.visible = t < 0.33;
    theia.position.lerpVectors(start, contact, a * a);
    theia.scale.setScalar(1 - phase(t, 0.25, 0.33));
    theia.rotation.set(time * 0.3, time * 0.5, 0);

    const f = phase(t, 0.24, 0.42);
    flash.position.copy(contact).multiplyScalar(1.05);
    flash.scale.setScalar(R * 7 * Math.sin(Math.PI * f));
    flash.material.opacity = Math.sin(Math.PI * f);

    const e = easeOut(phase(t, 0.26, 0.46)), r = smoothstep(0.4, 0.72, t), g = smoothstep(0.74, 0.95, t);
    const spin = time * 0.6;
    const mA = time * 0.25;
    M.set(Math.cos(mA) * MOON_ORBIT, 0, Math.sin(mA) * MOON_ORBIT);
    parts.forEach((p, i) => {
      A.copy(contact).addScaledVector(p.out, e * p.dist * R);
      const w = 0.9 / Math.pow(p.rr / R, 1.5);          // Kepler: inner debris orbits faster
      const ang = p.a0 + spin * w;
      B.set(Math.cos(ang) * p.rr, p.h, Math.sin(ang) * p.rr);
      A.lerp(B, r);
      B.copy(M).add(p.jitter);
      A.lerp(B, g);
      ring.set(i, A.x, A.y, A.z);
      const heat = phase(t, 0.3, 0.85);
      c.lerpColors(hot, warm, Math.min(1, heat * 2)).lerp(cool, Math.max(0, heat * 2 - 1));
      ring.color(i, c, e > 0 ? 1 - phase(t, 0.9, 1) : 0);
    });
    ring.commit();

    moon.visible = t > 0.82;
    moon.scale.setScalar(smoothstep(0.82, 0.98, t));
    moon.position.copy(M);
    moon.rotation.y = mA;
    planet.group.rotation.y = time * 0.05;
  }
  return { object, update };
}

// ---------------------------------------------------------------------------------
// Asteroid strike (island scale): fireball entry, flash, shockwave, dust, crater.
// ---------------------------------------------------------------------------------
export function makeCrater(radius = 1.4, seed = 5) {
  const rnd = mulberry32(seed);
  const prof = [[0, -0.32], [0.45, -0.3], [0.85, -0.12], [1.05, 0.2], [1.25, 0.14], [1.7, 0.0]]
    .map(([x, y]) => new THREE.Vector2(x * radius, y * radius));
  const g = new THREE.LatheGeometry(prof, 13).toNonIndexed();
  g.computeVertexNormals();
  const p = g.attributes.position, col = new Float32Array(p.count * 3);
  const floor = C('#3a342f'), wall = C('#4e463e'), rim = C('#6a5e51'), c = new THREE.Color();
  for (let f = 0; f < p.count; f += 3) {
    const y = (p.getY(f) + p.getY(f + 1) + p.getY(f + 2)) / 3 / radius;
    c.copy(y < -0.2 ? floor : y < 0.08 ? wall : rim).multiplyScalar(0.9 + rnd() * 0.2);
    for (let k = 0; k < 3; k++) col.set([c.r, c.g, c.b], (f + k) * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 }));
  m.receiveShadow = true;
  return m;
}

export function makeAsteroidStrike({ height, target = { x: 2.2, z: 2.6 }, seed = 31 } = {}) {
  const rnd = mulberry32(seed);
  const object = new THREE.Group();
  const ground = height(target.x, target.z);
  const hit = new THREE.Vector3(target.x, ground, target.z);
  const start = hit.clone().add(new THREE.Vector3(-9, 11, -6));

  const rock = makeRock(0.45, seed, ['#3d3833', '#2e2a27', '#4a443e'], { detail: 1, rough: 0.3 });
  const heatGlow = glowSprite('#ff8a3a', 2.2, 0);
  const flash = glowSprite('#fff4d6', 1, 0);
  const shock = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 64),
    new THREE.MeshBasicMaterial({ color: '#fff6e6', transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
  shock.rotation.x = -Math.PI / 2;
  shock.position.copy(hit).setY(ground + 0.12);
  const TR = 140, trail = makeParticles(TR, { size: 0.8, vertexColors: true });
  const DU = 900, dust = makeParticles(DU, { size: 1.3, color: '#8a7b6a', additive: false, map: puffDot(), opacity: 0.9 });
  const crater = makeCrater(1.8, seed);
  crater.position.copy(hit).setY(ground - 0.05);
  object.add(rock, heatGlow, flash, shock, trail.points, dust.points, crater);

  const fire = [C('#fffbe8'), C('#ffd27a'), C('#ff7a2a'), C('#b8401f'), C('#4a3f38')];
  const fireAt = (k, out) => { const x = k * (fire.length - 1), i = Math.min(fire.length - 2, x | 0); return out.lerpColors(fire[i], fire[i + 1], x - i); };
  const dustP = Array.from({ length: DU }, () => ({ a: rnd() * Math.PI * 2, col: rnd(), r: rnd(), cap: rnd() < 0.55 }));
  const P = new THREE.Vector3(), c = new THREE.Color();

  function update(t, time) {
    const a = phase(t, 0, 0.3);
    rock.visible = a < 1;
    P.lerpVectors(start, hit, a ** 1.8);
    rock.position.copy(P);
    rock.rotation.set(time * 2, time * 1.4, 0);
    heatGlow.position.copy(P);
    heatGlow.material.opacity = a < 1 ? smoothstep(0.2, 0.7, a) : 0;

    const linger = 1 - phase(t, 0.3, 0.62);
    for (let j = 0; j < TR; j++) {
      const k = Math.max(0, a ** 1.8 - j * 0.0045);
      P.lerpVectors(start, hit, k);
      P.x += Math.sin(j * 1.7) * j * 0.006; P.y += Math.cos(j * 2.1) * j * 0.006;
      trail.set(j, P.x, P.y, P.z);
      fireAt(j / TR, c);
      trail.color(j, c, a > 0.05 ? linger * smoothstep(0.1, 0.5, a) * (1 - j / TR * 0.4) : 0);
    }
    trail.commit();

    const f = phase(t, 0.29, 0.42);
    flash.position.copy(hit).setY(ground + 0.5);
    flash.scale.setScalar(14 * Math.sin(Math.PI * f));
    flash.material.opacity = Math.sin(Math.PI * f);

    const k = phase(t, 0.3, 0.6);
    shock.scale.setScalar(0.5 + easeOut(k) * 9);
    shock.material.opacity = k > 0 ? 0.8 * (1 - k) : 0;

    const d = easeOut(phase(t, 0.3, 0.85));
    dustP.forEach((q, i) => {
      const y = q.cap ? d * 6.5 + (q.col - 0.5) * 1.2 * d : d * 6.5 * q.col;
      const rad = q.cap ? d * (1 + q.r * 2.4) : 0.3 + q.r * 0.6 * d;
      dust.set(i, hit.x + Math.cos(q.a + time * 0.05) * rad, ground + y, hit.z + Math.sin(q.a + time * 0.05) * rad);
    });
    dust.commit();
    dust.points.visible = d > 0;
    dust.mat.opacity = 0.85 * (1 - phase(t, 0.7, 1));

    crater.visible = t > 0.3;
    crater.scale.setScalar(smoothstep(0.3, 0.36, t));
  }
  // The world clears life inside this zone once t passes `at`.
  const blast = { x: hit.x, z: hit.z, radius: 3.2, at: 0.31 };
  return { object, update, blast };
}

// ---------------------------------------------------------------------------------
// Life starts (island scale): microbial mats spread through warm shallow water.
// ---------------------------------------------------------------------------------
export function makeFirstLife({ height, sea = 0, seed = 41, max = 170 } = {}) {
  const rnd = mulberry32(seed);
  const object = new THREE.Group();
  const spots = [];
  for (let i = 0; i < 9000 && spots.length < max * 3; i++) {
    const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * ISLAND_R * 0.95;
    const x = Math.cos(a) * r, z = Math.sin(a) * r, depth = sea - height(x, z);
    if (depth > 0.0 && depth < 0.3) spots.push({ x, z, y: height(x, z), s: 0.6 + rnd() * 0.9, rot: rnd() * 6.28, j: rnd() });
  }
  const origin = spots[0] || { x: 0, z: 0 };
  spots.sort((p, q) => Math.hypot(p.x - origin.x, p.z - origin.z) - Math.hypot(q.x - origin.x, q.z - origin.z));
  const used = spots.slice(0, max);

  const moundGeo = new THREE.IcosahedronGeometry(0.26, 0).scale(1, 0.6, 1);
  const mounds = new THREE.InstancedMesh(moundGeo, new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.8 }), used.length);
  // Mats seen from above form green slicks at the surface of the shallows (tidal flats).
  const film = new THREE.InstancedMesh(new THREE.CircleGeometry(0.7, 6).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: '#5fae6e', transparent: true, opacity: 0.62, roughness: 1, depthWrite: false }), used.length);
  const palette = [C('#3e8f7a'), C('#5aa06a'), C('#7a9a4e'), C('#2f7d72')];
  used.forEach((s, i) => mounds.setColorAt(i, palette[(s.j * palette.length) | 0]));
  object.add(film, mounds);

  const Mx = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), P = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
  function update(t, time) {
    used.forEach((s, i) => {
      const th = (i / used.length) * 0.85;
      const g = smoothstep(th, th + 0.12, t) * (1 + 0.05 * Math.sin(time * 1.5 + i));
      Q.setFromAxisAngle(UP, s.rot);
      P.set(s.x, s.y + 0.02, s.z);
      S.setScalar(Math.max(0.0001, g * s.s));
      mounds.setMatrixAt(i, Mx.compose(P, Q, S));
      P.y = Math.max(s.y, sea) + 0.015;
      S.setScalar(Math.max(0.0001, smoothstep(th, th + 0.2, t) * s.s * 1.4));
      film.setMatrixAt(i, Mx.compose(P, Q, S));
    });
    mounds.instanceMatrix.needsUpdate = film.instanceMatrix.needsUpdate = true;
  }
  return { object, update, count: used.length };
}

// ---------------------------------------------------------------------------------
// Rain (island weather). intensity 0..1 = how many drops fall.
// ---------------------------------------------------------------------------------
export function makeRain({ count = 1200, radius = 9.5, top = 8, seed = 51 } = {}) {
  const rnd = mulberry32(seed);
  const drops = Array.from({ length: count }, () => {
    const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * radius;
    return { x: Math.cos(a) * r, z: Math.sin(a) * r, ph: rnd(), v: 0.8 + rnd() * 0.4 };
  });
  const pos = new Float32Array(count * 6);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const lines = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: '#c4dcf2', transparent: true, opacity: 0.55 }));
  lines.frustumCulled = false;
  function update(t, time, intensity = 1) {
    drops.forEach((d, i) => {
      const y = top - (((time * 6 * d.v) / top + d.ph) % 1) * (top + 1.5);
      pos.set([d.x, y, d.z, d.x - 0.04, y + 0.35, d.z], i * 6);
    });
    g.attributes.position.needsUpdate = true;
    g.setDrawRange(0, Math.floor(count * intensity) * 2);
  }
  return { object: lines, update };
}
