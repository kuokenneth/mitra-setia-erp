import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { Collector, mergeParts, rng } from "./kit.js";
import { grilleNormal } from "./textures.js";

/*
 * Procedural heavy-duty 6×4 dump truck, proportioned after a Hino FM 280 JW
 * (cab-over, ~8.5 m long, 2.5 m wide, single front axle, tandem dual rear axles).
 * It is an illustrative model — no manufacturer logo, not an exact replica.
 *
 * Local axes: +X = forward, +Y = up, origin on the ground at mid-length.
 */
export const WHEEL_R = 0.53;
const WHEEL_W = 0.27;
const AXLES = [3.05, -1.65, -2.95];

// --- wheel geometry (shared by every wheel) ------------------------------------------
function buildWheelGeometries() {
  const r = WHEEL_R, w = WHEEL_W;
  const profile = [
    [0.31, -w / 2], [0.46, -w / 2], [0.51, -w / 2 + 0.02], [r, -w / 2 + 0.05],
    [r, w / 2 - 0.05], [0.51, w / 2 - 0.02], [0.46, w / 2], [0.31, w / 2],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  // Lathe revolves around Y; turn it so the axle runs along Z, then add tread blocks around it.
  const lathe = new THREE.LatheGeometry(profile, 40);
  lathe.rotateX(Math.PI / 2);
  const tireParts = [lathe];
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2;
    for (const side of [-1, 1]) {
      // block: x = along the tread, y = radial (sits on the tyre surface), z = across the tyre
      const g = new THREE.BoxGeometry(0.045, 0.012, w * 0.4);
      g.translate(0, r + 0.002, side * w * 0.22);
      g.rotateZ(a + side * 0.05);
      tireParts.push(g);
    }
  }
  const tire = mergeParts(tireParts);
  tireParts.forEach(g => g.dispose());

  const metalParts = [];
  const rim = new THREE.CylinderGeometry(0.31, 0.31, w * 0.86, 32, 1, true); rim.rotateX(Math.PI / 2); metalParts.push(rim);
  const disc = new THREE.CylinderGeometry(0.27, 0.27, 0.02, 32); disc.rotateX(Math.PI / 2); disc.translate(0, 0, w * 0.32); metalParts.push(disc);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const nut = new THREE.CylinderGeometry(0.02, 0.02, 0.05, 6); nut.rotateX(Math.PI / 2);
    nut.translate(Math.cos(a) * 0.165, Math.sin(a) * 0.165, w * 0.36); metalParts.push(nut);
  }
  // ventilation holes suggested by dark slots on the disc
  const metal = mergeParts(metalParts); metalParts.forEach(g => g.dispose());

  const hubParts = [];
  const hubCore = new THREE.CylinderGeometry(0.11, 0.13, 0.12, 20); hubCore.rotateX(Math.PI / 2); hubCore.translate(0, 0, w * 0.36); hubParts.push(hubCore);
  for (let i = 0; i < 8; i++) {   // ventilation holes in the disc
    const a = (i / 8) * Math.PI * 2 + 0.2;
    const hole = new THREE.CylinderGeometry(0.035, 0.035, 0.022, 12); hole.rotateX(Math.PI / 2);
    hole.translate(Math.cos(a) * 0.225, Math.sin(a) * 0.225, w * 0.33); hubParts.push(hole);
  }
  // sidewall ring (raised bead) reads as a real tyre at close range
  const bead = new THREE.TorusGeometry(0.43, 0.012, 6, 40); bead.translate(0, 0, w * 0.5); hubParts.push(bead);
  const hub = mergeParts(hubParts); hubParts.forEach(g => g.dispose());
  return { tire, metal, hub };
}

// --- cargo -------------------------------------------------------------------------------
const BODY = { x0: -4.1, x1: 1.9, floor: 1.42, top: 2.55, halfW: 1.14 };

