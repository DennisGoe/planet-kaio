import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

/* ============================================================
   PLANET 1.5° — Kaio-Style-Miniplanet + GSAP-Choreografie
   ============================================================ */

gsap.registerPlugin(ScrollTrigger);

const PLANET_R = 2;
const SEA_R = PLANET_R;            // Meeresspiegel
const ROAD_R = PLANET_R + 0.035;   // Niveau des Straßendamms am Äquator

/* ---------- Renderer / Szene / Kamera ---------- */

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.1, 120);
camera.position.set(0, 0, 7.5);

/* ---------- Licht ---------- */

const hemiLight = new THREE.HemisphereLight(0xbdd5ff, 0x2e3b24, 0.6);
scene.add(hemiLight);

const keyLight = new THREE.DirectionalLight(0xfff0d8, 2.6);
keyLight.position.set(5, 4, 6);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
keyLight.shadow.camera.left = -4.5;
keyLight.shadow.camera.right = 4.5;
keyLight.shadow.camera.top = 4.5;
keyLight.shadow.camera.bottom = -4.5;
keyLight.shadow.camera.near = 1;
keyLight.shadow.camera.far = 20;
keyLight.shadow.normalBias = 0.03;
scene.add(keyLight);

const rimLight = new THREE.DirectionalLight(0x7fb4ff, 0.8);
rimLight.position.set(-6, -2, -4);
scene.add(rimLight);

/* ---------- Materialien & Environment (PBR-Look) ---------- */

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.4;
pmrem.dispose();

const mat = (color, roughness = 0.85) => new THREE.MeshStandardMaterial({ color, roughness, metalness: 0 });

/* ---------- "Krankheits"-System: Materialien morphen zwischen gesund und tot ---------- */

const sickMats = [];
const registerSick = (material, sickHex, channel = 'heat') => {
  sickMats.push({ m: material, from: material.color.clone(), to: new THREE.Color(sickHex), ch: channel });
  return material;
};
const droopLeaves = [];   // Palmblätter, die beim Erkranken herabhängen
const shrinkCrowns = [];  // Baumkronen, die verdorren und schrumpfen

const shaded = (mesh) => {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
};

/* ---------- Szenen-Graph ----------
   rig (Scroll-Choreografie) > float (Schweben/Squash) > planetGroup (Drag-Rotation) */

const rig = new THREE.Group();
const float = new THREE.Group();
const planetGroup = new THREE.Group();
rig.add(float);
float.add(planetGroup);
scene.add(rig);

const BASE_TILT = 0.18;
planetGroup.rotation.x = BASE_TILT;

/* ---------- Hilfsfunktion: Objekt auf der Kugel platzieren ---------- */

const UP = new THREE.Vector3(0, 1, 0);

function placeOnPlanet(obj, lat, lon, yRot = 0) {
  const dir = new THREE.Vector3().setFromSphericalCoords(
    1, THREE.MathUtils.degToRad(90 - lat), THREE.MathUtils.degToRad(lon)
  );
  obj.position.copy(dir).multiplyScalar(terrainRadius(dir) - 0.012);
  obj.quaternion.setFromUnitVectors(UP, dir);
  obj.rotateY(yRot);
  planetGroup.add(obj);
}

// Sucht ab einem Wunschpunkt spiralförmig nach flachem Grasland (abseits der Straße)
function findLandSpot(lat, lon) {
  const dir = new THREE.Vector3();
  for (let i = 0; i < 90; i++) {
    const tLat = THREE.MathUtils.clamp(lat + Math.cos(i * 2.4) * i * 1.3, -68, 68);
    const tLon = lon + Math.sin(i * 2.4) * i * 1.3;
    if (Math.abs(tLat) < 22) continue;
    dir.setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - tLat), THREE.MathUtils.degToRad(tLon));
    const h = terrainRadius(dir) - SEA_R;
    if (h > 0.03 && h < 0.095) return [tLat, tLon];
  }
  return [lat, lon];
}

/* ---------- Prozedurales Terrain (Value-Noise-FBM) ---------- */

function sm(t) { return t * t * (3 - 2 * t); }

function h3(x, y, z) {
  const n = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return n - Math.floor(n);
}

function vnoise(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const u = sm(x - xi), v = sm(y - yi), w = sm(z - zi);
  const L = THREE.MathUtils.lerp;
  return L(
    L(L(h3(xi, yi, zi), h3(xi + 1, yi, zi), u), L(h3(xi, yi + 1, zi), h3(xi + 1, yi + 1, zi), u), v),
    L(L(h3(xi, yi, zi + 1), h3(xi + 1, yi, zi + 1), u), L(h3(xi, yi + 1, zi + 1), h3(xi + 1, yi + 1, zi + 1), u), v),
    w
  );
}

function fbm(dir) {
  let sum = 0, amp = 1, total = 0, f = 1.35;
  for (let o = 0; o < 5; o++) {
    sum += amp * vnoise(dir.x * f + o * 19.1, dir.y * f + o * 7.7, dir.z * f + o * 31.3);
    total += amp;
    amp *= 0.5;
    f *= 2.15;
  }
  return sum / total;
}

