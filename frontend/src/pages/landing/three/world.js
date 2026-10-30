import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { Collector, canvasTexture, lerp, mergeParts, noiseFill, rng } from "./kit.js";
import { buildTruck } from "./truck.js";
import { Sky } from "three/examples/jsm/objects/Sky.js";
import { asphalt, bark, grassCard, plantationFloor, soil } from "./textures.js";

/*
 * One continuous world along a road (+X). The truck visits each place in turn:
 *   hero (plantation road) → pupuk warehouse → palm-oil mill → material yard → depot → sunset road
 * Facilities sit on the −Z side of the road; the truck drives in the left-hand lane (+Z), as in Indonesia.
 */
export const ZONES = { hero: 0, pupuk: 260, cangkang: 520, material: 780, depot: 1040, cta: 1300 };
export const LANE_Z = 2.0;
const ROAD_W = 8.5;
const TREAD_ZONES = [[-140, 140], [1160, 1440]];   // plantation stretches that loop (hero + ending)
const FACILITY_HALF = 52;                          // keep palms out of facility yards

// ------------------------------------------------------------------------------------------
// time of day presets (t: 0 morning → .3 day → .72 blue hour → .92 sunset)
// ------------------------------------------------------------------------------------------
const TOD = [
  { t: 0.0, tb: 7, ray: 1.8, mie: 0.007, gain: 0.46, cloud: 0.32, top: 0x1c3350, hor: 0xf0a868, sun: 0xffc896, sunI: 2.7, elev: 9, az: 35, hemiS: 0x9db7d6, hemiG: 0x3a3427, hemiI: 0.65, fog: 0xc9a07c, dens: 0.0058, exp: 1.0, mount: 0x5d6a78, flood: 0, lights: 0 },
  { t: 0.3, tb: 3.6, ray: 1.3, mie: 0.004, gain: 0.27, cloud: 0.45, top: 0x2e5d8f, hor: 0xb4c4ce, sun: 0xfff0dc, sunI: 2.6, elev: 34, az: 60, hemiS: 0xa9c2dc, hemiG: 0x4a4232, hemiI: 0.7, fog: 0x9fb1bd, dens: 0.0034, exp: 1.0, mount: 0x7d8c99, flood: 0, lights: 0 },
  { t: 0.72, tb: 4.5, ray: 1.7, mie: 0.005, gain: 0.75, cloud: 0.22, top: 0x0a1424, hor: 0x3a4d68, sun: 0x9fb2d1, sunI: 0.45, elev: 1.2, az: 120, hemiS: 0x3a4f70, hemiG: 0x1a1c22, hemiI: 0.75, fog: 0x1e2b3c, dens: 0.0062, exp: 1.2, mount: 0x26344a, flood: 1, lights: 1 },
  { t: 0.92, tb: 9, ray: 2.4, mie: 0.009, gain: 0.36, cloud: 0.4, top: 0x101c33, hor: 0xff8a3d, sun: 0xff9a52, sunI: 2.1, elev: 3, az: 0, hemiS: 0x4b5b7b, hemiG: 0x2a2018, hemiI: 0.5, fog: 0xb46a42, dens: 0.0062, exp: 1.05, mount: 0x4a3b4a, flood: 0, lights: 1 },
];

function sampleTod(t) {
  let a = TOD[0], b = TOD[TOD.length - 1];
  for (let i = 0; i < TOD.length - 1; i++) if (t >= TOD[i].t && t <= TOD[i + 1].t) { a = TOD[i]; b = TOD[i + 1]; break; }
  if (t <= TOD[0].t) b = a; if (t >= b.t) a = b;
  const k = a === b ? 0 : (t - a.t) / (b.t - a.t);
  const out = {};
  for (const key of Object.keys(a)) {
    if (key === "t") continue;
    if (["top", "hor", "sun", "hemiS", "hemiG", "fog", "mount"].includes(key)) out[key] = new THREE.Color(a[key]).lerp(new THREE.Color(b[key]), k);
    else out[key] = lerp(a[key], b[key], k);
  }
  return out;
}

// ------------------------------------------------------------------------------------------
// builders
// ------------------------------------------------------------------------------------------
/** Physically based sky (Rayleigh/Mie scattering) with drifting clouds; one brightness control added. */
function buildSky() {
  const sky = new Sky();
  sky.scale.setScalar(2400);
  sky.frustumCulled = false; sky.renderOrder = -1;
  const u = sky.material.uniforms;
  u.mieDirectionalG.value = 0.82;
  u.cloudScale.value = 0.00022; u.cloudSpeed.value = 0.00003; u.cloudElevation.value = 0.55; u.cloudDensity.value = 0.55;
  const gain = { value: 0.55 };
  sky.material.onBeforeCompile = shader => {
    shader.uniforms.uSkyGain = gain;
    shader.fragmentShader = shader.fragmentShader
      .replace("uniform float time;", "uniform float time;\nuniform float uSkyGain;")
      .replace("gl_FragColor = vec4( texColor, 1.0 );", "gl_FragColor = vec4( texColor * uSkyGain, 1.0 );");
  };
  sky.userData.gain = gain;
  return sky;
}

