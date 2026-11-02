import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { HorizontalTiltShiftShader } from 'three/addons/shaders/HorizontalTiltShiftShader.js';
import { VerticalTiltShiftShader } from 'three/addons/shaders/VerticalTiltShiftShader.js';
import { makeHeightFn, hashString, seasonState } from './world.js';
import { buildDiorama } from './diorama.js';
import { buildSky } from './sky.js';
import {
  MODULES, DAY_MS, createWorld, loadWorld, saveWorld, step, seaLevel,
  status, activate, undo, undoWouldRemove, prune,
} from './upgrades.js';

const params = new URLSearchParams(location.search);
const seedText = params.get('seed') || 'terrarium';
const seed = hashString(seedText);
// Location: URL ?lat=&lon=, else approximate longitude from the time zone.
const lat = parseFloat(params.get('lat') ?? '45');
const lon = parseFloat(params.get('lon') ?? String((-new Date(new Date().getFullYear(), 0, 1).getTimezoneOffset() / 60) * 15) /* standard time, ignores DST */);
const SPEED = Math.max(0, parseFloat(params.get('speed') ?? '1')); // dev: world-time multiplier
const FPS = 30;
const WORLD_YEAR_DAYS = 60; // with Seasons on, one world year = 60 world days (~2 real hours)

// --- Renderer / scene --------------------------------------------------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(26, innerWidth / innerHeight, 1, 400);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, -0.6, 0);
controls.enableDamping = true;
controls.enablePan = false;
controls.autoRotate = params.get('rotate') !== '0';
controls.autoRotateSpeed = 0.25;
controls.minPolarAngle = 0.35;
controls.maxPolarAngle = 1.25;
controls.minDistance = 25;
controls.maxDistance = 90;

function frameCamera() {
  const aspect = innerWidth / innerHeight;
  const dist = 44 / Math.min(1, aspect * 0.85);
  camera.position.setFromSphericalCoords(dist, 0.95, 0.6).add(controls.target);
}
frameCamera();

const height = makeHeightFn(seed);
const diorama = buildDiorama(height, seed);
scene.add(diorama.group);
const sky = buildSky(scene);

// --- Tilt-shift (miniature look) ------------------------------------------
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const hTilt = new ShaderPass(HorizontalTiltShiftShader);
const vTilt = new ShaderPass(VerticalTiltShiftShader);
composer.addPass(hTilt);
composer.addPass(vTilt);
composer.addPass(new OutputPass());
const TILT = 2.2;
function sizeTilt() {
  hTilt.uniforms.h.value = TILT / innerWidth;
  vTilt.uniforms.v.value = TILT / innerHeight;
  hTilt.uniforms.r.value = vTilt.uniforms.r.value = 0.5;
}
sizeTilt();

// --- The world (state, laws, saving) ----------------------------------------
const geo = diorama.geo;
let world = loadWorld(seed, geo) || createWorld(seed, geo, Date.now());
// Catch up on the time the world was closed: it kept growing.
step(world, geo, ((Date.now() - world.lastReal) / DAY_MS) * SPEED);
world.lastReal = Date.now();
prune(world, Date.now());
saveWorld(world);
addEventListener('pagehide', () => saveWorld(world));

// --- Sky time (time of day only; world time drives growth and seasons) -------
const $ = (id) => document.getElementById(id);
const fixed = params.get('date') ? new Date(params.get('date')) : null;
const clockState = { live: !fixed, date: fixed || new Date() };

function syncSlider() { $('time').value = clockState.date.getHours() * 60 + clockState.date.getMinutes(); }
$('time').addEventListener('input', () => {
  const mins = +$('time').value, d = new Date(clockState.date);
  d.setHours(Math.floor(mins / 60), mins % 60);
  clockState.date = d; clockState.live = false;
  $('live').classList.remove('on');
});
$('live').addEventListener('click', () => { clockState.live = true; $('live').classList.add('on'); });
$('live').classList.toggle('on', clockState.live);
$('seed').textContent = seedText;
$('newworld').addEventListener('click', () => {
  params.set('seed', Math.random().toString(36).slice(2, 8));
  location.search = params.toString();
});
addEventListener('keydown', (e) => {
  if (e.target.closest?.('dialog')) return;
  if (e.key === 'h') document.body.classList.toggle('clean');
  if (e.key === 'n') $('newworld').click();
});
if (params.get('ui') === '0') document.body.classList.add('clean');
syncSlider();