// Oberflächenradius in einer Richtung — am Äquator auf Straßenniveau geglättet,
// damit die Kaio-Straße als durchgehender Damm um den Planeten führt
function terrainRadius(dir) {
  const land = Math.max(fbm(dir) - 0.52, 0);
  const natural = SEA_R - 0.048 + Math.pow(land, 1.1) * 0.85;
  const roadBlend = THREE.MathUtils.smoothstep(Math.abs(dir.y), 0.13, 0.3);
  return THREE.MathUtils.lerp(ROAD_R, natural, roadBlend);
}

const PAL_HEALTHY = {
  deep: new THREE.Color(0x27543f), sand: new THREE.Color(0xd2ba84),
  grass1: new THREE.Color(0x639c3f), grass2: new THREE.Color(0x40762d),
  forest: new THREE.Color(0x2e5c26), rock: new THREE.Color(0x857a64),
  snow: new THREE.Color(0xe9eef3)
};

// Kapitel 1 — Erwärmung: NUR die Vegetation vertrocknet. Wasser, Fels und
// Schnee bleiben hier unverändert — Meere und Eis haben eigene Kapitel.
const PAL_HEAT = {
  deep: new THREE.Color(0x27543f), sand: new THREE.Color(0xbfa472),
  grass1: new THREE.Color(0xa8854a), grass2: new THREE.Color(0x7a5c33),
  forest: new THREE.Color(0x4a3c2a), rock: new THREE.Color(0x857a64),
  snow: new THREE.Color(0xe9eef3)
};

const C_TUNDRA = new THREE.Color(0x77684f); // Boden unter dem geschmolzenen Schnee

// Wo liegt (gesunder) Schnee? — exakt dieselbe Logik wie in terrainColor
function snowMaskAt(dir, r) {
  const h = r - SEA_R;
  return (h >= 0.13 || (Math.abs(dir.y) > 0.86 && h > 0.01)) ? 1 : 0;
}

function terrainColor(dir, r, out, P) {
  const h = r - SEA_R;
  const n = vnoise(dir.x * 9 + 5, dir.y * 9 + 5, dir.z * 9 + 5);
  if (h < -0.012) out.copy(P.deep);
  else if (h < 0.012) out.copy(P.sand);
  else if (h < 0.055) out.lerpColors(P.grass1, P.grass2, n);
  else if (h < 0.095) out.lerpColors(P.grass2, P.forest, n);
  else if (h < 0.13) out.copy(P.rock);
  else out.copy(P.snow);
  if (Math.abs(dir.y) > 0.86 && h > 0.01) out.copy(P.snow);
  out.multiplyScalar(0.9 + n * 0.18);
}

/* ---------- Der Planet: Terrain + Ozean ---------- */

const terrainGeo = new THREE.SphereGeometry(1, 220, 150);
{
  const p = terrainGeo.attributes.position;
  const colors = new Float32Array(p.count * 3);
  const colorsHeat = new Float32Array(p.count * 3);
  const colorsMelt = new Float32Array(p.count * 3);
  const snowMaskArr = new Float32Array(p.count);
  const dir = new THREE.Vector3();
  const c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    dir.fromBufferAttribute(p, i).normalize();
    const r = terrainRadius(dir);
    p.setXYZ(i, dir.x * r, dir.y * r, dir.z * r);
    terrainColor(dir, r, c, PAL_HEALTHY);
    colors.set([c.r, c.g, c.b], i * 3);
    terrainColor(dir, r, c, PAL_HEAT);
    colorsHeat.set([c.r, c.g, c.b], i * 3);
    const n = vnoise(dir.x * 9 + 5, dir.y * 9 + 5, dir.z * 9 + 5);
    c.copy(C_TUNDRA).multiplyScalar(0.9 + n * 0.18);
    colorsMelt.set([c.r, c.g, c.b], i * 3);
    snowMaskArr[i] = snowMaskAt(dir, r);
  }
  terrainGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  terrainGeo.setAttribute('colorHeat', new THREE.BufferAttribute(colorsHeat, 3));
  terrainGeo.setAttribute('colorMelt', new THREE.BufferAttribute(colorsMelt, 3));
  terrainGeo.setAttribute('snowMask', new THREE.BufferAttribute(snowMaskArr, 1));
  terrainGeo.computeVertexNormals();
}

// Zwei unabhängige Shader-Kanäle: uHeat lässt die Vegetation vertrocknen,
// uIce schmilzt den Schnee (über die gebakte Maske) zu Tundra-Boden
const uHeat = { value: 0 };
const uIce = { value: 0 };
const terrainMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 });
terrainMat.onBeforeCompile = (shader) => {
  shader.uniforms.uHeat = uHeat;
  shader.uniforms.uIce = uIce;
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nattribute vec3 colorHeat;\nattribute vec3 colorMelt;\nattribute float snowMask;\nuniform float uHeat;\nuniform float uIce;')
    .replace('#include <color_vertex>', '#include <color_vertex>\n\tvColor = mix( vColor, colorHeat, uHeat );\n\tvColor = mix( vColor, colorMelt, uIce * snowMask );');
};

const terrain = shaded(new THREE.Mesh(terrainGeo, terrainMat));
planetGroup.add(terrain);

