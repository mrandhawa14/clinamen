// Asset gallery: view, play and scrub every procedural asset on its own.
// URL: assets.html?asset=<id>&t=<0..1> freezes an asset at a moment (used for checks).
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { makeHeightFn, hashString, seasonState, smoothstep, mulberry32 } from './world.js';
import { buildDiorama } from './diorama.js';
import { buildSky } from './sky.js';
import { makePlanet, makeMoon } from './assets/bodies.js';
import { makeWaterFromSpace, makeMoonImpact, makeAsteroidStrike, makeFirstLife, makeRain } from './assets/events.js';
import { makeGasCloud, makeStar, makeSupernova } from './assets/cosmic.js';
import { ICONS, STATES, iconSvg } from './assets/icons.js';

const ASSETS = [
  { group: 'Accident events', id: 'water', name: 'Water from space', scene: 'space', dur: 12, cam: [3, 5, 19],
    caption: 'Icy comets and asteroids likely brought much of Earth’s water after its crust cooled. Each hit bursts into steam; then oceans fill the low ground.',
    make: () => makeWaterFromSpace() },
  { id: 'theia', name: 'Moon-forming impact', scene: 'space', dur: 14, cam: [0, 10, 27],
    caption: 'A Mars-sized body (Theia) hits the young, molten planet. The debris forms a ring; inner debris orbits faster (Kepler’s law) and the ring gathers into a moon.',
    make: () => makeMoonImpact() },
  { id: 'asteroid', name: 'Asteroid strike', scene: 'island', veg: 1, dur: 10,
    caption: 'Fireball entry, a flash, a shockwave racing along the ground, a column of dust, and a crater with a raised rim.',
    make: (c) => makeAsteroidStrike({ height: c.height }) },
  { id: 'life', name: 'Life starts', scene: 'island', veg: 0, dur: 12,
    caption: 'The first life: microbial mats in warm, shallow water, spreading out from the spot where it began.',
    make: (c) => makeFirstLife({ height: c.height }) },
  { id: 'rain', name: 'Rain', scene: 'island', veg: 1, dur: 6,
    caption: 'Weather, reusable by any accident that brings water: rain over the island.',
    make: () => { const r = makeRain(); return { object: r.object, update: (t, time) => r.update(t, time, 1) }; } },

  { group: 'Bodies', id: 'planet', name: 'Young planet', scene: 'space', dur: 10, cam: [0, 3, 14],
    caption: 'Molten (lava through cracks in the crust) → cooled crust → oceans filling the low ground.',
    make: () => {
      const p = makePlanet({ radius: 3 });
      return { object: p.group, update(t, time) {
        if (t < 0.33) p.setState('molten'); else if (t < 0.55) p.setState('crust'); else p.setState('ocean', smoothstep(0.55, 0.95, t));
        p.group.rotation.y = time * 0.1;
      } };
    } },
  { id: 'moon', name: 'Moon', scene: 'space', dur: 6, cam: [0, 1, 6],
    caption: 'Grey, cratered, with raised crater rims.',
    make: () => { const m = makeMoon({ radius: 1.4 }); return { object: m, update: (t, time) => { m.rotation.y = time * 0.2; } }; } },

  { group: 'Cosmic', id: 'gas', name: 'Hydrogen cloud collapsing', scene: 'void', dur: 14, cam: [0, 12, 30],
    caption: 'The first gas was about ¾ hydrogen and ¼ helium. Gravity pulls the densest filaments into clumps, where stars will form. Red is hydrogen’s 656 nm glow; yellow, helium’s 588 nm.',
    make: () => makeGasCloud() },
  { id: 'ignite', name: 'Star ignites', scene: 'void', dur: 8, cam: [0, 0, 20],
    caption: 'A dim protostar heats until hydrogen fusion starts in its core, then shines steadily.',
    make: () => makeStar({ temperature: 5800, radius: 1 }) },
  { id: 'stars', name: 'Star colours', scene: 'void', dur: 8, cam: [0, 1.5, 24],
    caption: 'Colour comes from surface temperature (black-body): 3,200 K red dwarf, 5,800 K like the Sun, 20,000 K blue giant.',
    make: () => {
      const g = new THREE.Group();
      const stars = [[3200, 0.5, -5], [5800, 0.8, 0], [20000, 1.3, 5.5]].map(([K, r, x]) => {
        const s = makeStar({ temperature: K, radius: r }); s.object.position.x = x; g.add(s.object); return s;
      });
      return { object: g, update: (t, time) => stars.forEach((s) => s.update(1, time)) };
    } },
  { id: 'supernova', name: 'Supernova', scene: 'void', dur: 14, cam: [0, 5, 32],
    caption: 'A massive star swells, collapses and explodes, throwing out the elements it forged: oxygen (teal), sulfur (orange), hydrogen (red). A neutron star is left.',
    make: () => makeSupernova() },

  { group: 'Accident tree', id: 'icons', name: 'Icons', scene: 'icons',
    caption: 'One icon per accident, in each state of the accident tree.' },
];

// --- Renderer ------------------------------------------------------------------
const main = document.getElementById('main');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
main.prepend(renderer.domElement);
const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 600);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
function resize() {
  const w = main.clientWidth, h = main.clientHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);

// --- Scenes ------------------------------------------------------------------------
const islandSeed = hashString('terrarium');
const height = makeHeightFn(islandSeed);

