// Planet camera: one continuous control from orbit to the ground.
//  drag = move over the planet · right-drag / shift-drag = turn and tilt · scroll = zoom
//  click = fly to that spot · idle (or wallpaper mode) = the director takes over
import * as THREE from 'three';
import { R, EXAG, dirOf, latLonOf } from './terrain.js';
import { mulberry32, smoothstep } from '../world.js';

const MIN_ALT = 0.03, MAX_ALT = 40000;   // km above the ground
const IDLE_TO_DIRECTOR = 45;             // seconds without input

export function makePlanetCamera(camera, dom, terrain, { seed = 1, wallpaper = false, view = null } = {}) {
  const s = { lat: 0.35, lon: 0.4, alt: 21000, heading: 0, pitchOff: 0, ground: 0 };
  if (view) Object.assign(s, view);
  let fly = null, idle = 0, director = wallpaper, dirTimer = 0, dirIndex = 0;
  const pinned = !!view && wallpaper;

  // Interesting places for the director: mountains and coastlines on land.
  const rnd = mulberry32(seed ^ 0xd1ec7);
  const spots = [];
  const V = new THREE.Vector3();
  for (let i = 0; i < 600; i++) {
    const lat = Math.asin(rnd() * 2 - 1) * 0.9, lon = rnd() * Math.PI * 2 - Math.PI;
    dirOf(lat, lon, V);
    const e = terrain.elevation(V.x, V.y, V.z, 3);
    if (e > 0.1) spots.push({ lat, lon, score: e + (e < 0.4 ? 1.5 : 0) + rnd() });
  }
  spots.sort((a, b) => b.score - a.score);
  const tour = spots.slice(0, 24);

  const up = new THREE.Vector3(), east = new THREE.Vector3(), north = new THREE.Vector3(), fwd = new THREE.Vector3();
  function basis(lat, lon) {
    dirOf(lat, lon, up);
    east.set(-Math.sin(lon), 0, -Math.cos(lon));
    north.crossVectors(up, east); // up × east points north
  }
  const groundAt = (lat, lon) => { dirOf(lat, lon, V); return Math.max(0, terrain.elevation(V.x, V.y, V.z, 8)) * EXAG; };
  const pitchFor = (alt) => smoothstep(Math.log(4000), Math.log(15), Math.log(alt)) * 1.3;

  function move(dNorth, dEast) {
    const h = s.heading;
    const n = dNorth * Math.cos(h) - dEast * Math.sin(h), e = dNorth * Math.sin(h) + dEast * Math.cos(h);
    s.lat = Math.max(-1.5, Math.min(1.5, s.lat + n));
    s.lon += e / Math.max(0.05, Math.cos(s.lat));
  }
  const panRate = () => Math.min(0.003, ((s.alt * 1.2 + 0.3) / R) * 0.0025);
  const wake = () => { idle = 0; if (!wallpaper) director = false; };

  // --- Input ----------------------------------------------------------------------
  let down = null;
  dom.addEventListener('contextmenu', (e) => e.preventDefault());
  dom.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, b: e.button, shift: e.shiftKey, moved: false }; dom.setPointerCapture(e.pointerId); wake(); });
  dom.addEventListener('pointermove', (e) => {
    if (!down) return;
    const dx = e.clientX - down.x, dy = e.clientY - down.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) down.moved = true;
    down.x = e.clientX; down.y = e.clientY;
    fly = null;
    if (down.b === 2 || down.shift) { s.heading += dx * 0.005; s.pitchOff = Math.max(-0.6, Math.min(0.6, s.pitchOff - dy * 0.003)); }
    else { const k = panRate(); move(dy * k, -dx * k); }
    wake();
  });
  dom.addEventListener('pointerup', (e) => {
    if (down && !down.moved && down.b === 0) flyToScreen(e.clientX, e.clientY);
    down = null;
  });
  dom.addEventListener('wheel', (e) => {
    e.preventDefault();
    fly = null;
    s.alt = Math.max(MIN_ALT, Math.min(MAX_ALT, s.alt * Math.exp(e.deltaY * 0.0012)));
    wake();
  }, { passive: false });
  const keys = new Set();
  addEventListener('keydown', (e) => { if (e.target.closest?.('input,button,dialog')) return; keys.add(e.key.toLowerCase()); wake(); });
  addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));

  // --- Flying ---------------------------------------------------------------------
  const ray = new THREE.Raycaster();
  function flyToScreen(x, y) {
    const rect = dom.getBoundingClientRect();
    ray.setFromCamera(new THREE.Vector2(((x - rect.left) / rect.width) * 2 - 1, -((y - rect.top) / rect.height) * 2 + 1), camera);
    const o = ray.ray.origin, d = ray.ray.direction;
    const b = o.dot(d), c = o.lengthSq() - R * R, disc = b * b - c;
    if (disc < 0) return;                                  // clicked space
    const hit = o.clone().addScaledVector(d, -b - Math.sqrt(disc));
    const { lat, lon } = latLonOf(hit);
    flyTo(lat, lon, Math.max(0.4, s.alt * 0.3));
  }
  function flyTo(lat, lon, alt, dur) {
    const from = dirOf(s.lat, s.lon), to = dirOf(lat, lon);
    const arc = from.angleTo(to);
    fly = { from, to, a0: s.alt, a1: alt, t: 0, dur: dur ?? 2 + arc * 1.5, lift: arc * R * 0.35 };
  }
  const Q = new THREE.Quaternion(), D = new THREE.Vector3();
  function stepFly(dt) {
    fly.t = Math.min(1, fly.t + dt / fly.dur);
    const k = fly.t < 0.5 ? 4 * fly.t ** 3 : 1 - (-2 * fly.t + 2) ** 3 / 2;  // ease in-out
    D.copy(fly.from).lerp(fly.to, k).normalize();                          // great-circle-ish
    const ll = latLonOf(D);
    s.lat = ll.lat; s.lon = ll.lon;
    s.alt = Math.exp(Math.log(fly.a0) + (Math.log(fly.a1) - Math.log(fly.a0)) * k) + fly.lift * Math.sin(Math.PI * k);
    if (fly.t >= 1) fly = null;
  }

  // --- Director (wallpaper / idle) ----------------------------------------------------
  function stepDirector(dt) {
    s.heading += dt * 0.025;
    s.pitchOff *= 0.98;
    if (pinned) return;                                     // pinned view: stay, turn slowly
    dirTimer -= dt;
    if (!fly && dirTimer <= 0 && tour.length) {
      const p = tour[dirIndex++ % tour.length];
      flyTo(p.lat, p.lon, 25 + rnd() * 140, 9);
      dirTimer = 32;
    }
  }

  // --- Per frame ------------------------------------------------------------------------
  function update(dt) {
    idle += dt;
    if (!director && idle > IDLE_TO_DIRECTOR) { director = true; dirTimer = 0; }
    const k = panRate() * 6;
    if (keys.has('w') || keys.has('arrowup')) move(k, 0);
    if (keys.has('s') || keys.has('arrowdown')) move(-k, 0);
    if (keys.has('a') || keys.has('arrowleft')) move(0, -k);
    if (keys.has('d') || keys.has('arrowright')) move(0, k);
    if (keys.has('q')) s.heading -= dt; if (keys.has('e')) s.heading += dt;
    if (keys.has('=') || keys.has('+')) s.alt = Math.max(MIN_ALT, s.alt * (1 - dt)); if (keys.has('-')) s.alt = Math.min(MAX_ALT, s.alt * (1 + dt));
    if (fly) stepFly(dt);
    if (director) stepDirector(dt);

    s.ground += (groundAt(s.lat, s.lon) - s.ground) * Math.min(1, dt * 6);
    basis(s.lat, s.lon);
    const pitch = Math.max(0, Math.min(1.45, pitchFor(s.alt) + s.pitchOff));
    fwd.copy(north).multiplyScalar(Math.cos(s.heading)).addScaledVector(east, Math.sin(s.heading));
    camera.position.copy(up).multiplyScalar(R + s.ground + s.alt);
    const look = up.clone().multiplyScalar(-Math.cos(pitch)).addScaledVector(fwd, Math.sin(pitch));
    camera.up.copy(fwd).lerp(up, Math.sin(pitch)).normalize();
    camera.lookAt(camera.position.clone().add(look));
    return s;
  }

  return {
    update, flyTo, state: s,
    get director() { return director; },
    setDirector(on) { director = on; idle = 0; dirTimer = 0; },
    view: () => ({ lat: +s.lat.toFixed(5), lon: +s.lon.toFixed(5), alt: +s.alt.toFixed(3), heading: +s.heading.toFixed(3) }),
  };
}