const oceanMat = new THREE.MeshStandardMaterial({ color: 0x1e6f9f, roughness: 0.16, metalness: 0.02, transparent: true, opacity: 0.92 });
const ocean = new THREE.Mesh(new THREE.SphereGeometry(SEA_R, 96, 64), oceanMat);
ocean.receiveShadow = true;
planetGroup.add(ocean);

/* ---------- Polkappen (schmelzen in Kapitel 4) ----------
   Eis-Kappen über beiden Polen, leicht über Ozean und Flachland. Hohe
   (schneeweiße) Gipfel dürfen durchstechen. Beim Schmelzen ziehen sich die
   Kappen per Geometrie-Morph zum Pol zusammen und verblassen am Ende. */

const R_ICE = 2.06;
const iceMat = new THREE.MeshStandardMaterial({ color: 0xeaf4ff, roughness: 0.35, metalness: 0, transparent: true });
const iceCaps = [];

function buildIceCap(north) {
  const thetaStart = north ? 0 : Math.PI - 0.52;
  const geo = new THREE.SphereGeometry(1, 48, 10, 0, Math.PI * 2, thetaStart, 0.52);
  const pos = geo.attributes.position;
  const data = [];
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    data.push({
      theta: Math.acos(THREE.MathUtils.clamp(v.y, -1, 1)),
      azim: Math.atan2(v.z, v.x),
      edge: vnoise(v.x * 6 + 9, v.y * 6 + 9, v.z * 6 + 9) * 0.025 // unregelmäßiger Eisrand
    });
  }
  const cap = new THREE.Mesh(geo, iceMat);
  cap.receiveShadow = true;
  cap.userData = { north, data };
  planetGroup.add(cap);
  iceCaps.push(cap);
}
buildIceCap(true);
buildIceCap(false);

function updateIceCaps(melt) {
  const visible = melt < 0.995;
  iceMat.opacity = melt > 0.8 ? 1 - (melt - 0.8) / 0.2 : 1;
  for (const cap of iceCaps) {
    cap.visible = visible;
    if (!visible) continue;
    const { north, data } = cap.userData;
    const pos = cap.geometry.attributes.position;
    const shrink = 1 - melt * 0.97;
    for (let i = 0; i < pos.count; i++) {
      const d = data[i];
      const theta = north ? d.theta * shrink : Math.PI - (Math.PI - d.theta) * shrink;
      const baseTheta = north ? d.theta : Math.PI - d.theta;
      // die äußerste Vertex-Reihe biegt als Eiskante hinunter zum Wasser
      const r = baseTheta > 0.5 ? SEA_R + 0.004 : R_ICE + d.edge;
      pos.setXYZ(i,
        r * Math.sin(theta) * Math.cos(d.azim),
        r * Math.cos(theta),
        r * Math.sin(theta) * Math.sin(d.azim)
      );
    }
    pos.needsUpdate = true;
    cap.geometry.computeVertexNormals();
  }
}
updateIceCaps(0);

// Ein paar Felsbrocken im Gelände
const rockMat = mat(0x8a8174, 1);
const rockGeo = new THREE.DodecahedronGeometry(0.05, 0);
for (let i = 0; i < 7; i++) {
  const rock = shaded(new THREE.Mesh(rockGeo, rockMat));
  const pos = randomLandPos(14);
  rock.position.copy(pos);
  rock.quaternion.setFromUnitVectors(UP, pos.clone().normalize());
  rock.rotateY(Math.random() * 6);
  const s = 0.7 + Math.random();
  rock.scale.set(s, s * (0.7 + Math.random() * 0.5), s);
  planetGroup.add(rock);
}

/* ---------- Die Straße (das Kaio-Markenzeichen) ---------- */

const road = new THREE.Mesh(
  new THREE.SphereGeometry(ROAD_R + 0.008, 72, 8, 0, Math.PI * 2, Math.PI / 2 - 0.1, 0.2),
  mat(0xcdb98e, 1)
);
road.receiveShadow = true;
planetGroup.add(road);

// Gestrichelte Mittellinie
const dashGeo = new THREE.BoxGeometry(0.09, 0.012, 0.035);
const dashMat = mat(0xffffff);
for (let i = 0; i < 28; i++) {
  const a = (i / 28) * Math.PI * 2;
  const dash = new THREE.Mesh(dashGeo, dashMat);
  const r = ROAD_R + 0.02;
  dash.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
  dash.quaternion.setFromUnitVectors(UP, dash.position.clone().normalize());
  dash.rotateY(-a + Math.PI / 2);
  planetGroup.add(dash);
}

/* ---------- Kaios Kuppelhaus ---------- */

function buildHouse() {
  const g = new THREE.Group();
  const base = shaded(new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.38, 0.26, 18), mat(0xf3e7cf)));
  base.position.y = 0.13;
  const dome = shaded(new THREE.Mesh(
    new THREE.SphereGeometry(0.36, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2),
    registerSick(mat(0xe0503a), 0x7d5147)
  ));
  dome.position.y = 0.26;
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.18, 0.03), mat(0x5a4632));
  door.position.set(0, 0.11, 0.36);
  const win1 = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.09, 0.09), mat(0xaee7ff));
  win1.position.set(0.36, 0.15, 0);
  const win2 = win1.clone();
  win2.position.x = -0.36;
  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.22, 6), mat(0xd9d4c7));
  antenna.position.y = 0.72;
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), mat(0xffd166));
  bulb.position.y = 0.84;
  g.add(base, dome, door, win1, win2, antenna, bulb);
  return g;
}