function buildSacks(mats, rand) {
  const geo = new RoundedBoxGeometry(0.86, 0.2, 0.52, 1, 0.07);
  const rows = 6, cols = 4, layers = 11;
  const positions = [];
  const len = BODY.x1 - BODY.x0 - 0.3;
  for (let l = 0; l < layers; l++) {
    // pile narrows towards the top, like the loaded trucks in the company photos
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const x = BODY.x0 + 0.6 + (r / (rows - 1)) * (len - 0.6);
      const z = -0.81 + c * 0.54;
      if (Math.abs(z) > 0.6 && l > 7) continue;                 // outer columns stop lower: a rounded pile
      if ((r === 0 || r === rows - 1) && l > 6) continue;
      if ((r === 1 || r === rows - 2) && l > 9) continue;
      positions.push([x + (rand() - 0.5) * 0.06, BODY.floor + 0.1 + l * 0.19, z + (rand() - 0.5) * 0.05, (rand() - 0.5) * 0.12]);
    }
  }
  const mesh = new THREE.InstancedMesh(geo, mats.sack, positions.length);
  const m = new THREE.Matrix4(); const q = new THREE.Quaternion(); const s = new THREE.Vector3(1, 1, 1);
  positions.forEach(([x, y, z, ry], i) => {
    q.setFromEuler(new THREE.Euler((rand() - 0.5) * 0.06, ry, (rand() - 0.5) * 0.06));
    mesh.setMatrixAt(i, m.compose(new THREE.Vector3(x, y, z), q, s));
  });
  mesh.castShadow = true; mesh.receiveShadow = true;
  mesh.userData.total = positions.length;
  return mesh;
}

function buildHeap(color, rand, roughness = 0.95) {
  const lenX = BODY.x1 - BODY.x0 - 0.12, lenZ = BODY.halfW * 2 - 0.08;
  const geo = new THREE.PlaneGeometry(lenX, lenZ, 44, 18);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position; const col = []; const base = new THREE.Color(color); const c = new THREE.Color();
  const wallH = BODY.top - BODY.floor;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) / (lenX / 2), z = pos.getZ(i) / (lenZ / 2);
    const mound = Math.max(0, 1 - (x * x * 0.55 + z * z * 0.9));
    const h = wallH * 0.82 + mound * 0.55 + (rand() - 0.5) * 0.07;
    pos.setY(i, h);
    const v = 0.8 + rand() * 0.4; c.copy(base).multiplyScalar(v); col.push(c.r, c.g, c.b);
  }
  geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness, metalness: 0, flatShading: true });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set((BODY.x0 + BODY.x1) / 2, BODY.floor, 0);
  mesh.castShadow = true; mesh.receiveShadow = true;
  return mesh;
}

