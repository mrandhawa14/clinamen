// The world's state, its laws (modules) and the upgrade rules.
//
// Rules:
// - A world grows only from the resources it started with.
// - Modules are optional upgrades. Turning one on starts its reaction in the world
//   and cannot be switched off.
// - For 2 days (real time) after turning a module on, it can be undone. Undo
//   reverts the world to the moment before the module existed.
// - After 2 days the module is permanent.
import { mulberry32 } from './world.js';

export const DAY_MS = 120_000;                  // 1 world day = 2 real minutes
export const UNDO_WINDOW_MS = 48 * 3600_000;    // 2 days
const FILL_DAYS = 3;        // oceans condense over ~3 world days
const GROW_DAYS = 6;        // a sapling takes ~6 world days to grow
const SPREAD_PER_DAY = 0.35;
const MAX_CATCHUP_DAYS = 3000;

export const MODULES = [
  { id: 'water', name: 'Water', version: 1,
    blurb: 'Vapour in the young atmosphere condenses into oceans. How deep they get depends on how much water this world has.' },
  { id: 'life', name: 'Plant life', version: 1,
    blurb: 'Seeds take root near the shore and spread while the soil can feed them. Needs water.' },
  { id: 'seasons', name: 'Seasons', version: 1,
    blurb: 'The planet tilts. The year turns through spring, summer, autumn and winter.' },
];

const STORE_KEY = (seed) => `clinamen.world.${seed}`;

function rand(w) {
  let a = (w.rng = (w.rng + 0x6d2b79f5) | 0);
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** A new world: barren rock, with this world's fixed starting resources. */
export function createWorld(seed, geo, now) {
  const r = mulberry32(seed ^ 0x5eed);
  return {
    v: 1, seed, day: 0, lastReal: now, rng: seed | 0,
    on: {},
    res: {
      water: geo.volumeAt(-0.3 + r() * 0.5),                      // total water this world will ever have
      ocean: 0,                                                   // how much of it has condensed so far
      soil: Math.round(geo.spots.length * (0.45 + r() * 0.5)),    // how many trees the soil can feed
    },
    veg: new Array(geo.spots.length).fill(0),                     // growth 0..1 per tree spot
    history: [],                                                  // activations still inside their undo window
  };
}

export function seaLevel(w, geo) {
  return w.res.ocean > 1e-6 ? geo.levelFor(w.res.ocean) : null;
}

export function step(w, geo, days) {
  days = Math.min(days, MAX_CATCHUP_DAYS);
  while (days > 1e-9) { const d = Math.min(days, 0.25); tick(w, geo, d); days -= d; }
}

function tick(w, geo, d) {
  w.day += d;
  if (w.on.water && w.res.ocean < w.res.water) {
    w.res.ocean = Math.min(w.res.water, w.res.ocean + (w.res.water * d) / FILL_DAYS);
  }
  const sea = seaLevel(w, geo);
  if (!w.on.life || sea === null || w.res.ocean < 0.25 * w.res.water) return; // life waits for water
  const spots = geo.spots, veg = w.veg;
  const habitable = (i) => spots[i].y > sea + 0.3;

  let plants = 0; // living plants, of any size: the soil feeds this many at most
  for (let i = 0; i < veg.length; i++) {
    if (veg[i] > 0 && spots[i].y < sea + 0.15) veg[i] = 0; // drowned
    if (veg[i] > 0) plants++;
  }
  if (plants === 0) {
    // First seeds wash up on the lowest habitable ground.
    const cand = spots.map((_, i) => i).filter(habitable).sort((a, b) => spots[a].y - spots[b].y).slice(0, 12);
    for (let k = 0; k < 3 && cand.length; k++) veg[cand.splice(Math.floor(rand(w) * cand.length), 1)[0]] = 0.01;
    return;
  }
  for (let i = 0; i < veg.length; i++) {
    if (veg[i] > 0 && veg[i] < 1) veg[i] = Math.min(1, veg[i] + d / GROW_DAYS);
    if (veg[i] >= 0.6 && plants < w.res.soil && rand(w) < SPREAD_PER_DAY * d) {
      const nb = spots[i].nbrs;
      if (!nb.length) continue;
      const j = nb[Math.floor(rand(w) * nb.length)];
      if (veg[j] === 0 && habitable(j)) { veg[j] = 0.01; plants++; }
    }
  }
}

// --- Upgrades ---------------------------------------------------------------

const snapshotOf = (w) => JSON.stringify({ ...w, history: undefined });

export function status(w, id, now) {
  if (!w.on[id]) return { state: 'available' };
  const h = w.history.find((x) => x.id === id);
  if (h && now - h.at < UNDO_WINDOW_MS) return { state: 'undoable', left: UNDO_WINDOW_MS - (now - h.at) };
  return { state: 'permanent' };
}

/** Turn a module on. Saves a snapshot of the world as it was without it. */
export function activate(w, id, now) {
  if (w.on[id] || !MODULES.some((m) => m.id === id)) return false;
  w.history.push({ id, at: now, snap: snapshotOf(w) });
  w.on[id] = true;
  return true;
}

/** Modules that undoing `id` would remove: it, and everything turned on after it. */
export function undoWouldRemove(w, id, now) {
  const idx = w.history.findIndex((h) => h.id === id && now - h.at < UNDO_WINDOW_MS);
  return idx < 0 ? [] : w.history.slice(idx).map((h) => h.id);
}

/** Revert the world to the moment before `id` was turned on. Returns removed module ids, or null. */
export function undo(w, id, now) {
  const idx = w.history.findIndex((h) => h.id === id && now - h.at < UNDO_WINDOW_MS);
  if (idx < 0) return null;
  const removed = w.history.slice(idx).map((h) => h.id);
  const keep = w.history.slice(0, idx);
  const snap = JSON.parse(w.history[idx].snap);
  for (const k of Object.keys(w)) delete w[k];
  Object.assign(w, snap, { history: keep, lastReal: now });
  return removed;
}

/** Drop snapshots whose undo window has passed: those modules are now permanent. */
export function prune(w, now) {
  w.history = w.history.filter((h) => now - h.at < UNDO_WINDOW_MS);
}

// --- Saving -------------------------------------------------------------------

export function loadWorld(seed, geo) {
  try {
    const w = JSON.parse(localStorage.getItem(STORE_KEY(seed)) || 'null');
    if (w && w.v === 1 && w.veg?.length === geo.spots.length) return w;
  } catch { /* storage unavailable or corrupt: start fresh */ }
  return null;
}

export function saveWorld(w) {
  try { localStorage.setItem(STORE_KEY(w.seed), JSON.stringify(w)); } catch { /* storage unavailable */ }
}