placeOnPlanet(buildHouse(), ...findLandSpot(42, 25), 0.6);

/* ---------- Palmen & Bäume ---------- */

function buildPalm(s = 1) {
  const g = new THREE.Group();
  const trunk = shaded(new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.05, 0.52, 7), mat(0x8a5a36)));
  trunk.position.y = 0.26;
  trunk.rotation.z = 0.09;
  g.add(trunk);
  const leafMat = registerSick(mat(0x3f9e4d), 0x7a5a30);
  for (let i = 0; i < 6; i++) {
    const pivot = new THREE.Group();
    pivot.position.y = 0.54;
    pivot.rotation.y = (i / 6) * Math.PI * 2;
    const leaf = shaded(new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), leafMat));
    leaf.scale.set(2.1, 0.28, 0.65);
    leaf.position.x = 0.2;
    leaf.rotation.z = -0.45;
    droopLeaves.push({ leaf, baseZ: -0.45 });
    pivot.add(leaf);
    g.add(pivot);
  }
  g.scale.setScalar(s);
  return g;
}

function buildTree(s = 1) {
  const g = new THREE.Group();
  const trunk = shaded(new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.3, 7), mat(0x7a5230)));
  trunk.position.y = 0.15;
  const c1 = shaded(new THREE.Mesh(new THREE.SphereGeometry(0.19, 12, 9), registerSick(mat(0x4cb04f), 0x77572e)));
  c1.position.y = 0.4;
  const c2 = shaded(new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 9), registerSick(mat(0x3c9444), 0x6b4e2a)));
  c2.position.set(0.13, 0.32, 0.06);
  const c3 = shaded(new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 9), registerSick(mat(0x57bd58), 0x83663a)));
  c3.position.set(-0.12, 0.34, -0.05);
  g.add(trunk, c1, c2, c3);
  shrinkCrowns.push(c1, c2, c3);
  g.scale.setScalar(s);
  return g;
}

placeOnPlanet(buildPalm(1), ...findLandSpot(26, -58), 1.2);
placeOnPlanet(buildPalm(0.85), ...findLandSpot(48, 140), 2.5);
placeOnPlanet(buildPalm(0.9), ...findLandSpot(-34, 84), 0.3);
placeOnPlanet(buildTree(1), ...findLandSpot(-28, -128), 0);
placeOnPlanet(buildTree(0.8), ...findLandSpot(58, -160), 1.0);
placeOnPlanet(buildTree(0.7), ...findLandSpot(-52, 10), 2.0);

/* ---------- Gras & Blumen (instanziert) ---------- */

function randomSurfaceQuat(pos) {
  const q = new THREE.Quaternion().setFromUnitVectors(UP, pos.clone().normalize());
  q.multiply(new THREE.Quaternion().setFromAxisAngle(UP, Math.random() * Math.PI * 2));
  return q;
}

// Würfelt eine Position auf Grasland aus (Rejection Sampling, meidet Ozean und Berge)
function randomLandPos(minLat, sink = 0.012) {
  const dir = new THREE.Vector3();
  for (let k = 0; k < 120; k++) {
    const lat = (minLat + Math.random() * (76 - minLat)) * (Math.random() > 0.5 ? 1 : -1);
    const lon = Math.random() * 360;
    dir.setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - lat), THREE.MathUtils.degToRad(lon));
    const r = terrainRadius(dir);
    if (r > SEA_R + 0.018 && r < SEA_R + 0.1) return dir.clone().multiplyScalar(r - sink);
  }
  return dir.clone().multiplyScalar(terrainRadius(dir) - sink);
}

const grass = new THREE.InstancedMesh(new THREE.ConeGeometry(0.025, 0.1, 5), registerSick(mat(0x4d9c33), 0x8a6b35), 70);
const m4 = new THREE.Matrix4();
for (let i = 0; i < 70; i++) {
  const pos = randomLandPos(13);
  const s = 0.7 + Math.random() * 0.8;
  m4.compose(pos, randomSurfaceQuat(pos), new THREE.Vector3(s, s, s));
  grass.setMatrixAt(i, m4);
}
grass.castShadow = true;
planetGroup.add(grass);

const flowers = new THREE.InstancedMesh(new THREE.SphereGeometry(0.032, 8, 6), registerSick(mat(0xffffff), 0x6b5f4c), 26);
const flowerColors = [0xffffff, 0xffd166, 0xff6fa5];
const col = new THREE.Color();
for (let i = 0; i < 26; i++) {
  const pos = randomLandPos(13, 0.002);
  m4.compose(pos, randomSurfaceQuat(pos), new THREE.Vector3(1, 1, 1));
  flowers.setMatrixAt(i, m4);
  flowers.setColorAt(i, col.setHex(flowerColors[i % 3]));
}
planetGroup.add(flowers);

/* ---------- Das rote Auto (fährt für immer im Kreis) ---------- */