function groundTextures(rand, quality) {
  const road = asphalt(2200 / 16, quality);
  const soilTex = soil([2200 / 4, 3.4], quality);
  const floor = plantationFloor([4000 / 7, 1600 / 7], quality);
  const barkTex = bark(quality);
  barkTex.map.repeat.set(1, 2); barkTex.normalMap.repeat.set(1, 2);
  const concrete = canvasTexture(256, 256, (ctx, w, h) => {
    noiseFill(ctx, w, h, "#8f8f88", 0.12, rand, 2);
    ctx.strokeStyle = "rgba(40,40,40,.35)"; ctx.lineWidth = 2; ctx.strokeRect(0, 0, w, h);
  }, { repeat: [12, 8] });
  const corrugated = canvasTexture(64, 64, (ctx, w, h) => {
    for (let x = 0; x < w; x++) { const v = 170 + Math.sin((x / w) * Math.PI * 8) * 22; ctx.fillStyle = `rgb(${v},${v + 2},${v})`; ctx.fillRect(x, 0, 1, h); }
  }, { repeat: [24, 3] });
  const frond = canvasTexture(512, 128, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = "#4a5a2a"; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2); ctx.stroke();
    for (let x = 4; x < w - 4; x += 3.2) {
      const len = Math.pow(Math.sin((x / w) * Math.PI), 0.7) * h * 0.5 * (0.8 + rand() * 0.2);
      for (const dir of [-1, 1]) {
        const g = 62 + rand() * 46;
        ctx.strokeStyle = `rgb(${Math.round(g * 0.62)},${Math.round(g)},${Math.round(g * 0.36)})`; ctx.lineWidth = 2.4;
        ctx.beginPath(); ctx.moveTo(x, h / 2); ctx.quadraticCurveTo(x + 6, h / 2 + dir * len * 0.6, x + 14, h / 2 + dir * len); ctx.stroke();
      }
    }
  }, { anisotropy: 4 });
  frond.wrapS = frond.wrapT = THREE.ClampToEdgeWrapping;
  return { road, soil: soilTex, floor, bark: barkTex, grassCard: grassCard(), concrete, corrugated, frond };
}

function frondGeometry() {
  // 5 m frond: arches up then droops, folded slightly along its rib
  const g = new THREE.PlaneGeometry(5.4, 2.1, 5, 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) + 2.7, y = p.getY(i);
    const u = x / 5.4;
    p.setX(i, x * 0.96);
    p.setZ(i, y * Math.pow(Math.sin(Math.PI * Math.min(0.98, u + 0.06)), 0.6));
    p.setY(i, 1.1 * u - 2.1 * u * u + Math.abs(y) * 0.3);
  }
  g.computeVertexNormals();
  return g;
}