// --- truck -----------------------------------------------------------------------------
export function buildTruck(mats, { cargo = true } = {}) {
  const rand = rng(7);
  const truck = new THREE.Group();
  const chassis = new THREE.Group();   // everything above the axles (gets a little suspension bob)
  truck.add(chassis);
  const C = new Collector();

  // frame rails, cross members, under-run bars
  C.box(7.95, 0.26, 0.1, mats.darkSteel, { x: -0.07, y: 0.95, z: 0.46 });
  C.box(7.95, 0.26, 0.1, mats.darkSteel, { x: -0.07, y: 0.95, z: -0.46 });
  for (const x of [2.2, 0.6, -0.8, -2.3, -3.6]) C.box(0.12, 0.18, 0.9, mats.darkSteel, { x, y: 0.95 });
  C.box(0.12, 0.12, 2.3, mats.darkSteel, { x: -4.12, y: 0.62 });          // rear under-run bar
  for (const z of [-0.9, 0.9]) C.box(0.08, 0.4, 0.08, mats.darkSteel, { x: -4.05, y: 0.8, z });
  C.box(0.06, 0.14, 0.36, mats.tail, { x: -4.17, y: 0.7, z: 0.95 });       // tail lamps
  C.box(0.06, 0.14, 0.36, mats.tail, { x: -4.17, y: 0.7, z: -0.95 });
  C.box(1.6, 0.12, 0.08, mats.darkSteel, { x: -0.2, y: 0.58, z: 1.24 });  // side guard rails
  C.box(1.6, 0.12, 0.08, mats.darkSteel, { x: -0.2, y: 0.58, z: -1.24 });

  // --- cab (cab-over) ---
  const cabGeo = new RoundedBoxGeometry(1.92, 1.95, 2.34, 5, 0.16);
  C.add(cabGeo, mats.paint, { x: 3.16, y: 2.04 });
  C.box(1.96, 0.34, 2.38, mats.paintDark, { x: 3.14, y: 1.22 });          // lower cab panel
  C.box(0.05, 0.86, 2.14, mats.glass, { x: 4.12, y: 2.47, rz: -0.09 });     // windshield (raked)
  C.box(0.05, 0.06, 2.2, mats.plastic, { x: 4.15, y: 2.03 });             // lower seal
  for (const z of [-1, 1]) C.box(0.06, 0.9, 0.09, mats.plastic, { x: 4.12, y: 2.47, z: z * 1.1, rz: -0.09 }); // A-pillars
  C.box(0.03, 0.03, 0.9, mats.plastic, { x: 4.17, y: 2.08, z: 0.45, rx: 0.5 });   // wipers
  C.box(0.03, 0.03, 0.9, mats.plastic, { x: 4.17, y: 2.08, z: -0.45, rx: 0.5 });
  C.box(0.32, 0.06, 2.24, mats.paintDark, { x: 4.13, y: 2.97 });          // sun visor
  if (!mats.grille.normalMap) { mats.grille.normalMap = grilleNormal(); mats.grille.normalScale.set(1.2, 1.2); }
  C.box(0.04, 0.52, 1.56, mats.grille, { x: 4.13, y: 1.7 });              // grille panel (mesh pattern)
  C.box(0.05, 0.6, 0.06, mats.paintDark, { x: 4.14, y: 1.7, z: 0.81 });   // grille surround
  C.box(0.05, 0.6, 0.06, mats.paintDark, { x: 4.14, y: 1.7, z: -0.81 });
  for (const y of [1.55, 1.7, 1.85]) C.box(0.04, 0.05, 1.5, mats.chrome, { x: 4.16, y });
  for (const z of [-1, 1]) {
    C.box(1.02, 0.62, 0.03, mats.glass, { x: 3.42, y: 2.52, z: z * 1.172 });    // side window
    C.box(0.02, 1.25, 0.02, mats.plastic, { x: 2.8, y: 1.95, z: z * 1.175 });   // door seam
    C.box(0.06, 0.06, 0.3, mats.darkSteel, { x: 3.98, y: 2.55, z: z * 1.3 });   // mirror arm
    C.box(0.1, 0.46, 0.24, mats.plastic, { x: 3.98, y: 2.36, z: z * 1.46 });    // mirror head
    C.box(0.12, 0.3, 0.16, mats.plastic, { x: 4.1, y: 2.95, z: z * 1.32 });     // kerb mirror
    C.box(0.4, 0.06, 0.3, mats.darkSteel, { x: 3.62, y: 0.82, z: z * 1.1 });    // steps
    C.box(0.4, 0.06, 0.3, mats.darkSteel, { x: 3.62, y: 0.5, z: z * 1.1 });
    C.box(0.06, 0.16, 0.42, mats.headlight, { x: 4.31, y: 0.98, z: z * 0.88 }); // headlights
    C.box(0.05, 0.08, 0.16, mats.amber, { x: 4.31, y: 0.86, z: z * 1.1 });     // indicators
  }
  C.box(0.26, 0.36, 2.44, mats.darkSteel, { x: 4.18, y: 0.93 });          // bumper
  C.box(0.16, 0.1, 0.5, mats.amber, { x: 3.55, y: 3.08 });                // roof beacon base
  const beacon = new THREE.CylinderGeometry(0.1, 0.12, 0.16, 16);
  C.add(beacon, mats.amber, { x: 3.55, y: 3.2 });

  // wheel-arch shells over the front axle
  // half-cylinder shell: theta -90°..90° gives the +Z half; rotating -90° about X lays it over the wheel top
  const arch = new THREE.CylinderGeometry(0.66, 0.66, 0.34, 24, 1, true, -Math.PI * 0.5, Math.PI);
  arch.rotateX(-Math.PI / 2);
  for (const z of [-1.04, 1.04]) C.add(arch, mats.plastic, { x: AXLES[0], y: WHEEL_R + 0.02, z });

  // behind the cab: exhaust stack, air intake, fuel tank, battery box, air tanks
  const stack = new THREE.CylinderGeometry(0.075, 0.075, 1.9, 16);
  C.add(stack, mats.chrome, { x: 2.05, y: 2.35, z: -1.0 });
  C.box(0.24, 1.2, 0.36, mats.plastic, { x: 2.05, y: 2.2, z: 1.0 });
  const tank = new THREE.CylinderGeometry(0.3, 0.3, 1.25, 24); tank.rotateZ(Math.PI / 2);
  C.add(tank, mats.steel, { x: 1.05, y: 0.82, z: 0.86 });
  C.box(0.9, 0.5, 0.5, mats.plastic, { x: 1.05, y: 0.82, z: -0.86 });
  const airTank = new THREE.CylinderGeometry(0.13, 0.13, 0.9, 16); airTank.rotateZ(Math.PI / 2);
  C.add(airTank, mats.darkSteel, { x: -0.2, y: 0.72, z: 0.62 });
  C.add(airTank, mats.darkSteel, { x: -0.2, y: 0.72, z: -0.62 });

  // rear mudguards over the tandem
  for (const z of [-1.01, 1.01]) {
    C.box(2.3, 0.04, 0.66, mats.plastic, { x: -2.3, y: 1.18, z });
    C.box(0.04, 0.5, 0.62, mats.rubber, { x: -3.58, y: 0.9, z });
  }

  // --- dump body ---
  const bodyMat = mats.paint;
  const L = BODY.x1 - BODY.x0, cx = (BODY.x0 + BODY.x1) / 2;
  C.box(L, 0.14, 2.42, mats.darkSteel, { x: cx, y: 1.32 });              // subframe/floor
  C.box(L, 0.08, 2.32, bodyMat, { x: cx, y: BODY.floor - 0.03 });
  C.box(L, 1.14, 0.06, bodyMat, { x: cx, y: 1.98, z: 1.2 });             // side walls
  C.box(L, 1.14, 0.06, bodyMat, { x: cx, y: 1.98, z: -1.2 });
  C.box(0.08, 1.46, 2.46, bodyMat, { x: BODY.x1, y: 2.14 });             // headboard
  C.box(0.42, 0.06, 2.46, bodyMat, { x: BODY.x1 + 0.2, y: 2.86 });       // cab protector
  C.box(0.08, 1.16, 2.46, bodyMat, { x: BODY.x0, y: 1.98 });             // tailgate
  for (const z of [-1, 1]) {
    C.box(L + 0.05, 0.1, 0.12, mats.paintDark, { x: cx, y: 2.58, z: z * 1.22 });          // top rail
    for (const y of [1.72, 2.16]) C.box(L, 0.06, 0.05, mats.paintDark, { x: cx, y, z: z * 1.24 });
    for (let x = BODY.x0 + 0.35; x < BODY.x1 - 0.2; x += 0.62) C.box(0.06, 1.12, 0.06, bodyMat, { x, y: 1.98, z: z * 1.25 });
  }
  for (const z of [-0.8, 0, 0.8]) C.box(0.06, 1.1, 0.06, mats.paintDark, { x: BODY.x0 - 0.05, y: 1.98, z });
  const ram = new THREE.CylinderGeometry(0.09, 0.09, 1.1, 16);
  C.add(ram, mats.chrome, { x: 2.05, y: 1.05, rz: 0.35 });

  // ---- extra detail: cab hardware ----
  for (const z of [-1, 1]) {
    C.box(0.16, 0.035, 0.04, mats.chrome, { x: 3.0, y: 1.92, z: z * 1.19 });          // door handle
    C.box(0.03, 0.6, 0.04, mats.chrome, { x: 2.27, y: 1.95, z: z * 1.19 });           // grab handle
    C.box(0.05, 0.08, 0.14, mats.amber, { x: 2.35, y: 1.15, z: z * 1.2 });            // side marker
    C.box(0.12, 0.12, 0.2, mats.headlight, { x: 4.3, y: 0.78, z: z * 0.55 });         // fog lamp
    C.box(0.03, 0.42, 0.42, mats.rubber, { x: AXLES[0] - 0.65, y: 0.42, z: z * 1.04 }); // front mud flap
    C.box(0.46, 0.04, 0.32, mats.steel, { x: 3.62, y: 0.845, z: z * 1.1 });           // tread plates on steps
    C.box(0.46, 0.04, 0.32, mats.steel, { x: 3.62, y: 0.525, z: z * 1.1 });
  }
  C.box(0.04, 0.16, 0.5, mats.plastic, { x: 4.33, y: 0.62 });                         // number plate (blank)
  C.box(0.02, 0.12, 0.46, mats.darkInterior, { x: 4.35, y: 0.62 });
  for (const z of [-0.35, 0.35]) C.box(0.12, 0.08, 0.06, mats.darkSteel, { x: 4.34, y: 0.72, z }); // tow hooks
  // cab back wall and air deflector line
  C.box(0.04, 1.6, 2.2, mats.paintDark, { x: 2.19, y: 2.1 });

  // ---- running gear: axle housings, differentials, leaf springs, prop shaft ----
  const axleTube = new THREE.CylinderGeometry(0.075, 0.075, 1.9, 12); axleTube.rotateX(Math.PI / 2);
  for (const x of AXLES) {
    C.add(axleTube, mats.darkSteel, { x, y: WHEEL_R });
    if (x < 0) {
      const diff = new THREE.SphereGeometry(0.26, 14, 10);
      C.add(diff, mats.darkSteel, { x, y: WHEEL_R, sx: 1.1, sy: 0.9, sz: 0.9 });
    }
    for (const z of [-0.46, 0.46]) {
      // leaf spring pack: stacked, slightly arched leaves
      for (let k = 0; k < 4; k++) {
        const len = 1.3 - k * 0.22;
        C.box(len, 0.035, 0.09, mats.darkSteel, { x, y: WHEEL_R + 0.13 + k * 0.038, z });
      }
      C.box(0.12, 0.2, 0.12, mats.darkSteel, { x, y: WHEEL_R + 0.12, z });          // U-bolt block
      C.add(new THREE.CylinderGeometry(0.07, 0.07, 0.12, 10), mats.darkSteel, { x: x - 0.25, y: WHEEL_R - 0.05, z: z * 1.5, rx: Math.PI / 2 }); // brake chamber
    }
  }
  const prop = new THREE.CylinderGeometry(0.05, 0.05, 1, 10); prop.rotateZ(Math.PI / 2);
  C.add(prop, mats.darkSteel, { x: 0.7, y: 0.66, sx: 2.6 });                          // gearbox → first rear axle
  C.add(prop, mats.darkSteel, { x: -2.3, y: WHEEL_R, sx: 1.2 });                      // between rear axles
  C.box(0.6, 0.45, 0.5, mats.darkSteel, { x: 2.05, y: 0.82 });                        // gearbox

  // ---- dump body: corner posts, tailgate hinges, ladder ----
  for (const z of [-1, 1]) {
    C.box(0.1, 1.2, 0.1, mats.paintDark, { x: BODY.x0 + 0.05, y: 1.98, z: z * 1.23 });
    C.box(0.1, 1.2, 0.1, mats.paintDark, { x: BODY.x1 - 0.05, y: 2.0, z: z * 1.23 });
    C.box(0.16, 0.1, 0.12, mats.darkSteel, { x: BODY.x0 - 0.06, y: 2.52, z: z * 0.95 });   // tailgate hinge
  }
  for (const dx of [0, 0.36]) C.box(0.04, 1.3, 0.04, mats.darkSteel, { x: BODY.x1 - 0.35 - dx, y: 1.9, z: 1.27 });     // ladder rails
  for (let k = 0; k < 5; k++) C.box(0.4, 0.035, 0.04, mats.darkSteel, { x: BODY.x1 - 0.53, y: 1.4 + k * 0.26, z: 1.27 });   // ladder rungs

  const staticParts = C.build();
  chassis.add(staticParts);

  // --- wheels ---
  const wg = buildWheelGeometries();
  const wheels = [];
  const addWheel = (x, z, mirror) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, WHEEL_R, z);
    if (mirror) pivot.scale.z = -1;
    const spin = new THREE.Group();
    for (const [geo, mat] of [[wg.tire, mats.rubber], [wg.metal, mats.rim], [wg.hub, mats.darkSteel]]) {
      const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; spin.add(m);
    }
    pivot.add(spin); truck.add(pivot); wheels.push(spin);
  };
  addWheel(AXLES[0], 1.04, false); addWheel(AXLES[0], -1.04, true);
  for (const x of AXLES.slice(1)) {
    addWheel(x, 1.16, false); addWheel(x, 0.86, false);
    addWheel(x, -1.16, true); addWheel(x, -0.86, true);
  }

  // --- cargo variants ---
  let sacks = null; const heaps = {};
  if (cargo) {
    sacks = buildSacks(mats, rand); chassis.add(sacks);
    heaps.cangkang = buildHeap(0x3e2b1c, rand);        // palm kernel shells: dark, coarse
    heaps.material = buildHeap(0x8b8476, rand);        // neutral bulk material (exact "ambang" cargo still to confirm)
    Object.values(heaps).forEach(h => { h.visible = false; chassis.add(h); });
  }

  let spinAngle = 0;
  return {
    group: truck,
    wheels,
    /** distance travelled (m) since the last call → wheels turn exactly with the ground */
    roll(distance) {
      spinAngle -= distance / WHEEL_R;
      for (const w of wheels) w.rotation.z = spinAngle;
    },
    /** suspension: a few millimetres of body movement while driving, none when parked */
    bob(time, speed) {
      const a = Math.min(1, Math.abs(speed) / 8);
      chassis.position.y = Math.sin(time * 11) * 0.006 * a + Math.sin(time * 3.7) * 0.004 * a;
      chassis.rotation.z = Math.sin(time * 2.3) * 0.002 * a;
    },
    /** type: "pupuk" | "cangkang" | "material" | null, fill 0..1 */
    setCargo(type, fill = 1) {
      if (!cargo) return;
      sacks.count = type === "pupuk" ? Math.round(sacks.userData.total * Math.max(0, Math.min(1, fill))) : 0;
      sacks.visible = sacks.count > 0;
      for (const [k, h] of Object.entries(heaps)) {
        const f = k === type ? Math.max(0, Math.min(1, fill)) : 0;
        h.visible = f > 0.01;
        h.scale.y = Math.max(0.01, f);
      }
    },
    setLights(on) {
      mats.headlight.emissiveIntensity = on ? 2.4 : 0.6;
      mats.tail.emissiveIntensity = on ? 1.6 : 0.4;
    },
  };
}