function buildCar() {
  const g = new THREE.Group();
  const body = shaded(new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.09, 0.16), mat(0xd6453c)));
  body.position.y = 0.085;
  const cabin = shaded(new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.085, 0.14), mat(0xf3e7cf)));
  cabin.position.set(-0.03, 0.165, 0);
  g.add(body, cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.046, 0.046, 0.03, 10);
  const wheelMat = mat(0x2a2a30);
  for (const [x, z] of [[0.11, 0.085], [0.11, -0.085], [-0.11, 0.085], [-0.11, -0.085]]) {
    const w = shaded(new THREE.Mesh(wheelGeo, wheelMat));
    w.rotation.x = Math.PI / 2;
    w.position.set(x, 0.046, z);
    g.add(w);
  }
  return g;
}

const carPivot = new THREE.Group();
const carHolder = new THREE.Group();
carHolder.position.set(ROAD_R + 0.012, 0, 0);
carHolder.quaternion.setFromUnitVectors(UP, new THREE.Vector3(1, 0, 0));
carHolder.rotateY(Math.PI / 2);
carHolder.add(buildCar());
carPivot.add(carHolder);
planetGroup.add(carPivot);

/* ---------- Wolken ---------- */

const cloudMat = registerSick(
  new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, transparent: true, opacity: 0.92 }),
  0x5e5a52, // aus Wolken wird Smog …
  'air'     // … aber erst im Atmosphären-Kapitel
);

function buildCloud() {
  const g = new THREE.Group();
  const blobs = [
    [0, 0, 0, 0.17], [-0.2, -0.02, 0.03, 0.12], [0.19, -0.01, -0.02, 0.13], [0.04, 0.09, 0.02, 0.11]
  ];
  for (const [x, y, z, r] of blobs) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), cloudMat);
    b.position.set(x, y, z);
    b.castShadow = true;
    g.add(b);
  }
  return g;
}

const cloudPivots = [];
for (let i = 0; i < 4; i++) {
  const pivot = new THREE.Group();
  pivot.rotation.z = (Math.random() - 0.5) * 1.1;
  pivot.rotation.y = Math.random() * Math.PI * 2;
  const cloud = buildCloud();
  const phi = THREE.MathUtils.degToRad(65 + Math.random() * 50);
  cloud.position.setFromSphericalCoords(2.85, phi, Math.random() * Math.PI * 2);
  cloud.lookAt(0, 0, 0);
  pivot.add(cloud);
  pivot.userData.speed = 0.04 + Math.random() * 0.05;
  float.add(pivot);
  cloudPivots.push(pivot);
}

/* ---------- Atmosphären-Glow (Fresnel) ---------- */

const atmosphere = new THREE.Mesh(
  new THREE.SphereGeometry(PLANET_R * 1.22, 48, 32),
  new THREE.ShaderMaterial({
    uniforms: { glowColor: { value: new THREE.Color(0x6fb8ff) } },
    vertexShader: `
      varying vec3 vNormal;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform vec3 glowColor;
      varying vec3 vNormal;
      void main() {
        float intensity = pow(0.62 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 4.0);
        gl_FragColor = vec4(glowColor, 1.0) * intensity;
      }`,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false
  })
);
float.add(atmosphere);

/* ---------- Unsichtbarer Hit-Proxy für Drag/Hover ---------- */

const planetHit = new THREE.Mesh(
  new THREE.SphereGeometry(PLANET_R * 1.25, 16, 12),
  new THREE.MeshBasicMaterial({ visible: false })
);
float.add(planetHit);

/* ---------- Sterne ---------- */