// --- Laws panel (upgrades) ----------------------------------------------------
const fmtLeft = (ms) => {
  const h = Math.floor(ms / 3600_000), m = Math.floor((ms % 3600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};
const nameOf = (id) => MODULES.find((m) => m.id === id)?.name ?? id;
const dateOf = (ms) => new Date(ms).toLocaleString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' });

function ask(title, body, okLabel) {
  const dlg = $('confirm');
  $('ctitle').textContent = title;
  $('cbody').textContent = body;
  $('cok').textContent = okLabel;
  dlg.showModal();
  return new Promise((resolve) => dlg.addEventListener('close', () => resolve(dlg.returnValue === 'ok'), { once: true }));
}

async function onLaw(id) {
  const now = Date.now(), st = status(world, id, now);
  if (st.state === 'available') {
    const ok = await ask(`Turn on ${nameOf(id)}?`,
      'It starts changing your world right away, and the world will grow with it. ' +
      'You can undo it for the next 2 days. After that it can never be turned off.', 'Turn on');
    if (ok && activate(world, id, Date.now())) saveWorld(world);
  } else if (st.state === 'undoable') {
    const gone = undoWouldRemove(world, id, now);
    const h = world.history.find((x) => x.id === id);
    const also = gone.length > 1 ? ` This also removes ${gone.slice(1).map(nameOf).join(' and ')}, turned on after it.` : '';
    const ok = await ask(`Undo ${nameOf(id)}?`,
      `Your world goes back to how it was on ${dateOf(h.at)}, before ${nameOf(id)} existed. ` +
      `Everything that happened since is lost.${also}`, 'Undo');
    if (ok && undo(world, id, Date.now())) saveWorld(world);
  }
  renderLaws();
}

function renderLaws() {
  const now = Date.now(), sea = seaLevel(world, geo);
  $('laws').innerHTML = '';
  for (const m of MODULES) {
    const st = status(world, m.id, now);
    const row = document.createElement('div');
    row.className = 'law';
    let note = '';
    if (st.state !== 'available' && m.id === 'life' && (sea === null || world.res.ocean < 0.25 * world.res.water)) note = 'Waiting for water';
    const btn = st.state === 'available' ? `<button data-id="${m.id}">Turn on</button>`
      : st.state === 'undoable' ? `<button class="undo" data-id="${m.id}">Undo · ${fmtLeft(st.left)} left</button>`
      : '<span class="perm">Permanent</span>';
    row.innerHTML = `<div class="lawhead"><b>${m.name}</b>${btn}</div><div class="blurb">${note ? `<em>${note}.</em> ` : ''}${m.blurb}</div>`;
    $('laws').append(row);
  }
  $('laws').querySelectorAll('button[data-id]').forEach((b) => b.addEventListener('click', () => onLaw(b.dataset.id)));
}
renderLaws();
setInterval(() => { prune(world, Date.now()); renderLaws(); }, 30_000);

// --- Per-frame world update -----------------------------------------------------
const fmt = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' });
const SUMMER = seasonState(180, lat);

function currentView() {
  const season = world.on.seasons
    ? seasonState(1 + Math.floor(((world.day % WORLD_YEAR_DAYS) / WORLD_YEAR_DAYS) * 365), lat)
    : SUMMER; // no tilt: the year never turns
  return { season, sea: seaLevel(world, geo), veg: world.veg };
}

function updateLabels(view) {
  const y = Math.floor(world.day / WORLD_YEAR_DAYS) + 1, d = Math.floor(world.day % WORLD_YEAR_DAYS) + 1;
  const ocean = world.res.water ? Math.round((world.res.ocean / world.res.water) * 100) : 0;
  const trees = world.veg.filter((g) => g >= 0.3).length;
  const parts = [`Year ${y}, day ${d}`];
  if (world.on.seasons) parts.push(`${view.season.early}${view.season.name.toLowerCase()}`);
  parts.push(view.sea === null ? 'dry' : `ocean ${ocean}%`);
  if (world.on.life) parts.push(`${trees} trees`);
  $('worldline').textContent = parts.join(' · ');
  $('label').textContent = fmt.format(clockState.date);
}

// --- Loop (capped FPS, paused when hidden: it's meant to run all day) -------
const clock = new THREE.Clock();
let acc = 0, t = 0, lastSave = 0;
renderer.setAnimationLoop(() => {
  const dt = clock.getDelta();
  if (document.hidden) return;
  acc += dt;
  if (acc < 1 / FPS) return;
  const now = Date.now();
  step(world, geo, ((now - world.lastReal) / DAY_MS) * SPEED);
  world.lastReal = now;
  if (now - lastSave > 5000) { saveWorld(world); lastSave = now; }

  t += acc; acc = 0;
  if (clockState.live) { clockState.date = new Date(); syncSlider(); }
  sky.update(clockState.date, lat, lon);
  const view = currentView();
  diorama.show(view);
  updateLabels(view);
  diorama.tick(t);
  controls.update();
  composer.render();
});

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
  sizeTilt();
});

// Hooks for automated checks.
window.__terrarium = {
  ready: true,
  counts: diorama.counts,
  get world() { return world; },
  advance(days) { step(world, geo, days); world.lastReal = Date.now(); renderLaws(); },
  activate(id) { const r = activate(world, id, Date.now()); renderLaws(); return r; },
  undo(id) { const r = undo(world, id, Date.now()); renderLaws(); return r; },
  status(id) { return status(world, id, Date.now()); },
  ageActivation(id, ms) { const h = world.history.find((x) => x.id === id); if (h) h.at -= ms; prune(world, Date.now()); renderLaws(); },
  save() { saveWorld(world); },
};