function starfield(n = 1500) {
  const rnd = mulberry32(99), p = [];
  for (let i = 0; i < n; i++) {
    const u = rnd() * 2 - 1, th = rnd() * Math.PI * 2, s = Math.sqrt(1 - u * u), r = 250;
    p.push(Math.cos(th) * s * r, u * r, Math.sin(th) * s * r);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  return new THREE.Points(g, new THREE.PointsMaterial({ color: '#cfd8ff', size: 1.2, sizeAttenuation: false }));
}

function buildScene(a) {
  const scene = new THREE.Scene();
  const ctx = { height };
  if (a.scene === 'island') {
    const d = buildDiorama(height, islandSeed);
    const veg = new Array(d.geo.spots.length).fill(a.veg), summer = seasonState(180, 45);
    d.show({ season: summer, sea: 0, veg });
    scene.add(d.group);
    ctx.afterUpdate = (asset, t) => {
      const b = asset.blast;
      if (!b) return;
      const burnt = d.geo.spots.map((s, i) => (t >= b.at && Math.hypot(s.x - b.x, s.z - b.z) < b.radius ? 0 : veg[i]));
      d.show({ season: summer, sea: 0, veg: burnt });
    };
    buildSky(scene).update(new Date('2026-07-15T13:00'), 45, -75);
    ctx.tick = d.tick;
    camera.position.setFromSphericalCoords(44, 0.95, 0.6).add(new THREE.Vector3(0, -0.6, 0));
    controls.target.set(0, -0.6, 0);
  } else {
    scene.background = new THREE.Color(a.scene === 'void' ? '#030308' : '#05060c');
    scene.add(starfield());
    const sun = new THREE.DirectionalLight('#fff4e0', 3);
    sun.position.set(-8, 4, 10);
    scene.add(sun, new THREE.HemisphereLight('#5d6c8f', '#1a1410', 0.5));
    camera.position.set(...a.cam);
    controls.target.set(0, 0, 0);
  }
  const asset = a.make(ctx);
  scene.add(asset.object);
  return { scene, asset, ctx };
}

// --- Icons view --------------------------------------------------------------------
function renderIcons() {
  const labels = { possible: 'Possible now', notyet: 'Not yet', happened: 'Happened', missed: 'Missed' };
  document.getElementById('icons').innerHTML =
    `<p class="legend">Colour shows the state in the accident tree. "Not yet" is faded; "missed" is struck through and stays locked in that world.</p>
     <table><tr><th></th>${STATES.map((s) => `<th>${labels[s]}</th>`).join('')}</tr>
     ${Object.entries(ICONS).map(([id, ic]) => `<tr><td>${ic.name}</td>${STATES.map((s) => `<td>${iconSvg(id, s)}</td>`).join('')}</tr>`).join('')}</table>`;
}

// --- Selection, playback -------------------------------------------------------------
const params = new URLSearchParams(location.search);
const frozenT = params.has('t') ? parseFloat(params.get('t')) : null;
let current = null, playing = frozenT === null, progress = frozenT ?? 0;
const $ = (id) => document.getElementById(id);

function select(id) {
  const a = ASSETS.find((x) => x.id === id) || ASSETS[0];
  document.querySelectorAll('nav button').forEach((b) => b.classList.toggle('on', b.dataset.id === a.id));
  $('title').textContent = a.name;
  $('caption').textContent = a.caption;
  const iconMode = a.scene === 'icons';
  $('icons').style.display = iconMode ? 'block' : 'none';
  $('controls').style.display = renderer.domElement.style.display = iconMode ? 'none' : '';
  document.querySelector('.info').style.display = iconMode ? 'none' : '';
  if (iconMode) { renderIcons(); current = { a }; return; }
  current = { a, ...buildScene(a) };
  if (frozenT === null) progress = 0;
  resize();
  const u = new URL(location); u.searchParams.set('asset', a.id); history.replaceState(null, '', u);
}

let lastGroup = null;
for (const a of ASSETS) {
  if (a.group && a.group !== lastGroup) {
    lastGroup = a.group;
    const h = document.createElement('h2'); h.textContent = a.group; $('nav').append(h);
  }
  const b = document.createElement('button');
  b.textContent = a.name; b.dataset.id = a.id;
  b.addEventListener('click', () => select(a.id));
  $('nav').append(b);
}

$('play').addEventListener('click', () => { playing = !playing; $('play').textContent = playing ? 'Pause' : 'Play'; });
$('play').textContent = playing ? 'Pause' : 'Play';
$('scrub').addEventListener('input', () => { progress = $('scrub').value / 1000; playing = false; $('play').textContent = 'Play'; });

const clock = new THREE.Clock();
let time = 0;
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.1);
  time += dt;
  if (!current?.asset) return;
  if (playing) progress = (progress + dt / current.a.dur) % 1.08; // short hold at the end
  const t = Math.min(1, progress);
  current.asset.update(t, time);
  current.ctx.afterUpdate?.(current.asset, t);
  current.ctx.tick?.(time);
  $('scrub').value = Math.round(t * 1000);
  $('pct').textContent = `${Math.round(t * 100)}%`;
  controls.update();
  renderer.render(current.scene, camera);
});

select(params.get('asset') || 'water');
window.__gallery = { ready: true, ids: ASSETS.map((a) => a.id), select };
