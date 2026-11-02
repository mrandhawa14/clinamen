// Accident tree icons: 32×32, faceted (low-poly) style, drawn in currentColor so the
// tree's CSS sets the colour per state. States: possible, notyet, happened, missed.

const F = (o) => `fill="currentColor" fill-opacity="${o}"`;
const S = (w = 2, o = 1) => `fill="none" stroke="currentColor" stroke-width="${w}" stroke-opacity="${o}" stroke-linecap="round" stroke-linejoin="round"`;
/** Regular polygon split into triangles with alternating shades: the low-poly look. */
function facetedDisc(cx, cy, r, n = 6, shades = [1, 0.7], rot = -Math.PI / 2) {
  const pts = Array.from({ length: n }, (_, i) => [cx + r * Math.cos(rot + (i / n) * 2 * Math.PI), cy + r * Math.sin(rot + (i / n) * 2 * Math.PI)]);
  return pts.map((p, i) => {
    const q = pts[(i + 1) % n];
    return `<polygon points="${cx},${cy} ${p[0].toFixed(1)},${p[1].toFixed(1)} ${q[0].toFixed(1)},${q[1].toFixed(1)}" ${F(shades[i % shades.length])}/>`;
  }).join('');
}

export const ICONS = {
  antimatter: { name: 'Matter beats antimatter',
    svg: `<circle cx="12" cy="16" r="7" ${F(1)}/><circle cx="21" cy="16" r="7" ${S(2, 0.8)}/>` },
  'supernova-trigger': { name: 'A nearby supernova',
    svg: `<polygon points="16,2 19,11 29,8 22,16 29,24 19,21 16,30 13,21 3,24 10,16 3,8 13,11" ${F(0.55)}/>${facetedDisc(16, 16, 5, 6)}` },
  'calm-star': { name: 'A single, calm star',
    svg: `${facetedDisc(16, 16, 8, 6)}<path d="M16 2v3M16 27v3M2 16h3M27 16h3" ${S(2)}/>` },
  'grand-tack': { name: 'Giant planet wanders',
    svg: `<circle cx="4.5" cy="16" r="2.5" ${F(1)}/><path d="M29 5 Q 4 16 29 27" ${S(1.6, 0.6)} stroke-dasharray="2.5 2.5"/>${facetedDisc(13, 16, 5, 6)}` },
  water: { name: 'Water from space',
    svg: `<polygon points="16,3 16,28 10,24 8,17" ${F(0.7)}/><polygon points="16,3 24,17 22,24 16,28" ${F(1)}/>` },
  theia: { name: 'Moon-forming impact',
    svg: `${facetedDisc(13, 19, 10, 7, [0.75, 0.5])}${facetedDisc(25.5, 6.5, 4, 5)}<path d="M19.5 10.5l2 -2M18 13l3 -1M22 13l-1 -2" ${S(1.6)}/>` },
  'right-size': { name: 'The right size',
    svg: `<circle cx="5" cy="20" r="2.5" ${F(0.4)}/>${facetedDisc(14, 18, 5.5, 6)}<circle cx="25" cy="14" r="5.5" ${S(1.6, 0.45)}/>` },
  core: { name: 'Iron core and magnetic field',
    svg: `<circle cx="16" cy="16" r="9" ${F(0.3)}/>${facetedDisc(16, 16, 4.5, 6)}<path d="M16 3 C 31 6, 31 26, 16 29 M16 3 C 1 6, 1 26, 16 29" ${S(1.4, 0.7)}/>` },
  tectonics: { name: 'Plate tectonics',
    svg: `<polygon points="2,13 14,11 13,24 2,25" ${F(0.6)}/><polygon points="18,11 30,13 30,25 19,24" ${F(1)}/><polygon points="12,11 16,4 20,11" ${F(0.85)}/><path d="M6 19h4M26 19h-4" ${S(1.6)}/>` },
  tilt: { name: 'A stable tilt',
    svg: `${facetedDisc(16, 16, 9, 8, [1, 0.65])}<path d="M10.5 3.5 L21.5 28.5" ${S(2)}/><path d="M16 2v4M16 26v4" ${S(1.2, 0.5)}/>` },
  life: { name: 'Life starts',
    svg: `<path d="M16 5 C 25 5, 28 12, 26 18 C 24 25, 15 29, 9 25 C 3 21, 4 11, 9 7 C 11 6, 13 5, 16 5 Z" ${F(0.35)}/>${facetedDisc(18, 14, 3.5, 5)}<circle cx="11" cy="20" r="1.3" ${F(1)}/><circle cx="20" cy="22" r="1" ${F(1)}/>` },
  photosynthesis: { name: 'Oxygen photosynthesis',
    svg: `<circle cx="7" cy="7" r="3" ${F(1)}/><polygon points="7,27 11,14 24,7" ${F(0.65)}/><polygon points="7,27 24,7 26,13 20,22" ${F(1)}/><path d="M8 26 L22 10" ${S(1.2, 0.5)}/>` },
  oxidation: { name: 'Great Oxidation',
    svg: `<circle cx="10" cy="23" r="5" ${F(0.35)}/><circle cx="10" cy="23" r="5" ${S(1.6)}/><circle cx="20" cy="15" r="3.5" ${S(1.6)}/><circle cx="13" cy="8" r="2.2" ${S(1.4)}/><circle cx="25" cy="6" r="1.8" ${F(1)}/>` },
  mitochondria: { name: 'A cell swallows a bacterium',
    svg: `<ellipse cx="16" cy="16" rx="13" ry="8" ${F(0.35)}/><ellipse cx="16" cy="16" rx="10" ry="5" ${S(1.6)}/><path d="M8 16 L11 12.5 L13 19.5 L16 12.5 L18.5 19.5 L21 12.5 L24 16" ${S(1.4)}/>` },
  chloroplast: { name: 'Plants get chloroplasts',
    svg: `<ellipse cx="16" cy="16" rx="13" ry="8" ${F(0.35)}/><rect x="8" y="12" width="4" height="8" rx="1" ${F(1)}/><rect x="14" y="11" width="4" height="10" rx="1" ${F(0.8)}/><rect x="20" y="12" width="4" height="8" rx="1" ${F(1)}/>` },
  snowball: { name: 'Snowball Earth thaws',
    svg: `${facetedDisc(16, 16, 12, 6, [0.35, 0.22])}<path d="M16 7v18M8.2 11.5l15.6 9M8.2 20.5l15.6 -9" ${S(1.8)}/><path d="M14 9l2 2 2 -2M14 23l2 -2 2 2" ${S(1.2)}/>` },
  land: { name: 'Life leaves the sea',
    svg: `<path d="M3 21 Q 16 7 29 21 Z" ${F(0.6)}/><path d="M16 14 v-6 M16 10 l-3 -3 M16 11 l3 -2" ${S(1.6)}/><path d="M3 25 q 3 -2 6 0 t 6 0 t 6 0 t 6 0" ${S(1.6)}/>` },
  asteroid: { name: 'A ruling species falls to an asteroid',
    svg: `<polygon points="4,22 8,16 14,17 16,22 12,28 6,28" ${F(1)}/><polygon points="8,16 14,17 12,21" ${F(0.6)}/><path d="M15 15 L28 3 M18 18 L29 9 M12 13 L22 4" ${S(1.6, 0.7)}/>` },
  intelligence: { name: 'Intelligence',
    svg: `<path d="M2 16 Q 16 3 30 16 Q 16 29 2 16 Z" ${F(0.35)}/>${facetedDisc(16, 16, 5.5, 6)}<circle cx="16" cy="16" r="2" fill="#000" fill-opacity="0.45"/>` },
};

export const STATES = ['possible', 'notyet', 'happened', 'missed'];

/** SVG markup for an accident icon in a given state. */
export function iconSvg(id, state = 'possible', size = 32) {
  const ic = ICONS[id];
  if (!ic) throw new Error(`Unknown icon: ${id}`);
  const missed = state === 'missed' ? `<path d="M4 28 L28 4" ${S(2.4)}/>` : '';
  return `<svg class="acc-icon ${state}" viewBox="0 0 32 32" width="${size}" height="${size}" role="img" aria-label="${ic.name}${state === 'possible' ? '' : ` (${state === 'notyet' ? 'not yet possible' : state})`}">${ic.svg}${missed}</svg>`;
}
