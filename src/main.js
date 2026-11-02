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

const params = new URLSearchParams(location.search);
const seedText = params.get('seed') || 'terrarium';
const seed = hashString(seedText);
// Location: URL ?lat=&lon=, else approximate longitude from the time zone.
const lat = parseFloat(params.get('lat') ?? '45');
const lon = parseFloat(params.get('lon') ?? String((-new Date(new Date().getFullYear(), 0, 1).getTimezoneOffset() / 60) * 15) /* standard time, ignores DST */);
const FPS = 30;

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

// --- Time state -----------------------------------------------------------
const $ = (id) => document.getElementById(id);
const fixed = params.get('date') ? new Date(params.get('date')) : null;
const state = { live: !fixed, date: fixed || new Date() };
let lastDoy = -1;

const dayOfYear = (d) => Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 864e5);

function syncSliders() {
  $('time').value = state.date.getHours() * 60 + state.date.getMinutes();
  $('day').value = dayOfYear(state.date);
}
function fromSliders() {
  const y = state.date.getFullYear(), mins = +$('time').value;
  state.date = new Date(y, 0, +$('day').value, Math.floor(mins / 60), mins % 60);
  state.live = false;
  $('live').classList.remove('on');
}
$('time').addEventListener('input', fromSliders);
$('day').addEventListener('input', fromSliders);
$('live').addEventListener('click', () => { state.live = true; $('live').classList.add('on'); });
$('live').classList.toggle('on', state.live);
$('seed').textContent = seedText;
$('newworld').addEventListener('click', () => {
  params.set('seed', Math.random().toString(36).slice(2, 8));
  location.search = params.toString();
});
addEventListener('keydown', (e) => {
  if (e.key === 'h') document.body.classList.toggle('clean');
  if (e.key === 'n') $('newworld').click();
});
if (params.get('ui') === '0') document.body.classList.add('clean');

const fmt = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

function updateWorld() {
  if (state.live) { state.date = new Date(); syncSliders(); }
  const doy = dayOfYear(state.date);
  const season = seasonState(doy, lat);
  if (doy !== lastDoy) { diorama.applySeason(season); lastDoy = doy; }
  sky.update(state.date, lat, lon);
  $('label').textContent = `${fmt.format(state.date)} · ${season.early}${season.name.toLowerCase()}`;
}
syncSliders();

// --- Loop (capped FPS, paused when hidden: it's meant to run all day) -------
const clock = new THREE.Clock();
let acc = 0, t = 0;
renderer.setAnimationLoop(() => {
  const dt = clock.getDelta();
  if (document.hidden) return;
  acc += dt;
  if (acc < 1 / FPS) return;
  t += acc; acc = 0;
  updateWorld();
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

window.__terrarium = { counts: diorama.counts, ready: true };