/** Vertex-shader patch: loop instances inside [x0, x1) by the treadmill offset; optional wind sway. */
function injectInstanceLoop(material, { x0, x1, uniforms, wind }) {
  material.onBeforeCompile = shader => {
    if (uniforms) shader.uniforms.uTreadOffset = uniforms.offset;
    if (wind) shader.uniforms.uWind = wind;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>
        ${uniforms ? "uniform float uTreadOffset;" : ""}
        ${wind ? "uniform float uWind;" : ""}`)
      .replace("#include <begin_vertex>", `#include <begin_vertex>
        ${wind ? "transformed.x += sin(uWind * 1.7 + instanceMatrix[3][0] * 0.35 + instanceMatrix[3][2] * 0.2) * 0.09 * uv.y;" : ""}`)
      .replace("#include <project_vertex>", `
        mat4 loopMatrix = instanceMatrix;
        ${uniforms ? `loopMatrix[3][0] = mod(instanceMatrix[3][0] - uTreadOffset - ${x0.toFixed(1)}, ${(x1 - x0).toFixed(1)}) + ${x0.toFixed(1)};` : ""}
        vec4 mvPosition = vec4( transformed, 1.0 );
        mvPosition = loopMatrix * mvPosition;
        mvPosition = modelViewMatrix * mvPosition;
        gl_Position = projectionMatrix * mvPosition;`);
  };
  material.customProgramCacheKey = () => `loop-${uniforms ? x0 : "static"}-${wind ? "w" : ""}`;
}

/** Instanced oil-palm stand. If `tread` is set, instances loop along X in the vertex shader. */
function buildPalms(tex, rand, { x0, x1, rows, side, skip, tread, uniforms, verge = 24 }) {
  const trunks = [], crowns = [];
  const spacing = 9, rowGap = 7.8;
  for (let r = 0; r < rows; r++) {
    const z = side * ((side > 0 ? verge : 10) + r * rowGap);   // wider verge on the camera side
    for (let x = x0 + (r % 2) * spacing / 2; x < x1; x += spacing) {
      const jx = x + (rand() - 0.5) * 1.4, jz = z + (rand() - 0.5) * 1.4;
      if (skip && skip(jx, jz)) continue;
      const h = 4.2 + rand() * 3.2;
      trunks.push([jx, jz, h, rand() * 6.28, (rand() - 0.5) * 0.06]);
      // two tiers: upper fronds rise, lower fronds arch and droop (mature oil palm)
      for (let f = 0; f < 8; f++) crowns.push([jx, jz, h, (f / 8) * 6.28 + rand() * 0.4, 0.35 + rand() * 0.35, 0.8 + rand() * 0.25]);
      for (let f = 0; f < 9; f++) crowns.push([jx, jz, h - 0.35, (f / 9) * 6.28 + 0.35 + rand() * 0.4, -0.15 + rand() * 0.3, 0.95 + rand() * 0.3]);
    }
  }
  const trunkGeo = new THREE.CylinderGeometry(0.3, 0.45, 1, 8, 4); trunkGeo.translate(0, 0.5, 0);
  // bark: knobbly frond bases
  const tp = trunkGeo.attributes.position;
  for (let i = 0; i < tp.count; i++) { const k = 1 + Math.sin(tp.getY(i) * 26) * 0.08; tp.setX(i, tp.getX(i) * k); tp.setZ(i, tp.getZ(i) * k); }
  trunkGeo.computeVertexNormals();
  const trunkMat = new THREE.MeshStandardMaterial({ map: tex.bark.map, normalMap: tex.bark.normalMap, color: 0xb8a58c, roughness: 0.95 });
  const frondMat = new THREE.MeshStandardMaterial({ map: tex.frond, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.8, color: 0xc4d6a6 });

  if (tread) for (const mat of [trunkMat, frondMat]) injectInstanceLoop(mat, { x0, x1, uniforms });

  const trunk = new THREE.InstancedMesh(trunkGeo, trunkMat, trunks.length);
  const crown = new THREE.InstancedMesh(frondGeometry(), frondMat, crowns.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  trunks.forEach(([x, z, h, ry, lean], i) => {
    q.setFromEuler(e.set(lean, ry, lean)); trunk.setMatrixAt(i, m.compose(new THREE.Vector3(x, 0, z), q, new THREE.Vector3(1, h, 1)));
  });
  crowns.forEach(([x, z, h, ry, pitch, s], i) => {
    q.setFromEuler(e.set(0, ry, pitch, "YXZ").set(0, ry, 0)); // yaw first
    const q2 = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, pitch));
    q.multiply(q2);
    crown.setMatrixAt(i, m.compose(new THREE.Vector3(x, h - 0.2, z), q, new THREE.Vector3(s, s, s)));
  });
  trunk.castShadow = false; crown.castShadow = false;
  trunk.receiveShadow = true; crown.receiveShadow = true;
  // bounding spheres cover the whole stand (looping stands stay inside [x0, x1]) so off-screen stands are culled
  const zMid = side * ((side > 0 ? verge : 10) + (rows - 1) * rowGap / 2);
  const sphere = new THREE.Sphere(new THREE.Vector3((x0 + x1) / 2, 4, zMid), Math.hypot((x1 - x0) / 2, rows * rowGap / 2 + 6, 8));
  trunk.boundingSphere = sphere; crown.boundingSphere = sphere.clone();
  if (tread) { trunk.receiveShadow = false; crown.receiveShadow = false; }
  const g = new THREE.Group(); g.add(trunk, crown);
  g.userData.center = sphere.center.clone();
  return g;
}

/** Roadside grass clumps (three crossed cards), swaying in the wind. */
function buildGrass(tex, rand, { x0, x1, bands, density, tread, uniforms, wind, skip }) {
  const g = new THREE.PlaneGeometry(1.0, 0.55, 1, 2); g.translate(0, 0.275, 0);
  const parts = [0, 1, 2].map(i => g.clone().rotateY((i / 3) * Math.PI));
  const geo = mergeParts(parts); parts.forEach(p => p.dispose()); g.dispose();
  const items = [];
  for (const [za, zb] of bands) {
    const n = Math.round((x1 - x0) * Math.abs(zb - za) * density);
    for (let i = 0; i < n; i++) {
      const x = x0 + rand() * (x1 - x0), z = za + rand() * (zb - za);
      if (skip && skip(x, z)) continue;
      items.push([x, z, 0.45 + rand() * 0.5, rand() * 6.28]);
    }
  }
  const mat = new THREE.MeshStandardMaterial({ map: tex.grassCard, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.92, color: 0x8e9a78 });
  injectInstanceLoop(mat, { x0, x1, uniforms: tread ? uniforms : null, wind });
  const mesh = new THREE.InstancedMesh(geo, mat, items.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  items.forEach(([x, z, sc, ry], i) => mesh.setMatrixAt(i, m.compose(new THREE.Vector3(x, 0, z), q.setFromEuler(e.set(0, ry, 0)), new THREE.Vector3(sc, sc * (0.8 + (sc % 0.3)), sc))));
  const zs = bands.flat();
  const center = new THREE.Vector3((x0 + x1) / 2, 0.5, (Math.min(...zs) + Math.max(...zs)) / 2);
  mesh.boundingSphere = new THREE.Sphere(center, Math.hypot((x1 - x0) / 2, (Math.max(...zs) - Math.min(...zs)) / 2 + 2, 2));
  mesh.receiveShadow = true;
  const grp = new THREE.Group(); grp.add(mesh); grp.userData.center = center;
  return grp;
}

const POLE_Z = -6.4;
function buildPoles(mats, x0, x1, skip) {
  const C = new Collector();
  const pole = new THREE.CylinderGeometry(0.12, 0.16, 9, 8); pole.translate(0, 4.5, 0);
  const wires = [];
  for (let x = x0; x <= x1; x += 40) {
    if (skip && skip(x)) continue;
    C.add(pole, mats.concrete, { x, z: POLE_Z });
    C.box(0.12, 0.12, 1.8, mats.darkSteel, { x, y: 8.4, z: POLE_Z });
    if (x + 40 <= x1 && !(skip && skip(x + 40))) for (const dz of [-0.75, 0.75]) {
      for (let k = 0; k < 10; k++) {
        const a = k / 10, b = (k + 1) / 10, sag = t => 8.5 - Math.sin(Math.PI * t) * 0.9;
        wires.push(x + a * 40, sag(a), POLE_Z + dz, x + b * 40, sag(b), POLE_Z + dz);
      }
    }
  }
  const g = C.build({ castShadow: false });
  const wg = new THREE.BufferGeometry(); wg.setAttribute("position", new THREE.Float32BufferAttribute(wires, 3));
  g.add(new THREE.LineSegments(wg, new THREE.LineBasicMaterial({ color: 0x1a1d20, transparent: true, opacity: 0.7 })));
  return g;
}

function mound(radius, height, color, rand, seg = 56) {
  const g = new THREE.CircleGeometry(radius, seg, 0, Math.PI * 2); g.rotateX(-Math.PI / 2);
  // add rings for shape
  const rings = new THREE.RingGeometry(0.01, radius, seg, 18); rings.rotateX(-Math.PI / 2);
  const p = rings.attributes.position; const col = []; const c = new THREE.Color(); const base = new THREE.Color(color);
  for (let i = 0; i < p.count; i++) {
    const r = Math.hypot(p.getX(i), p.getZ(i)) / radius;
    const ang = Math.atan2(p.getZ(i), p.getX(i));
    const lobe = 1 + 0.12 * Math.sin(ang * 3 + height) + 0.06 * Math.sin(ang * 7);   // irregular footprint
    p.setY(i, Math.max(0, (1 - Math.pow(Math.min(1, r / lobe), 1.5)) * height + (rand() - 0.5) * height * 0.025));
    c.copy(base).multiplyScalar(0.8 + rand() * 0.4); col.push(c.r, c.g, c.b);
  }
  g.dispose();
  rings.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  rings.computeVertexNormals();
  const grain = canvasTexture(128, 128, (ctx, w, h) => noiseFill(ctx, w, h, "#9a9a9a", 0.5, rand, 1), { srgb: false, repeat: [radius / 1.5, radius / 1.5] });
  const mesh = new THREE.Mesh(rings, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.97, bumpMap: grain, bumpScale: 2.5 }));
  mesh.castShadow = true; mesh.receiveShadow = true;
  return mesh;
}

function sackStacks(mats, positions, rand) {
  const geo = new RoundedBoxGeometry(0.86, 0.2, 0.52, 1, 0.07);
  const items = [];
  for (const [x, z, cols, rows, layers] of positions)
    for (let l = 0; l < layers; l++) for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++)
      items.push([x + c * 0.9 + (rand() - 0.5) * 0.05, 0.25 + l * 0.2, z + r * 0.55, (rand() - 0.5) * 0.1]);
  const mesh = new THREE.InstancedMesh(geo, mats.sack, items.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion();
  items.forEach(([x, y, z, ry], i) => mesh.setMatrixAt(i, m.compose(new THREE.Vector3(x, y, z), q.setFromEuler(new THREE.Euler(0, ry, 0)), new THREE.Vector3(1, 1, 1))));
  mesh.castShadow = true; mesh.receiveShadow = true;
  return mesh;
}

function buildFacilities(mats, tex, rand, quality) {
  const root = new THREE.Group();
  const corrugated = new THREE.MeshStandardMaterial({ map: tex.corrugated, roughness: 0.6, metalness: 0.35, color: 0xd5d9dc });
  const apronMat = new THREE.MeshStandardMaterial({ map: tex.concrete, roughness: 0.95 });
  const apron = (x, w, d) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), apronMat); m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.015, -4.25 - d / 2); m.receiveShadow = true; root.add(m);
  };

  // ---- 1. Fertilizer warehouse ----
  {
    const X = ZONES.pupuk, Z = -34; apron(X, 96, 46);
    const C = new Collector();
    C.box(46, 11, 0.3, corrugated, { x: X + 5, y: 5.5, z: Z - 11 });
    C.box(0.3, 11, 22, corrugated, { x: X + 5 - 23, y: 5.5, z: Z });
    C.box(0.3, 11, 22, corrugated, { x: X + 5 + 23, y: 5.5, z: Z });
    C.box(10, 11, 0.3, corrugated, { x: X + 5 - 18, y: 5.5, z: Z + 11 });
    C.box(10, 11, 0.3, corrugated, { x: X + 5 + 18, y: 5.5, z: Z + 11 });
    C.box(26, 3, 0.3, corrugated, { x: X + 5, y: 9.5, z: Z + 11 });
    C.box(45.6, 0.1, 21.6, mats.darkInterior, { x: X + 5, y: 0.03, z: Z });
    C.box(45.6, 10.6, 0.1, mats.darkInterior, { x: X + 5, y: 5.4, z: Z - 10.7 });
    for (const s of [-1, 1]) C.box(47.2, 0.22, 12.4, mats.metalRoof, { x: X + 5, y: 12.3, z: Z + s * 5.6, rx: s * 0.22 });
    C.box(47.2, 0.3, 0.5, mats.darkSteel, { x: X + 5, y: 13.6, z: Z });
    C.box(30, 1.2, 4, mats.concrete, { x: X + 5, y: 0.6, z: Z + 13.2 });   // loading dock
    root.add(C.build());
    root.add(sackStacks(mats, [
      [X - 10, Z + 12.4, 4, 3, 6], [X - 3, Z + 12.4, 4, 3, 7], [X + 6, Z + 12.4, 4, 3, 5],
      [X - 14, Z + 2, 5, 4, 8], [X - 6, Z + 2, 5, 4, 8], [X + 2, Z + 2, 5, 4, 7], [X + 10, Z + 2, 5, 4, 8], [X + 18, Z + 2, 4, 4, 6],
      [X + 24, Z + 17, 3, 2, 4],
    ], rand));
  }

  // ---- 2. Palm-oil mill with an overhead shell loading hopper ----
  const smokeOrigin = new THREE.Vector3();
  const chuteOrigin = new THREE.Vector3();
  {
    const X = ZONES.cangkang; apron(X, 100, 52);
    const C = new Collector();
    C.box(34, 16, 22, corrugated, { x: X + 14, y: 8, z: -44 });
    C.box(34.6, 0.4, 22.6, mats.metalRoof, { x: X + 14, y: 16.2, z: -44 });
    C.box(16, 9, 12, mats.wallGrey, { x: X - 8, y: 4.5, z: -46 });
    const chimney = new THREE.CylinderGeometry(1.2, 1.7, 34, 18); chimney.translate(0, 17, 0);
    C.add(chimney, mats.wallGrey, { x: X + 26, z: -52 });
    const band = new THREE.CylinderGeometry(1.25, 1.25, 1.6, 18);
    C.add(band, mats.tail, { x: X + 26, y: 31.5, z: -52 });
    for (let i = 0; i < 3; i++) {
      const silo = new THREE.CylinderGeometry(3.4, 3.4, 13, 24); silo.translate(0, 6.5 + 1.5, 0);
      const cone = new THREE.ConeGeometry(3.6, 2.4, 24); cone.translate(0, 15.7, 0);
      const legs = new THREE.CylinderGeometry(3.2, 3.2, 1.5, 24, 1, true); legs.translate(0, 0.75, 0);
      C.add(silo, mats.steel, { x: X - 26 + i * 8, z: -30 }).add(cone, mats.metalRoof, { x: X - 26 + i * 8, z: -30 }).add(legs, mats.darkSteel, { x: X - 26 + i * 8, z: -30 });
    }
    // loading gantry over the truck lane
    // cantilevered loading gantry: legs only on the far side of the road, so nothing blocks the view of the truck
    for (const dx of [-1.6, 1.6]) for (const z of [-5.4, -7.6]) C.box(0.4, 9.6, 0.4, mats.darkSteel, { x: X - 1.1 + dx, y: 4.8, z });
    C.box(3.6, 0.6, 11.6, mats.darkSteel, { x: X - 1.1, y: 9.3, z: -1.6 });
    C.add(new THREE.BoxGeometry(0.25, 0.25, 6.4), mats.darkSteel, { x: X - 1.1, y: 7.6, z: -2.6, rx: -0.45 });   // diagonal brace
    C.box(3, 2.4, 3, mats.steel, { x: X - 1.1, y: 7.4, z: LANE_Z });               // hopper
    const chute = new THREE.CylinderGeometry(0.4, 0.7, 2.4, 12); C.add(chute, mats.steel, { x: X - 1.1, y: 5.0, z: LANE_Z });
    // conveyor from the mill to the hopper
    const conv = new THREE.BoxGeometry(1.1, 0.7, 40);
    C.add(conv, mats.darkSteel, { x: X - 1.1, y: 12.5, z: -19, rx: -0.17 });
    for (let k = 0; k < 4; k++) C.box(0.3, 6 + k * 2.2, 0.3, mats.darkSteel, { x: X - 1.1, y: (6 + k * 2.2) / 2, z: -8 - k * 8 });
    root.add(C.build());
    const heap = mound(10, 4.6, 0x3c2a1b, rand); heap.position.set(X - 26, 0, -14); root.add(heap);
    const heap2 = mound(6, 3, 0x35261a, rand); heap2.position.set(X - 12, 0, -16); root.add(heap2);
    smokeOrigin.set(X + 26, 34, -52);
    chuteOrigin.set(X - 1.1, 3.8, LANE_Z);
  }

  // ---- 3. Material yard ----
  {
    const X = ZONES.material; apron(X, 104, 56);
    [[X - 26, -22, 10, 5.2, 0x8a8172], [X - 4, -38, 13, 7.0, 0x7d776c], [X + 22, -20, 8, 4.0, 0x968c7c], [X + 30, -44, 11, 6, 0x857f72]]
      .forEach(([x, z, r, h, c]) => { const m = mound(r, h, c, rand); m.position.set(x, 0, z); root.add(m); });
    const C = new Collector();
    for (const dx of [-1.5, 1.5]) for (const dz of [-1.5, 1.5]) C.box(0.3, 6, 0.3, mats.darkSteel, { x: X + 12 + dx, y: 3, z: -14 + dz });
    C.box(4, 3, 4, mats.steel, { x: X + 12, y: 7.5, z: -14 });
    C.add(new THREE.BoxGeometry(22, 0.6, 1.1), mats.darkSteel, { x: X + 22, y: 6.5, z: -24, ry: 0.8, rz: 0.25 });
    C.box(18, 2.4, 2.6, mats.wallGrey, { x: X - 30, y: 1.2, z: -8 });     // site office
    root.add(C.build());
  }

  // ---- 4. Fleet depot ----
  const floodTargets = [];
  {
    const X = ZONES.depot; apron(X, 110, 60);
    const C = new Collector();
    C.box(34, 9, 18, corrugated, { x: X + 26, y: 4.5, z: -44 });
    C.box(34.6, 0.3, 18.6, mats.metalRoof, { x: X + 26, y: 9.1, z: -44 });
    C.box(6, 2.6, 2.4, mats.wallGrey, { x: X - 30, y: 1.3, z: -14 });
    for (const [x, z] of [[X - 16, 15], [X + 14, 15], [X, -30]]) {   // two masts across the road light the visible side
      C.box(0.35, 12, 0.35, mats.darkSteel, { x, y: 6, z });
      C.box(1.6, 0.4, 0.8, mats.headlight, { x, y: 12.1, z });
      floodTargets.push(new THREE.Vector3(x, 12, z));
    }
    root.add(C.build());
    const parked = quality.parkedTrucks;
    for (let i = 0; i < parked; i++) {
      const t = buildTruck(mats, { cargo: false });
      t.group.position.set(X - 18 + i * 14, 0, -26); t.group.rotation.y = Math.PI / 2;
      root.add(bakeStatic(t.group));   // parked: merge into a few static meshes
    }
  }
  return { root, smokeOrigin, chuteOrigin, floodTargets };
}

/** Merge every mesh of a (static) object into one mesh per material, in world space. */
function bakeStatic(object) {
  object.updateMatrixWorld(true);
  const byMat = new Map();
  object.traverse(o => {
    if (!o.isMesh || o.isInstancedMesh) return;
    const g = o.geometry.clone().applyMatrix4(o.matrixWorld);
    if (!byMat.has(o.material)) byMat.set(o.material, []);
    byMat.get(o.material).push(g);
  });
  const out = new THREE.Group();
  for (const [mat, geos] of byMat) {
    const mesh = new THREE.Mesh(mergeParts(geos), mat);
    geos.forEach(g => g.dispose());
    mesh.castShadow = true; mesh.receiveShadow = true; out.add(mesh);
  }
  object.traverse(o => { if (o.isMesh && o.geometry) o.geometry.dispose(); });
  return out;
}

function softDot(rand) {
  return canvasTexture(64, 64, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); void rand;
  }, { srgb: false });
}

// ------------------------------------------------------------------------------------------
export function buildWorld(scene, mats, quality) {
  const rand = rng(42);
  const tex = groundTextures(rand, quality);
  const root = new THREE.Group(); scene.add(root);

  // lights
  const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
  const sun = new THREE.DirectionalLight(0xffffff, 3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(quality.shadowSize, quality.shadowSize);
  Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 140 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
  root.add(hemi, sun, sun.target);

  const sky = buildSky(); scene.add(sky);
  scene.fog = new THREE.FogExp2(0xffffff, 0.005);

  // ground: plantation floor with large-scale colour variation (breaks up tiling)
  const groundGeo = new THREE.PlaneGeometry(4000, 1600, 200, 80);
  {
    const p = groundGeo.attributes.position, col = [];
    const rr = rng(77);
    const phase = [rr() * 6, rr() * 6, rr() * 6];
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i);
      const v = 0.86 + 0.14 * Math.sin(x * 0.011 + phase[0]) * Math.sin(y * 0.017 + phase[1]) + 0.08 * Math.sin(x * 0.047 + y * 0.031 + phase[2]) + (rr() - 0.5) * 0.06;
      const dry = Math.max(0, Math.sin(x * 0.006 + y * 0.009 + phase[2])) * 0.18;     // drier, yellower patches
      col.push(v + dry * 0.5, v + dry * 0.25, v - dry * 0.2);
    }
    groundGeo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  }
  const ground = new THREE.Mesh(groundGeo, new THREE.MeshStandardMaterial({
    map: tex.floor.map, normalMap: tex.floor.normalMap, roughnessMap: tex.floor.roughnessMap, normalScale: new THREE.Vector2(0.7, 0.7), vertexColors: true,
  }));
  ground.rotation.x = -Math.PI / 2; ground.position.set(650, 0, 0); ground.receiveShadow = true; root.add(ground);

  // asphalt with gravel grain, cracks, repairs, polished tyre tracks and worn paint
  const road = new THREE.Mesh(new THREE.PlaneGeometry(2200, ROAD_W), new THREE.MeshStandardMaterial({
    map: tex.road.map, roughnessMap: tex.road.roughnessMap, normalMap: tex.road.normalMap, normalScale: new THREE.Vector2(0.9, 0.9),
  }));
  road.rotation.x = -Math.PI / 2; road.position.set(650, 0.02, 0); road.receiveShadow = true; root.add(road);

  // laterite verge that frays into the grass (ragged alpha edge, no hard border)
  const vergeAlpha = canvasTexture(4, 256, (ctx, w, h) => {
    for (let y = 0; y < h; y++) { const v = y / h, e = Math.min(v, 1 - v); const a = Math.min(1, Math.max(0, (e - 0.02) / 0.12)); ctx.fillStyle = `rgb(${a * 255},${a * 255},${a * 255})`; ctx.fillRect(0, y, w, 1); }
  }, { srgb: false });
  vergeAlpha.wrapS = THREE.RepeatWrapping; vergeAlpha.wrapT = THREE.ClampToEdgeWrapping;
  const shoulder = new THREE.Mesh(new THREE.PlaneGeometry(2200, ROAD_W + 9), new THREE.MeshStandardMaterial({
    map: tex.soil.map, roughnessMap: tex.soil.roughnessMap, normalMap: tex.soil.normalMap, alphaMap: vergeAlpha, transparent: true, depthWrite: false,
  }));
  shoulder.rotation.x = -Math.PI / 2; shoulder.position.set(650, 0.012, 0); shoulder.receiveShadow = true; shoulder.renderOrder = 0; root.add(shoulder);

  // distant ranges (Bukit Barisan-like): three layered ridgelines, each hazier than the one in front
  const ridgeLayers = [];
  const ridge = (dist, height, seed, segs = 220) => {
    const r2 = rng(seed);
    const g = new THREE.PlaneGeometry(4200, 1, segs, 1);
    const p = g.attributes.position;
    let n1 = r2() * 10, n2 = r2() * 10;
    for (let i = 0; i <= segs; i++) {
      const x = i / segs;
      const y = height * (0.55 + 0.25 * Math.sin(x * 9 + n1) + 0.15 * Math.sin(x * 23 + n2) + 0.06 * Math.sin(x * 71 + n1 * 2) + (r2() - 0.5) * 0.04);
      p.setY(i, y);                 // top row
      p.setY(i + segs + 1, -40);    // bottom row
    }
    g.computeVertexNormals();
    const mat = new THREE.MeshBasicMaterial({ color: 0x5d6a78, fog: false });
    const m = new THREE.Mesh(g, mat);
    m.position.set(650, 0, -dist);
    ridgeLayers.push({ mat, haze: 0.18 + (dist - 700) / 1500 });
    const back = m.clone(); back.material = mat; back.position.z = dist + 200; back.rotation.y = Math.PI;
    root.add(m, back);
  };
  ridge(700, 120, 3); ridge(1000, 210, 5); ridge(1350, 330, 9);
  // plantations
  const treadUniforms = { offset: { value: 0 } };
  const inFacility = (x, z) => z < 0 && ["pupuk", "cangkang", "material", "depot"].some(k => Math.abs(x - ZONES[k]) < FACILITY_HALF + (z > -60 ? 0 : -999));
  const rows = quality.palmRows;
  const stands = [];
  const addStand = g => { root.add(g); stands.push(g); };
  for (const [a, b] of TREAD_ZONES) for (const side of [1, -1])
    addStand(buildPalms(tex, rand, { x0: a, x1: b, rows, side, tread: true, uniforms: treadUniforms, verge: quality.verge }));
  // static stands between the looping stretches, in 160 m chunks so off-screen chunks are culled
  for (let x = TREAD_ZONES[0][1]; x < TREAD_ZONES[1][0]; x += 160)
    for (const side of [1, -1])
      addStand(buildPalms(tex, rand, { x0: x, x1: Math.min(x + 160, TREAD_ZONES[1][0]), rows, side, skip: inFacility, verge: quality.verge }));

  // roadside grass: dense near the camera side of the road, thinner behind; loops with the treadmill in the drive stretches
  const wind = { value: 0 };
  const gd = quality.grassDensity;
  const grassBands = [[4.9, quality.verge - 3], [-4.9, -9]];
  for (const [a, b] of TREAD_ZONES)
    addStand(buildGrass(tex, rand, { x0: a, x1: b, bands: grassBands, density: gd, tread: true, uniforms: treadUniforms, wind }));
  for (let x = TREAD_ZONES[0][1]; x < TREAD_ZONES[1][0]; x += 160)
    addStand(buildGrass(tex, rand, { x0: x, x1: Math.min(x + 160, TREAD_ZONES[1][0]), bands: grassBands, density: gd * 0.7, wind, skip: inFacility }));

  // poles: looping in the tread zones (identical poles → simple group wrap), static elsewhere
  const treadPoles = TREAD_ZONES.map(([a, b]) => { const g = buildPoles(mats, a, b + 40); root.add(g); return { g, a }; });
  root.add(buildPoles(mats, TREAD_ZONES[0][1] + 40, TREAD_ZONES[1][0] - 40, x => ["pupuk", "cangkang", "material", "depot"].some(k => Math.abs(x - ZONES[k]) < FACILITY_HALF + 4)));

  const fac = buildFacilities(mats, tex, rand, quality);
  root.add(fac.root);

  // mill smoke (soft sprites)
  const dot = softDot(rand);
  const smoke = [];
  if (quality.smoke) for (let i = 0; i < 14; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: dot, color: 0xd9d6d0, transparent: true, opacity: 0.35, depthWrite: false }));
    s.userData.phase = i / 14; root.add(s); smoke.push(s);
  }

  // shell stream from the hopper chute into the truck body
  const streamCount = 180;
  const streamGeo = new THREE.BufferGeometry();
  const streamPos = new Float32Array(streamCount * 3); const seeds = new Float32Array(streamCount);
  for (let i = 0; i < streamCount; i++) seeds[i] = rand();
  streamGeo.setAttribute("position", new THREE.BufferAttribute(streamPos, 3));
  const stream = new THREE.Points(streamGeo, new THREE.PointsMaterial({ color: 0x3a2818, size: 0.09, sizeAttenuation: true }));
  stream.frustumCulled = false; stream.visible = false; root.add(stream);

  // dust kicked up behind the rear wheels while driving
  const dustTex = softDot(rand);
  const dust = Array.from({ length: quality.dust }, () => {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: dustTex, color: 0xb39672, transparent: true, opacity: 0, depthWrite: false }));
    sp.visible = false; sp.userData = { life: 1, v: new THREE.Vector3() }; root.add(sp); return sp;
  });
  let dustAcc = 0, dustNext = 0;

  // depot floodlights
  const floods = [];
  if (quality.spotlights) fac.floodTargets.slice(0, quality.spotlights).forEach(p => {
    const spot = new THREE.SpotLight(0xfff1d8, 0, 70, 0.62, 0.7, 1.5);
    spot.position.copy(p); spot.target.position.set(ZONES.depot, 0, LANE_Z);
    root.add(spot, spot.target); floods.push(spot);
  });

  // soft contact shadow that travels with the truck (anchors the wheels to the road)
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(10.5, 3.6), new THREE.MeshBasicMaterial({
    map: canvasTexture(128, 64, (ctx, w, h) => {
      const g = ctx.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2);
      g.addColorStop(0, "rgba(0,0,0,.55)"); g.addColorStop(0.6, "rgba(0,0,0,.25)"); g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    }, { srgb: false }), transparent: true, depthWrite: false }));
  blob.rotation.x = -Math.PI / 2; blob.position.y = 0.035; blob.renderOrder = 1; root.add(blob);

  let treadOffset = 0;
  const noAO = [sky, ...stands, ...smoke, ...dust, stream, blob, shoulder];
  const api = {
    sun, hemi, sky, noAO,
    tod: sampleTod(0),
    setTimeOfDay(t) {
      const s = sampleTod(t); api.tod = s;
      const el = THREE.MathUtils.degToRad(s.elev), az = THREE.MathUtils.degToRad(s.az);
      api.sunDir = new THREE.Vector3(Math.cos(az) * Math.cos(el), Math.sin(el), -Math.sin(az) * Math.cos(el));
      const u = sky.material.uniforms;
      u.sunPosition.value.copy(api.sunDir);
      u.turbidity.value = s.tb; u.rayleigh.value = s.ray; u.mieCoefficient.value = s.mie; u.cloudCoverage.value = s.cloud;
      sky.userData.gain.value = s.gain;
      // the light itself stays above the horizon (twilight keeps a soft directional fill)
      api.lightDir = new THREE.Vector3(Math.cos(az) * Math.cos(Math.max(el, 0.08)), Math.sin(Math.max(el, 0.08)), -Math.sin(az) * Math.cos(Math.max(el, 0.08)));
      sun.color.copy(s.sun); sun.intensity = s.sunI;
      hemi.color.copy(s.hemiS); hemi.groundColor.copy(s.hemiG); hemi.intensity = s.hemiI;
      scene.fog.color.copy(s.fog); scene.fog.density = s.dens;
      ridgeLayers.forEach(l => l.mat.color.copy(s.mount).lerp(s.hor, Math.min(0.85, l.haze)));
      floods.forEach(f => { f.intensity = s.flood * 380; });
      mats.headlight.emissiveIntensity = 0.08 + s.lights * 2.3;
      mats.tail.emissiveIntensity = 0.4 + s.lights * 1.4;
    },
    /** follow the truck: sky centred on camera, shadow frustum centred on the truck */
    follow(target, camera, truckPos) {
      sky.position.copy(camera.position);
      // stands deep in the haze are invisible anyway: skip drawing them
      for (const st of stands) st.visible = Math.abs(st.userData.center.x - camera.position.x) < 380;
      if (truckPos) blob.position.set(truckPos.x, 0.035, truckPos.z);
      sun.target.position.copy(target);
      sun.position.copy(target).addScaledVector(api.lightDir || new THREE.Vector3(0.5, 0.6, -0.5), 70);
    },
    /** treadmill distance (m): plantation, poles, road and ground scroll past a stationary truck */
    tread(distance) {
      treadOffset += distance;
      treadUniforms.offset.value = treadOffset;
      for (const t of [tex.road.map, tex.road.roughnessMap, tex.road.normalMap]) t.offset.x = treadOffset / 16;
      for (const t of [tex.floor.map, tex.floor.roughnessMap, tex.floor.normalMap]) t.offset.x = treadOffset / 7;
      for (const t of [tex.soil.map, tex.soil.roughnessMap, tex.soil.normalMap]) t.offset.x = treadOffset / 4;
      for (const { g } of treadPoles) g.position.x = -(treadOffset % 40);
    },
    /** pos: truck position, speed: |m/s| over the ground, groundVel: road velocity relative to the world (treadmill) */
    dust(pos, speed, groundVel, dt) {
      dustAcc += Math.min(1, speed / 9) * dt * 26;
      while (dustAcc > 1 && dust.length) {
        dustAcc -= 1;
        const sp = dust[dustNext]; dustNext = (dustNext + 1) % dust.length;
        sp.visible = true; sp.userData.life = 0;
        sp.position.set(pos.x - 2.2 - rand() * 1.2, 0.25, pos.z + (rand() < 0.5 ? -1.2 : 1.2) + (rand() - 0.5) * 0.3);
        sp.userData.v.set(groundVel * 0.7 + (rand() - 0.5) * 0.8, 0.35 + rand() * 0.45, (rand() - 0.5) * 0.9);
      }
      for (const sp of dust) {
        if (!sp.visible) continue;
        const u = sp.userData; u.life += dt / 1.9;
        if (u.life >= 1) { sp.visible = false; continue; }
        sp.position.addScaledVector(u.v, dt);
        sp.scale.setScalar(0.7 + u.life * 3.4);
        sp.material.opacity = 0.2 * (1 - u.life) * Math.min(1, u.life * 8);
      }
    },
    update(time, loading) {
      wind.value = time;
      sky.material.uniforms.time.value = time * 40;
      smoke.forEach(s => {
        const k = (s.userData.phase + time * 0.04) % 1;
        s.position.set(fac.smokeOrigin.x + k * 14 + Math.sin(k * 6 + s.userData.phase * 9) * 1.5, fac.smokeOrigin.y + k * 26, fac.smokeOrigin.z + k * 4);
        s.scale.setScalar(3 + k * 16);
        s.material.opacity = 0.32 * Math.sin(Math.PI * k);
      });
      stream.visible = loading > 0;
      if (stream.visible) {
        const o = fac.chuteOrigin;
        for (let i = 0; i < streamCount; i++) {
          const k = (seeds[i] + time * 1.6) % 1;
          streamPos[i * 3] = o.x + (seeds[(i * 7) % streamCount] - 0.5) * 0.5;
          streamPos[i * 3 + 1] = o.y - k * (o.y - 2.2);
          streamPos[i * 3 + 2] = o.z + (seeds[(i * 13) % streamCount] - 0.5) * 0.5;
        }
        streamGeo.attributes.position.needsUpdate = true;
      }
    },
  };
  api.setTimeOfDay(0);
  return api;
}
