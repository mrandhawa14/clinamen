// Sun, moon, sky colour and stars driven by the real sun position (suncalc).
import * as THREE from 'three';
import SunCalc from 'suncalc';
import { smoothstep, mulberry32 } from './world.js';

// Sky colour keyed by sun altitude in degrees.
const SKY = [
  [-18, '#141c40'], [-8, '#262d5c'], [-2, '#6a4a7a'], [1, '#f0936a'],
  [6, '#f6c08f'], [15, '#a9d3ee'], [40, '#86c3ee'], [90, '#78b9ea'],
].map(([a, h]) => [a, new THREE.Color(h)]);

function skyColor(alt, out) {
  if (alt <= SKY[0][0]) return out.copy(SKY[0][1]);
  for (let i = 0; i < SKY.length - 1; i++) {
    const [a0, c0] = SKY[i], [a1, c1] = SKY[i + 1];
    if (alt <= a1) return out.lerpColors(c0, c1, (alt - a0) / (a1 - a0));
  }
  return out.copy(SKY[SKY.length - 1][1]);
}

// suncalc azimuth: 0 = south, positive towards west. Scene: north = -z, east = +x.
function dirFrom(alt, az, out) {
  return out.set(-Math.sin(az) * Math.cos(alt), Math.sin(alt), Math.cos(az) * Math.cos(alt));
}

export function buildSky(scene) {
  const sun = new THREE.DirectionalLight('#ffffff', 2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 80 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);

  const moon = new THREE.DirectionalLight('#9fb4ff', 0);
  scene.add(moon, moon.target);

  const hemi = new THREE.HemisphereLight('#bcdcff', '#6b5a45', 1);
  scene.add(hemi);

  // Stars
  const rnd = mulberry32(7);
  const sp = [];
  for (let i = 0; i < 900; i++) {
    const u = rnd() * 2 - 1, th = rnd() * Math.PI * 2, s = Math.sqrt(1 - u * u);
    if (u < -0.1) continue;
    sp.push(Math.cos(th) * s * 150, Math.abs(u) * 150, Math.sin(th) * s * 150);
  }
  const starGeom = new THREE.BufferGeometry();
  starGeom.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  const starMat = new THREE.PointsMaterial({ color: '#ffffff', size: 1.4, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false });
  scene.add(new THREE.Points(starGeom, starMat));

  scene.background = new THREE.Color();
  scene.fog = new THREE.Fog(0xffffff, 60, 140);

  const warm = new THREE.Color('#ffb070'), white = new THREE.Color('#fff6e8'), tmp = new THREE.Color();

  function update(date, lat, lon) {
    const s = SunCalc.getPosition(date, lat, lon);
    const m = SunCalc.getMoonPosition(date, lat, lon);
    const illum = SunCalc.getMoonIllumination(date).fraction;
    const altDeg = (s.altitude * 180) / Math.PI;

    const day = smoothstep(-4, 8, altDeg);           // 0 night .. 1 day
    const golden = 1 - smoothstep(3, 22, altDeg);     // warm low sun

    dirFrom(Math.max(s.altitude, 0.04), s.azimuth, sun.position).multiplyScalar(30);
    sun.intensity = 2.6 * day;
    sun.color.lerpColors(white, warm, golden * day);
    sun.castShadow = day > 0.02;

    if (m) dirFrom(Math.max(m.altitude, 0.1), m.azimuth, moon.position).multiplyScalar(30);
    moon.intensity = (1 - day) * (0.6 + 0.8 * illum) * (m && m.altitude > 0 ? 1 : 0.4);

    skyColor(altDeg, scene.background);
    scene.fog.color.copy(scene.background);
    hemi.color.copy(tmp.copy(scene.background).lerp(white, 0.35));
    hemi.intensity = 0.8 + 0.5 * day;
    starMat.opacity = 1 - smoothstep(-12, -3, altDeg);

    return { altDeg, day };
  }

  return { update };
}
