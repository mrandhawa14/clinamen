// Sun, sky and atmosphere for the planet view.
// The sun's position comes from the real date: the point on the planet where it's
// directly overhead (subsolar point) moves with the time of day and the season.
import * as THREE from 'three';
import { dirOf, R } from './terrain.js';
import { smoothstep, mulberry32 } from '../world.js';
import { glowTexture } from '../assets/common.js';

export function subsolar(date) {
  const doy = Math.floor((date - Date.UTC(date.getUTCFullYear(), 0, 0)) / 864e5);
  const decl = (-23.44 * Math.cos((2 * Math.PI * (doy + 10)) / 365) * Math.PI) / 180; // season
  const ut = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
  return { lat: decl, lon: (-(ut - 12) * 15 * Math.PI) / 180 };                          // time of day
}

// Sky colour seen from the ground, by the sun's height in degrees.
const SKY = [[-18, '#05070f'], [-8, '#1a2048'], [-2, '#5d4472'], [1, '#ee926a'], [6, '#f2c08f'], [15, '#a7d1ee'], [90, '#78b9ea']]
  .map(([a, h]) => [a, new THREE.Color(h)]);
function skyColour(alt, out) {
  if (alt <= SKY[0][0]) return out.copy(SKY[0][1]);
  for (let i = 0; i < SKY.length - 1; i++) if (alt <= SKY[i + 1][0]) return out.lerpColors(SKY[i][1], SKY[i + 1][1], (alt - SKY[i][0]) / (SKY[i + 1][0] - SKY[i][0]));
  return out.copy(SKY[SKY.length - 1][1]);
}

export function makePlanetSky(scene) {
  const sun = new THREE.DirectionalLight('#fff4e4', 2.6);
  scene.add(sun, sun.target);
  const ambient = new THREE.AmbientLight('#8fa6d8', 0.22);
  scene.add(ambient);

  // Atmosphere: a soft blue rim around the planet, seen from space
  const rim = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture([[0, 'rgba(110,170,255,0)'], [0.8, 'rgba(110,170,255,0)'], [0.865, 'rgba(120,180,255,0.55)'], [0.92, 'rgba(110,170,255,0.18)'], [1, 'rgba(110,170,255,0)']], 512),
    transparent: true, depthWrite: false, toneMapped: false,
  }));
  rim.scale.setScalar(R * 2 * 1.155);
  scene.add(rim);

  // Stars
  const rnd = mulberry32(5), sp = [];
  for (let i = 0; i < 2500; i++) {
    const u = rnd() * 2 - 1, th = rnd() * Math.PI * 2, s = Math.sqrt(1 - u * u);
    sp.push(Math.cos(th) * s * 150000, u * 150000, Math.sin(th) * s * 150000);
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  const starMat = new THREE.PointsMaterial({ color: '#dfe6ff', size: 1.3, sizeAttenuation: false, fog: false, transparent: true });
  scene.add(new THREE.Points(sg, starMat));

  scene.background = new THREE.Color('#03040a');
  scene.fog = new THREE.Fog('#03040a', 1e7, 2e7);
  const space = new THREE.Color('#03040a'), c = new THREE.Color(), sunDir = new THREE.Vector3(), up = new THREE.Vector3();

  function update(date, camPos, alt) {
    const ss = subsolar(date);
    dirOf(ss.lat, ss.lon, sunDir);
    sun.position.copy(sunDir).multiplyScalar(1e5);

    up.copy(camPos).normalize();
    const sunAlt = (Math.asin(Math.max(-1, Math.min(1, up.dot(sunDir)))) * 180) / Math.PI;
    const inAir = 1 - smoothstep(25, 350, alt);           // how much sky is around the camera
    skyColour(sunAlt, c);
    scene.background.lerpColors(space, c, inAir);
    scene.fog.color.copy(scene.background);
    const far = alt < 350 ? 140 + alt * 14 : 1e7;
    scene.fog.far = far; scene.fog.near = far * 0.2;
    starMat.opacity = 1 - inAir * smoothstep(-10, -2, sunAlt);
    rim.material.opacity = smoothstep(120, 1500, alt);
    ambient.intensity = 0.22 + 0.25 * inAir * smoothstep(-6, 10, sunAlt); // night stays readable (moonlight)
    return { sunAlt };
  }
  return { update, sunDir };
}
