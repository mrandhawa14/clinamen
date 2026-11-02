// Era 1–2 assets: hydrogen clouds that clump under gravity, stars that ignite, supernovae.
import * as THREE from 'three';
import {
  mulberry32, createNoise3D, smoothstep, phase, easeOut, makeParticles, glowSprite, kelvinToColor, EMISSION,
} from './common.js';

const C = (h) => new THREE.Color(h);

/**
 * Primordial gas (about 3/4 hydrogen, 1/4 helium by mass) that gravity pulls into
 * clumps. t = how far the collapse has gone. Returns the clump centres, where stars form.
 */
export function makeGasCloud({ seed = 61, count = 9000, radius = 14, clumps = 5 } = {}) {
  const rnd = mulberry32(seed), n3 = createNoise3D(rnd);
  const centres = Array.from({ length: clumps }, () =>
    new THREE.Vector3((rnd() - 0.5) * radius * 1.1, (rnd() - 0.5) * radius * 0.5, (rnd() - 0.5) * radius * 1.1));
  const parts = [];
  while (parts.length < count) {
    const p = new THREE.Vector3(rnd() * 2 - 1, (rnd() * 2 - 1) * 0.55, rnd() * 2 - 1).multiplyScalar(radius);
    if (p.length() > radius) continue;
    const d = n3(p.x * 0.09, p.y * 0.09, p.z * 0.09) + 0.5 * n3(p.x * 0.2, p.y * 0.2, p.z * 0.2);
    if (d < 0.05 + rnd() * 0.25) continue;                      // filaments, not a uniform fog
    let best = 0, bd = Infinity;
    centres.forEach((c, i) => { const dd = c.distanceTo(p); if (dd < bd) { bd = dd; best = i; } });
    parts.push({ p, c: best, he: rnd() < 0.08, glow: 0.5 + rnd() * 0.5, spin: (rnd() - 0.5) * 0.6 });
  }
  const cloud = makeParticles(count, { size: 0.42, vertexColors: true, opacity: 0.8 });
  const H = C(EMISSION.H), HE = C(EMISSION.He), REF = C('#6f8cff'); // blue: starlight scattered by dust
  const col = new THREE.Color(), V = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);

  function update(t, time) {
    const k = smoothstep(0, 1, t) ** 1.4;
    parts.forEach((q, i) => {
      const c = centres[q.c];
      V.copy(q.p).sub(c).multiplyScalar(1 - 0.88 * k).applyAxisAngle(Y, q.spin * k * 3 + time * 0.02).add(c);
      cloud.set(i, V.x, V.y, V.z);
      col.copy(q.he ? HE : H).lerp(REF, 0.25 * (1 - k) * (i % 3 === 0 ? 1 : 0));
      cloud.color(i, col, q.glow * (0.35 + 0.65 * k));
    });
    cloud.commit();
  }
  return { object: cloud.points, update, centres };
}

/**
 * A star. Its colour comes from its surface temperature (black-body):
 * ~3,000 K red dwarf, ~5,800 K like the Sun, 20,000 K+ blue giant.
 * t: 0 = dim protostar, ignition around 0.3, steady after.
 */
export function makeStar({ temperature = 5800, radius = 0.8 } = {}) {
  const object = new THREE.Group();
  const full = kelvinToColor(temperature), proto = kelvinToColor(1800).multiplyScalar(0.35);
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(radius, 2), new THREE.MeshBasicMaterial({ color: proto, toneMapped: false }));
  const glow = glowSprite(full, radius * 7, 0.9);
  const corona = glowSprite(full, radius * 10, 0.22);
  const ignite = glowSprite('#ffffff', radius * 12, 0);
  object.add(corona, glow, core, ignite);
  function update(t, time) {
    const on = smoothstep(0.2, 0.4, t);
    core.material.color.lerpColors(proto, full, on);
    glow.material.color.copy(core.material.color);
    glow.material.opacity = 0.25 + 0.65 * on;
    corona.material.opacity = 0.22 * on;
    const f = phase(t, 0.28, 0.5);
    ignite.material.opacity = Math.sin(Math.PI * f) * 0.7;
    const flicker = 1 + 0.04 * Math.sin(time * 3.1) + 0.02 * Math.sin(time * 7.7);
    glow.scale.setScalar(radius * 7 * flicker);
    corona.scale.setScalar(radius * 10 * (1 + 0.03 * Math.sin(time * 1.7)));
    core.rotation.y = time * 0.2;
  }
  return { object, update };
}

/**
 * A massive star dies: it swells, flashes brighter than its galaxy, and throws off
 * the elements it forged. Inner layers (oxygen) teal, outer (hydrogen) red, sulfur between.
 * A tiny, hot neutron star is left at the centre.
 */
export function makeSupernova({ seed = 71, count = 4200, reach = 9 } = {}) {
  const rnd = mulberry32(seed), n3 = createNoise3D(rnd);
  const object = new THREE.Group();
  const star = makeStar({ temperature: 3600, radius: 1.1 }); // a red supergiant before the end
  star.update(1, 0);
  object.add(star.object);
  const flash = glowSprite('#f4f8ff', 1, 0);
  const remnant = glowSprite(kelvinToColor(40000), 1.2, 0);
  object.add(flash, remnant);

  const shell = makeParticles(count, { size: 0.45, vertexColors: true });
  object.add(shell.points);
  const golden = Math.PI * (3 - Math.sqrt(5));
  const parts = Array.from({ length: count }, (_, i) => {
    const y = 1 - (i / (count - 1)) * 2, r = Math.sqrt(1 - y * y), th = golden * i;
    const d = new THREE.Vector3(Math.cos(th) * r, y, Math.sin(th) * r);
    const fil = 1 + 0.22 * n3(d.x * 3, d.y * 3, d.z * 3);          // filaments
    const layer = rnd();
    const el = layer < 0.3 ? 'O' : layer < 0.45 ? 'S' : 'H';
    return { d, v: (el === 'O' ? 0.6 : el === 'S' ? 0.8 : 1) * (0.85 + rnd() * 0.25) * fil, el };
  });
  const cols = { O: C(EMISSION.O), S: C(EMISSION.S), H: C(EMISSION.H) };
  const V = new THREE.Vector3();

  function update(t, time) {
    const swell = phase(t, 0, 0.15);
    star.object.visible = t < 0.2;
    star.object.scale.setScalar(1 + 0.6 * swell);
    star.update(1, time);
    const f = phase(t, 0.13, 0.32);
    flash.scale.setScalar(40 * Math.sin(Math.PI * f) + 0.001);
    flash.material.opacity = Math.sin(Math.PI * f);
    remnant.material.opacity = t > 0.18 ? 0.9 : 0;
    remnant.scale.setScalar(1.2 * (1 + 0.1 * Math.sin(time * 20)));
    const e = phase(t, 0.15, 1);
    const R = reach * (1 - (1 - e) ** 2.4);                        // fast, then slowing as it sweeps up gas
    parts.forEach((p, i) => {
      V.copy(p.d).multiplyScalar(R * p.v);
      shell.set(i, V.x, V.y, V.z);
      shell.color(i, cols[p.el], e > 0 ? (1 - 0.35 * e) * (0.7 + 0.3 * Math.sin(i)) : 0);
    });
    shell.commit();
    object.rotation.y = time * 0.03;
  }
  return { object, update };
}
