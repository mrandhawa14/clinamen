// Terrarium planet: the whole world, from orbit down to the ground.
// URL: ?seed=<text>  ?mode=wallpaper  ?view=lat,lon,altKm,headingDeg (pins a spot)  ?date=<ISO>
import * as THREE from 'three';
import { hashString } from '../world.js';
import { makeTerrain, dirOf, R } from './terrain.js';
import { makePlanetLOD } from './lod.js';
import { makePlanetCamera } from './camera.js';
import { makePlanetSky } from './sky.js';

const params = new URLSearchParams(location.search);
const seedText = params.get('seed') || 'terrarium';
const seed = hashString(seedText);
const wallpaper = params.get('mode') === 'wallpaper';
const deg = Math.PI / 180;
let view = null;
if (params.get('view')) {
  const [la, lo, alt, hd] = params.get('view').split(',').map(Number);
  if ([la, lo, alt].every(Number.isFinite)) view = { lat: la * deg, lon: lo * deg, alt, heading: (hd || 0) * deg };
}
const fixedDate = params.get('date') ? new Date(params.get('date')) : null;

const renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, wallpaper ? 1.5 : 2));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.005, 300000);
const terrain = makeTerrain(seed);
const lod = makePlanetLOD(terrain, { seed });
scene.add(lod.group);
const sky = makePlanetSky(scene);
const cam = makePlanetCamera(camera, renderer.domElement, terrain, { seed, wallpaper, view });

// --- HUD -----------------------------------------------------------------------------
const $ = (id) => document.getElementById(id);
if (wallpaper) document.body.classList.add('wallpaper');
$('seed').textContent = seedText;
$('space').addEventListener('click', () => cam.flyTo(cam.state.lat, cam.state.lon, 21000, 3));
$('director').addEventListener('click', () => cam.setDirector(!cam.director));
$('newworld').addEventListener('click', () => { params.set('seed', Math.random().toString(36).slice(2, 8)); params.delete('view'); location.search = params.toString(); });
$('pin').addEventListener('click', async () => {
  const v = cam.view();
  const u = new URL(location.href);
  u.searchParams.set('view', [v.lat / deg, v.lon / deg, v.alt, v.heading / deg].map((x) => +x.toFixed(4)).join(','));
  u.searchParams.set('mode', 'wallpaper');
  try { await navigator.clipboard.writeText(u.href); $('pin').textContent = 'Link copied'; } catch { $('pin').textContent = 'Copy failed'; }
  setTimeout(() => { $('pin').textContent = 'Pin as wallpaper'; }, 2000);
});
addEventListener('keydown', (e) => { if (e.key === 'h' && !e.target.closest?.('input')) document.body.classList.toggle('clean'); });

const fmtAlt = (km) => (km >= 10 ? `${Math.round(km).toLocaleString()} km` : km >= 1 ? `${km.toFixed(1)} km` : `${Math.round(km * 1000)} m`);
const fmtLat = (r) => `${Math.abs(r / deg).toFixed(1)}° ${r >= 0 ? 'N' : 'S'}`;
const fmtLon = (r) => { let d = ((r / deg + 540) % 360) - 180; return `${Math.abs(d).toFixed(1)}° ${d >= 0 ? 'E' : 'W'}`; };
const NAMES = { sea: 'Ocean', sand: 'Beach', rock: 'Rock', snow: 'Snow and ice', tundra: 'Tundra', desert: 'Desert', savanna: 'Savanna', grass: 'Grassland', forest: 'Forest', jungle: 'Rainforest' };
const V = new THREE.Vector3();

// --- Loop ------------------------------------------------------------------------------
const clock = new THREE.Clock();
let acc = 0, hudT = 0;
const FPS = wallpaper ? 20 : 60;
renderer.setAnimationLoop(() => {
  const dt = clock.getDelta();
  if (document.hidden) return;
  acc += dt;
  if (acc < 1 / FPS - 0.002) return;
  const step = Math.min(acc, 0.1); acc = 0;
  const s = cam.update(step);
  const stats = lod.update(camera.position);
  sky.update(fixedDate || new Date(), camera.position, s.alt);
  renderer.render(scene, camera);
  if ((hudT += step) > 0.2) {
    hudT = 0;
    dirOf(s.lat, s.lon, V);
    const e = terrain.elevation(V.x, V.y, V.z, 6);
    $('where').textContent = `${fmtAlt(s.alt)} up · ${fmtLat(s.lat)}, ${fmtLon(s.lon)} · ${s.alt < 3000 ? NAMES[terrain.biome(V.x, V.y, V.z, e, 1)] : 'Orbit'}`;
    $('director').classList.toggle('on', cam.director);
    window.__planet.stats = stats;
  }
});

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

window.__planet = { ready: true, cam, terrain, R, stats: null };