function buildStars(count, size, color, opacity) {
  const positions = new Float32Array(count * 3);
  const v = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    v.randomDirection().multiplyScalar(26 + Math.random() * 30);
    positions.set([v.x, v.y, v.z], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  return new THREE.Points(geo, new THREE.PointsMaterial({
    size, color, transparent: true, opacity, sizeAttenuation: true
  }));
}

const stars = buildStars(1100, 0.07, 0xbfd0ff, 0.8);
const starsAccent = buildStars(90, 0.14, 0x9ef01a, 0.5);
scene.add(stars, starsAccent);

/* ============================================================
   Interaktion: Drag mit Trägheit, Klick-Squash, Hover-Cursor
   ============================================================ */

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let dragging = false;
let lastX = 0, lastY = 0, dragDist = 0;
let velY = 0, velX = 0;
let spinBoost = 0;

function pointerHitsPlanet(e) {
  pointer.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  return raycaster.intersectObject(planetHit, false).length > 0;
}

window.addEventListener('pointerdown', (e) => {
  if (e.target.closest('a, button, .card, .nav')) return;
  if (!pointerHitsPlanet(e)) return;
  dragging = true;
  dragDist = 0;
  lastX = e.clientX;
  lastY = e.clientY;
});

window.addEventListener('pointermove', (e) => {
  cursorX(e.clientX);
  cursorY(e.clientY);
  mouseNX = (e.clientX / window.innerWidth) * 2 - 1;
  mouseNY = (e.clientY / window.innerHeight) * 2 - 1;

  if (dragging) {
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    dragDist += Math.abs(dx) + Math.abs(dy);
    planetGroup.rotation.y += dx * 0.006;
    planetGroup.rotation.x = THREE.MathUtils.clamp(planetGroup.rotation.x + dy * 0.004, -0.6, 0.8);
    velY = dx * 0.006;
    velX = dy * 0.004;
    lastX = e.clientX;
    lastY = e.clientY;
  }

  const overPlanet = !dragging && !e.target.closest('a, button, .card') && pointerHitsPlanet(e);
  cursorEl.classList.toggle('is-planet', overPlanet || dragging);
});

window.addEventListener('pointerup', () => {
  if (dragging && dragDist < 6) squashPlanet();
  dragging = false;
});

window.addEventListener('touchmove', (e) => {
  if (dragging) e.preventDefault();
}, { passive: false });

function squashPlanet() {
  spinBoost = 1.6;
  gsap.timeline()
    .to(float.scale, { x: 1.14, y: 0.86, z: 1.14, duration: 0.16, ease: 'power2.out' })
    .to(float.scale, { x: 1, y: 1, z: 1, duration: 1.3, ease: 'elastic.out(1, 0.35)' });
}

/* ---------- Custom Cursor ---------- */

const cursorEl = document.getElementById('cursor');
const cursorX = gsap.quickTo(cursorEl, 'x', { duration: 0.25, ease: 'power3' });
const cursorY = gsap.quickTo(cursorEl, 'y', { duration: 0.25, ease: 'power3' });

document.querySelectorAll('a, button, .card').forEach((el) => {
  el.addEventListener('mouseenter', () => gsap.to(cursorEl, { scale: 2.4, duration: 0.3 }));
  el.addEventListener('mouseleave', () => gsap.to(cursorEl, { scale: 1, duration: 0.3 }));
});

/* ---------- Vier Schadens-Kanäle, je einer pro Daten-Kapitel ----------
   Jede Klima-Zahl löst GENAU die Veränderung aus, von der sie erzählt —
   und zwar dann, wenn ihr Inhalt auf Scrollhöhe ist:
     heat — +1,5 °C : Vegetation vertrocknet, Licht wird hart
     air  — 424 ppm : Atmosphäre kippt, Wolken werden Smog
     sea  — 4,4 mm  : die Meere kippen
     ice  — −12,2 % : die Polkappen schmelzen, der Meeresspiegel steigt
   Alles deterministisch aus der Scroll-Position, geglättet — kein Flackern. */

const channels = { heat: 0, air: 0, sea: 0, ice: 0 };
const applied = { heat: -1, air: -1, sea: -1, ice: -1 };
const CHANNEL_KEYS = ['heat', 'air', 'sea', 'ice'];

const statEls = gsap.utils.toArray('.stat');
const actionsEl = document.querySelector('.actions');
const ctaEl = document.querySelector('.cta');
const clamp01 = (x) => THREE.MathUtils.clamp(x, 0, 1);

function computeChannelTargets() {
  const vh = window.innerHeight;

  // Kapitel-Fortschritt: 0 → 1, während der jeweilige Inhalt auf Scrollhöhe ist
  const ps = statEls.map((el) => {
    const r = el.getBoundingClientRect();
    const from = 0.75 * vh;               // Kapitelstart: Oberkante bei 75 % Viewport
    const to = 0.45 * vh - r.height / 2;  // Kapitelende: Mitte bei 45 % Viewport
    return clamp01((from - r.top) / (from - to));
  });

  // Heilung wirkt auf alle Kanäle: die Hebel lindern, die CTA heilt vollständig
  const ra = actionsEl.getBoundingClientRect();
  const pActions = clamp01((0.6 * vh - ra.top) / (ra.height - 0.15 * vh));
  const rc = ctaEl.getBoundingClientRect();
  const pCta = clamp01((0.8 * vh - rc.top) / (0.25 * vh + rc.height / 2));
  const heal = (1 - 0.65 * pActions) * (1 - pCta);

  return { heat: ps[0] * heal, air: ps[1] * heal, sea: ps[2] * heal, ice: ps[3] * heal };
}

const ATMO_HEALTHY = new THREE.Color(0x6fb8ff), ATMO_SICK = new THREE.Color(0xb0622a);
const KEY_HEALTHY = keyLight.color.clone(), KEY_SICK = new THREE.Color(0xf0bd8e);
const GROUND_HEALTHY = hemiLight.groundColor.clone(), GROUND_SICK = new THREE.Color(0x3d332a);
const OCEAN_HEALTHY = oceanMat.color.clone(), OCEAN_SICK = new THREE.Color(0x46523f);
const ACCENT_HEALTHY = new THREE.Color('#9ef01a'), ACCENT_SICK = new THREE.Color('#ff5e3a');
const accentCol = new THREE.Color();

function applyState() {
  const { heat, air, sea, ice } = channels;

  // Material-Registry: jedes Material hört auf seinen Kanal
  for (const { m, from, to, ch } of sickMats) m.color.lerpColors(from, to, channels[ch]);

  // Kapitel 1 — Erwärmung: Vegetation vertrocknet, das Licht wird hart
  uHeat.value = heat;
  keyLight.color.lerpColors(KEY_HEALTHY, KEY_SICK, heat);
  hemiLight.groundColor.lerpColors(GROUND_HEALTHY, GROUND_SICK, heat);
  for (const d of droopLeaves) d.leaf.rotation.z = THREE.MathUtils.lerp(d.baseZ, d.baseZ - 0.55, heat);
  const crownScale = THREE.MathUtils.lerp(1, 0.72, heat);
  for (const crown of shrinkCrowns) crown.scale.setScalar(crownScale);

  // Kapitel 2 — Atmosphäre: der Glow kippt (Wolken→Smog läuft über die Registry)
  atmosphere.material.uniforms.glowColor.value.lerpColors(ATMO_HEALTHY, ATMO_SICK, air);

  // Kapitel 3 — die Meere kippen: trüb, matt, undurchsichtig
  oceanMat.color.lerpColors(OCEAN_HEALTHY, OCEAN_SICK, sea);
  oceanMat.roughness = THREE.MathUtils.lerp(0.16, 0.5, sea);
  oceanMat.opacity = THREE.MathUtils.lerp(0.92, 0.985, sea);

  // Kapitel 4 — Polkappen und Bergschnee schmelzen, der Meeresspiegel steigt
  uIce.value = ice;
  updateIceCaps(ice);
  ocean.scale.setScalar(1 + 0.012 * ice);

  // Der Gesamtzustand färbt die UI
  const overall = (heat + air + sea + ice) / 4;
  accentCol.lerpColors(ACCENT_HEALTHY, ACCENT_SICK, overall);
  document.documentElement.style.setProperty('--accent', '#' + accentCol.getHexString());
}

/* ---------- Render-Loop ---------- */

let mouseNX = 0, mouseNY = 0;
const clock = new THREE.Clock();

renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  if (!dragging) {
    planetGroup.rotation.y += (0.12 + spinBoost) * dt + velY;
    velY *= 0.94;
    planetGroup.rotation.x += velX;
    velX *= 0.9;
    planetGroup.rotation.x += (BASE_TILT - planetGroup.rotation.x) * 0.02;
    spinBoost *= 1 - 1.4 * dt;
  }

  const targets = computeChannelTargets();
  let stateDirty = false;
  for (const k of CHANNEL_KEYS) {
    channels[k] += (targets[k] - channels[k]) * Math.min(1, dt * 4);
    if (Math.abs(channels[k] - applied[k]) > 0.001) stateDirty = true;
  }
  if (stateDirty) {
    applyState();
    for (const k of CHANNEL_KEYS) applied[k] = channels[k];
  }

  carPivot.rotation.y -= dt * 0.45;
  for (const pivot of cloudPivots) pivot.rotation.y += pivot.userData.speed * dt * 8;

  float.position.y = Math.sin(t * 0.6) * 0.06;
  stars.rotation.y = t * 0.004;
  starsAccent.rotation.y = -t * 0.006;

  camera.position.x += (mouseNX * 0.35 - camera.position.x) * 0.04;
  camera.position.y += (-mouseNY * 0.22 - camera.position.y) * 0.04;
  camera.lookAt(0, 0, 0);

  renderer.render(scene, camera);
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

/* ============================================================
   Smooth Scroll (Lenis) + GSAP-Verkabelung
   ============================================================ */

const lenis = new Lenis({ lerp: 0.1 });
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add((time) => lenis.raf(time * 1000));
gsap.ticker.lagSmoothing(0);

/* ---------- Text-Splitting ---------- */

function splitChars(el) {
  const text = el.textContent;
  el.textContent = '';
  const frag = document.createDocumentFragment();
  const words = text.split(' ');
  words.forEach((word, wi) => {
    const w = document.createElement('span');
    w.className = 'word';
    for (const ch of word) {
      const c = document.createElement('span');
      c.className = 'char';
      c.textContent = ch;
      w.appendChild(c);
    }
    frag.appendChild(w);
    if (wi < words.length - 1) frag.appendChild(document.createTextNode(' '));
  });
  el.appendChild(frag);
  return el.querySelectorAll('.char');
}

const heroChars = splitChars(document.querySelector('[data-hero-split]'));

/* ---------- Anfangszustände ---------- */

gsap.set(rig.scale, { x: 0, y: 0, z: 0 });
gsap.set(heroChars, { yPercent: 115 });
gsap.set('#hero-dot', { scale: 0 });
gsap.set('.hero-sub, .hero-hint, .nav', { autoAlpha: 0 });

/* ---------- Loader → Intro ---------- */

const counterEl = document.querySelector('.loader-count');
const counter = { v: 0 };

// Der Planet lädt MIT dem Zähler: Bei 0 % ist er ein Punkt, bei 100 % erst
// knapp halb so groß — dezent hinter der Typo. Den großen Auftritt (elastischer
// Pop auf volle Größe) gibt es erst, wenn der Loader durch ist.
spinBoost = 1.2;

gsap.to(counter, {
  v: 100,
  duration: 1.8,
  ease: 'power2.inOut',
  onUpdate: () => {
    counterEl.textContent = Math.round(counter.v);
    rig.scale.setScalar((counter.v / 100) * 0.45);
  },
  onComplete: intro
});

function intro() {
  gsap.timeline()
    .to('.loader-count, .loader-label', { yPercent: -40, autoAlpha: 0, duration: 0.7, ease: 'expo.in', stagger: 0.08 })
    .set('#loader', { display: 'none' })
    .to(rig.scale, { x: 1, y: 1, z: 1, duration: 1.7, ease: 'elastic.out(1, 0.5)' }, '-=0.25')
    .to(heroChars, { yPercent: 0, duration: 1.1, ease: 'expo.out', stagger: 0.035 }, '<+0.05')
    .to('#hero-dot', { scale: 1, duration: 0.7, ease: 'back.out(3)' }, '-=0.7')
    .to('.hero-sub, .hero-hint, .nav', { autoAlpha: 1, duration: 0.8, stagger: 0.12 }, '-=0.6');
}

/* ============================================================
   Scroll-Choreografie: Der Planet reist durch die Seite
   ============================================================ */

const halfW = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * 7.5 * camera.aspect;
const X = Math.min(2.6, halfW * 0.52);

// 01 — Die Lage: Planet wandert nach links, kippt leicht
gsap.timeline({
  scrollTrigger: { trigger: '.stats', start: 'top 95%', end: 'top 15%', scrub: 1 }
})
  .to(rig.position, { x: -X, y: 0.1 }, 0)
  .to(rig.rotation, { z: 0.18 }, 0);

// 02 — Hebel: Planet wechselt auf die rechte Seite, bleibt aber voll im Bild
gsap.timeline({
  scrollTrigger: { trigger: '.actions', start: 'top 95%', end: 'top 20%', scrub: 1 }
})
  .to(rig.position, { x: X * 0.9, y: 0.1, z: -0.6 }, 0)
  .to(rig.rotation, { z: -0.12 }, 0)
  .to(rig.scale, { x: 0.85, y: 0.85, z: 0.85 }, 0);

// 03 — CTA: Planet kehrt groß in die Mitte zurück
gsap.timeline({
  scrollTrigger: { trigger: '.cta', start: 'top 90%', end: 'center 60%', scrub: 1 }
})
  .to(rig.position, { x: 0, y: -0.25, z: 0.9 }, 0)
  .to(rig.rotation, { z: 0 }, 0)
  .to(rig.scale, { x: 1, y: 1, z: 1 }, 0);

/* Hinweis: Die vier Schadens-Kanäle und die Akzentfarbe werden NICHT über
   ScrollTrigger getweent, sondern pro Frame deterministisch aus der Scroll-
   Position berechnet (computeChannelTargets im Render-Loop) — kein Flackern. */

/* ---------- Scroll-Progress ---------- */

gsap.to('.progress', {
  scaleX: 1,
  ease: 'none',
  scrollTrigger: { trigger: '.content', start: 'top top', end: 'bottom bottom', scrub: 0.3 }
});

/* ---------- Reveals ---------- */

gsap.utils.toArray('[data-reveal]').forEach((el) => {
  gsap.from(el, {
    y: 48,
    autoAlpha: 0,
    duration: 1.1,
    ease: 'power3.out',
    scrollTrigger: { trigger: el, start: 'top 88%' }
  });
});

gsap.utils.toArray('[data-split]').forEach((el) => {
  const chars = splitChars(el);
  gsap.from(chars, {
    yPercent: 115,
    duration: 0.9,
    ease: 'expo.out',
    stagger: 0.018,
    scrollTrigger: { trigger: el, start: 'top 85%' }
  });
});

/* ---------- Stat-Counter ---------- */

document.querySelectorAll('.stat-value').forEach((el) => {
  const target = parseFloat(el.dataset.target);
  const decimals = parseInt(el.dataset.decimals || '0', 10);
  const prefix = el.dataset.prefix || '';
  const obj = { v: 0 };
  ScrollTrigger.create({
    trigger: el,
    start: 'top 85%',
    once: true,
    onEnter: () => gsap.to(obj, {
      v: target,
      duration: 2.2,
      ease: 'power3.out',
      onUpdate: () => {
        el.textContent = prefix + obj.v.toLocaleString('de-DE', {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals
        });
      }
    })
  });
});

/* ---------- Card-Tilt ---------- */

document.querySelectorAll('.card').forEach((card) => {
  card.addEventListener('pointermove', (e) => {
    const r = card.getBoundingClientRect();
    const nx = (e.clientX - r.left) / r.width - 0.5;
    const ny = (e.clientY - r.top) / r.height - 0.5;
    gsap.to(card, {
      rotateX: -ny * 9,
      rotateY: nx * 9,
      transformPerspective: 700,
      duration: 0.5,
      ease: 'power2.out'
    });
  });
  card.addEventListener('pointerleave', () => {
    gsap.to(card, { rotateX: 0, rotateY: 0, duration: 0.8, ease: 'elastic.out(1, 0.5)' });
  });
});

/* ---------- Magnetic Button ---------- */

const magnet = document.querySelector('.btn-magnetic');
magnet.addEventListener('pointermove', (e) => {
  const r = magnet.getBoundingClientRect();
  gsap.to(magnet, {
    x: (e.clientX - r.left - r.width / 2) * 0.38,
    y: (e.clientY - r.top - r.height / 2) * 0.38,
    duration: 0.4,
    ease: 'power3.out'
  });
});
magnet.addEventListener('pointerleave', () => {
  gsap.to(magnet, { x: 0, y: 0, duration: 0.9, ease: 'elastic.out(1, 0.4)' });
});
