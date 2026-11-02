// World generation: seeded noise, island height field, seasons.
import { createNoise2D } from 'simplex-noise';

export const R = 10;          // island (diorama) radius
export const BASE_DEPTH = 3;  // how far the diorama block goes below sea level

export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(s) {
  let h = 2166136261;
  for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export const clamp01 = (x) => Math.min(1, Math.max(0, x));
export function smoothstep(a, b, x) {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
}

/** Returns height(x, z). Sea level is y = 0. */
export function makeHeightFn(seed) {
  const rnd = mulberry32(seed);
  const n1 = createNoise2D(rnd), n2 = createNoise2D(rnd), n3 = createNoise2D(rnd);
  return (x, z) => {
    const r = Math.hypot(x, z) / R;
    const warp = n3(x * 0.15, z * 0.15) * 0.18;       // ragged coastline
    const m = smoothstep(1.0, 0.3, r + warp);        // island mask, 1 = inland
    let f = 0, amp = 1, freq = 0.09, norm = 0;
    for (let i = 0; i < 5; i++) { f += amp * n1(x * freq, z * freq); norm += amp; amp *= 0.5; freq *= 2; }
    f /= norm;                                         // -1..1 rolling hills
    const ridge = 1 - Math.abs(n2(x * 0.07, z * 0.07)); // 0..1 mountain ridges
    return (0.55 + 0.45 * f) * 2.2 * m + ridge ** 3 * 2.6 * m * m - 1.15 * (1 - m) - 0.25;
  };
}

/**
 * Season state for a day of year. Keyframes: spring, summer, autumn, winter.
 * Southern hemisphere is shifted half a year.
 */
const KEYS = [100, 180, 290, 350, 465];
export const SEASON_NAMES = ['Spring', 'Summer', 'Autumn', 'Winter'];

export function seasonState(doy, lat) {
  const d = lat < 0 ? (doy + 182.5) % 365 : doy;
  const dd = d < KEYS[0] ? d + 365 : d;
  let k = 0;
  while (k < 3 && dd >= KEYS[k + 1]) k++;
  const raw = (dd - KEYS[k]) / (KEYS[k + 1] - KEYS[k]);
  const t = smoothstep(0.15, 0.85, raw);              // hold near each keyframe
  const wint = -Math.cos((2 * Math.PI * (d - 172)) / 365); // -1 midsummer .. 1 midwinter
  return {
    k, t,
    snow: clamp01((-Math.cos((2 * Math.PI * (d - 197)) / 365) - 0.6) / 0.3), // lags the solstice, peaks mid-Jan
    bare: clamp01((wint - 0.55) / 0.3),
    // keyframes are the peak of each season
    name: SEASON_NAMES[raw < 0.5 ? k : (k + 1) % 4],
    early: raw < 0.25 ? 'Mid ' : raw < 0.5 ? 'Late ' : 'Early ',
  };
}
