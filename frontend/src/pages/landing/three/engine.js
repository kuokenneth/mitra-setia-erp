import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { GTAOPass } from "three/examples/jsm/postprocessing/GTAOPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { createMaterials, damp, disposeObject, lerp, smoothstep } from "./kit.js";
import { buildTruck } from "./truck.js";
import { buildWorld, LANE_Z, ZONES } from "./world.js";

/*
 * Scroll-driven scene. The page tells the engine which "window" section is on screen and how far
 * through it the visitor is (segment + progress 0..1); the engine turns that into a truck position,
 * a camera pose, cargo, and time of day — all eased, so reversing the scroll simply plays it back.
 */

const Z = ZONES;

// camera pose: az = angle around the truck (0 front, 90 driver's left side, 180 behind), dist, h = height,
// look = point on the truck to aim at (x along truck, y height), fov, shift = horizontal film offset
const P = (az, dist, h, lookY = 1.7, lookX = 0, fov = 34, shift = 0) => ({ az, dist, h, lookY, lookX, fov, shift });

const SEGMENTS = {
  hero: {
    cams: [[0, P(30, 32, 2.2, 2.0, -0.8, 30, -7.5)], [1, P(50, 21, 7.5, 1.5, 0, 30, -5)]],   // camera further back: truck sits deeper in the scene; path stays on the open verge
    travel: [],
    x: Z.hero, tod: [[0, 0.04], [1, 0.08]], tread: 11,
    cargo: () => ["pupuk", 1, 0],
  },
  services: {
    cams: [
      [0.0, P(20, 17, 2.2, 1.8, 0, 34, -8)], [0.18, P(55, 16, 2.6, 1.8, 0, 34, -8)], [0.29, P(95, 17.5, 3, 1.8, 0, 34, -8)],
      [0.34, P(140, 19, 5.5, 1.6, 4, 36, -3)], [0.43, P(152, 22, 7, 1.6, 6, 36, -3)],
      [0.48, P(62, 18, 4.6, 2.6, 0, 36, -8)], [0.57, P(110, 17, 3.6, 2.2, 0, 34, -8)],
      [0.62, P(160, 18, 4.5, 1.6, 4, 36, -3)], [0.70, P(150, 20, 5, 1.6, 4, 36, -3)],
      [0.75, P(70, 16, 3, 1.8, 0, 34, -8)], [0.80, P(180, 16, 3.5, 1.8, 0, 34, -7)], [0.85, P(285, 16, 3.5, 1.8, 0, 34, -7)],
      [0.90, P(200, 20, 6, 1.6, 4, 36, -2)], [0.97, P(60, 15, 2.5, 1.8, 0, 34, 0)], [1.0, P(35, 14.5, 1.9, 1.7, 0, 34, 0)],
    ],
    // [u0, u1, x0, x1] — the truck drives these stretches; parked elsewhere
    travel: [[0, 0.18, Z.pupuk - 70, Z.pupuk], [0.30, 0.47, Z.pupuk, Z.cangkang], [0.58, 0.74, Z.cangkang, Z.material], [0.86, 1.0, Z.material, Z.depot]],
    tod: [[0, 0.24], [0.85, 0.3], [1, 0.72]], tread: 0,
    cargo: u => {
      if (u < 0.33) return ["pupuk", 1, 0];
      if (u < 0.42) return ["pupuk", 1 - smoothstep(0.33, 0.42, u), 0];          // delivered while travelling
      if (u < 0.48) return [null, 0, 0];
      if (u < 0.56) return ["cangkang", smoothstep(0.48, 0.56, u), 1];           // shells pour from the hopper
      if (u < 0.66) return ["cangkang", 1, 0];
      if (u < 0.69) return ["cangkang", 1 - smoothstep(0.66, 0.69, u), 0];
      if (u < 0.72) return ["material", smoothstep(0.69, 0.72, u), 0];
      if (u < 0.9) return ["material", 1, 0];
      return ["material", 1 - smoothstep(0.9, 0.98, u), 0];
    },
  },
  fleet: {
    cams: [[0, P(35, 14.5, 1.9)], [0.24, P(90, 15.5, 2.3, 1.6)], [0.48, P(150, 14.5, 2.6, 1.6)],
      [0.7, P(118, 7.2, 1.25, 0.8, -2.3, 30)], [0.9, P(60, 8.5, 7, 2.0, -1.1, 34)], [1, P(60, 8.5, 7, 2.0, -1.1, 34)]],
    travel: [], x: Z.depot, tod: [[0, 0.72], [1, 0.72]], tread: 0,
    cargo: () => [null, 0, 0],
  },
  cta: {
    cams: [[0, P(206, 13, 2.4, 2.2, 22, 36, 0)], [1, P(192, 17, 3.4, 2.4, 40, 36, 0)]],
    travel: [], x: Z.cta, tod: [[0, 0.9], [1, 0.93]], tread: 10,
    cargo: () => ["material", 1, 0],
  },
};
export const FLEET_VIEWS = [0, 0.24, 0.48, 0.7, 0.9];
// portrait only: fraction of the screen height the image is shifted up (truck above the text block)
const PORTRAIT_LIFT = { hero: 0.06, services: 0.16, fleet: 0.02, cta: 0 };

function interpKeys(keys, t) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 0; i < keys.length - 1; i++) {
    const [a, va] = keys[i], [b, vb] = keys[i + 1];
    if (t <= b) {
      const k = smoothstep(a, b, t);
      if (typeof va === "number") return lerp(va, vb, k);
      const out = {};
      for (const key of Object.keys(va)) {
        if (key === "az") { let d = ((vb.az - va.az + 540) % 360) - 180; out.az = va.az + d * k; }
        else out[key] = lerp(va[key], vb[key], k);
      }
      return out;
    }
  }
  return keys[keys.length - 1][1];
}

function truckXFor(seg, u) {
  if (seg.x !== undefined) return seg.x;
  let x = seg.travel[0][2];
  for (const [u0, u1, x0, x1] of seg.travel) {
    if (u >= u1) x = x1;
    else if (u >= u0) { x = lerp(x0, x1, smoothstep(u0, u1, u)); break; }
    else break;
  }
  return x;
}

export function createEngine(canvas, { mobile = false, reducedMotion = false } = {}) {
  const quality = mobile
    ? { dprMax: 1.25, shadowSize: 1024, palmRows: 3, parkedTrucks: 1, spotlights: 1, smoke: true, antialias: false, verge: 34, texSize: 512, grassDensity: 0.06, dust: 18, post: false }
    : { dprMax: 1.6, shadowSize: 2048, palmRows: 5, parkedTrucks: 2, spotlights: 2, smoke: true, antialias: true, verge: 30, texSize: 1024, grassDensity: 0.12, dust: 40, post: true };

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: quality.antialias, powerPreference: "high-performance", alpha: false });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  let dpr = Math.min(window.devicePixelRatio || 1, quality.dprMax);
  renderer.setPixelRatio(dpr);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  let envRT = null;
  scene.environmentIntensity = 0.55;

  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 3200);
  const mats = createMaterials();
  const truck = buildTruck(mats, { cargo: true });
  truck.group.position.set(Z.hero, 0, LANE_Z);
  scene.add(truck.group);
  const world = buildWorld(scene, mats, quality);

  // reflections come from the live sky: re-baked only when the time of day moves noticeably
  const envScene = new THREE.Scene();
  const envSky = new THREE.Mesh(world.sky.geometry, world.sky.material);
  envSky.scale.copy(world.sky.scale);
  envScene.add(envSky);

  // ---- post-processing (desktop): ambient occlusion for contact shading, a subtle bloom on lights ----
  const AO_SKIP_LAYER = 1;
  world.noAO.forEach(o => o.traverse(c => c.layers.set(AO_SKIP_LAYER)));
  camera.layers.enable(AO_SKIP_LAYER);
  let composer = null, gtao = null;
  if (quality.post) {
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    const target = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 4 });
    composer = new EffectComposer(renderer, target);
    composer.addPass(new RenderPass(scene, camera));
    gtao = new GTAOPass(scene, camera, size.x, size.y);
    gtao.blendIntensity = 0.85;
    gtao.updateGtaoMaterial({ radius: 0.8, distanceExponent: 1.5, thickness: 1.2, scale: 1.1, samples: 12 });
    gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 5, rings: 2, samples: 12 });
    // the AO pass redraws the scene with one override material (no alpha cut-outs, no instance looping):
    // skip foliage, sky and particles there so they leave no dark rectangles
    const renderOverride = gtao._renderOverride.bind(gtao);
    gtao._renderOverride = (...args) => {
      camera.layers.disable(AO_SKIP_LAYER);
      renderOverride(...args);
      camera.layers.enable(AO_SKIP_LAYER);
    };
    composer.addPass(gtao);
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.1, 0.35, 0.98));
    composer.addPass(new OutputPass());
  }
  let envBucket = -1;
  function refreshEnv() {
    const bucket = Math.round(tod * 25);
    if (bucket === envBucket) return;
    envBucket = bucket;
    const rt = pmrem.fromScene(envScene, 0.015, 0.1, 4000);
    envRT?.dispose();
    envRT = rt;
    scene.environment = rt.texture;
  }

  // ---- state written by the page ----
  const input = { segment: "hero", p: 0 };
  let visible = true, snap = true;
  const pose = { ...SEGMENTS.hero.cams[0][1], vy: 0 };
  let appliedVy = -1;
  let truckX = Z.hero, tod = 0.04;
  let time = 0, frameEma = 16, lastDprCheck = 0;
  const tmp = new THREE.Vector3(), look = new THREE.Vector3();

  function resize() {
    const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    if (composer) { composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(w, h); }
    camera.aspect = w / h;
    appliedVy = -1;                     // re-apply the view offset for the new size on the next frame
    camera.updateProjectionMatrix();
  }
  resize();

  function target() {
    const seg = SEGMENTS[input.segment] || SEGMENTS.hero;
    const p = reducedMotion ? 0.3 : input.p;
    const cam = { ...interpKeys(seg.cams, p) };
    // portrait screens: pull back so the whole truck fits, centre it, and lift it above the copy
    const aspect = camera.aspect;
    if (aspect < 1) {
      // widen the lens moderately and back off a little (backing off alone would put the camera inside the plantation)
      cam.fov = Math.min(54, cam.fov * 1.55);
      cam.dist *= 1.3; cam.h *= 1.12; cam.shift = 0;
      cam.vy = PORTRAIT_LIFT[input.segment] ?? 0;
    } else if (mobile) { cam.dist *= 1.15; cam.vy = 0; }
    else cam.vy = 0;
    const [cargo, fill, loading] = seg.cargo(p);
    return { cam, x: truckXFor(seg, p), tod: interpKeys(seg.tod, p), tread: reducedMotion ? 0 : seg.tread, cargo, fill, loading };
  }

  function step(dt) {
    time += dt;
    const t = target();
    const k = snap ? 1 : 0;
    const lam = reducedMotion ? 1000 : 3.2;

    // truck: eased along the road; wheels roll by exactly the distance covered (+ treadmill)
    const newX = k ? t.x : damp(truckX, t.x, 4, dt);
    const treadDist = t.tread * dt;
    const dx = newX - truckX;
    truckX = newX;
    truck.group.position.x = truckX;
    world.tread(treadDist);
    truck.roll(dx + treadDist);
    const groundSpeed = Math.abs(dx) / Math.max(dt, 1e-3) + t.tread;
    truck.bob(time, groundSpeed);
    if (!reducedMotion) world.dust(truck.group.position, groundSpeed, -t.tread, dt);
    truck.setCargo(t.cargo, t.fill);

    // camera
    for (const key of Object.keys(pose)) {
      if (key === "az") {
        let d = ((t.cam.az - pose.az + 540) % 360) - 180;
        pose.az = k ? t.cam.az : pose.az + d * (1 - Math.exp(-lam * dt));
      } else pose[key] = k ? t.cam[key] : damp(pose[key], t.cam[key], lam, dt);
    }
    const sway = reducedMotion ? 0 : Math.sin(time * 0.23) * 1.6;
    const a = THREE.MathUtils.degToRad(pose.az + sway);
    tmp.set(truckX + Math.cos(a) * pose.dist, pose.h, LANE_Z + Math.sin(a) * pose.dist);
    camera.position.copy(tmp);
    look.set(truckX + pose.lookX, pose.lookY, LANE_Z);
    camera.lookAt(look);
    if (Math.abs(camera.fov - pose.fov) > 0.01 || camera.filmOffset !== pose.shift || Math.abs(appliedVy - pose.vy) > 0.001) {
      camera.fov = pose.fov; camera.filmOffset = pose.shift;
      const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight;
      if (pose.vy > 0.001) camera.setViewOffset(w, h, 0, pose.vy * h, w, h); else camera.clearViewOffset();
      appliedVy = pose.vy;
      camera.updateProjectionMatrix();
    }

    // light & atmosphere
    const newTod = k ? t.tod : damp(tod, t.tod, 2.5, dt);
    if (Math.abs(newTod - tod) > 1e-4 || snap) { tod = newTod; world.setTimeOfDay(tod); renderer.toneMappingExposure = world.tod.exp; refreshEnv(); }
    world.update(time, t.loading);
    world.follow(look, camera, truck.group.position);
    snap = false;
  }

  function adapt(frameMs, now) {
    frameEma = frameEma * 0.92 + frameMs * 0.08;
    if (now - lastDprCheck < 1200) return;
    lastDprCheck = now;
    const max = Math.min(window.devicePixelRatio || 1, quality.dprMax);
    let next = dpr;
    if (frameEma > 22 && gtao?.enabled) { gtao.enabled = false; return; }        // first drop the most expensive effect
    if (frameEma > 21 && dpr > 0.7) next = Math.max(0.7, dpr - 0.15);
    else if (frameEma < 14 && dpr < max) next = Math.min(max, dpr + 0.1);
    if (next !== dpr) { dpr = next; renderer.setPixelRatio(dpr); resize(); }
  }

  let lastNow = 0, renderedOnce = false, dirty = true;   // reduced motion: draw only when something changed
  return {
    /** call from the page's animation loop (GSAP ticker) */
    tick(now) {
      if (!visible && renderedOnce) { lastNow = now; return; }
      if (reducedMotion && !dirty && renderedOnce) { lastNow = now; return; }
      dirty = false;
      const dt = lastNow ? Math.min(0.05, (now - lastNow) / 1000) : 1 / 60;
      const interval = lastNow ? now - lastNow : 16.7;   // real frame-to-frame time (includes GPU back-pressure)
      step(dt);
      if (composer) composer.render(dt); else renderer.render(scene, camera);
      renderedOnce = true;
      lastNow = now;
      if (!reducedMotion && interval < 200) adapt(interval, now);
    },
    set(segment, p) {
      if (input.segment !== segment && !visible) snap = true;
      if (reducedMotion && input.segment !== segment) { snap = true; dirty = true; }
      input.segment = segment; input.p = Math.min(1, Math.max(0, p));
    },
    setVisible(v) {
      if (v && !visible) { snap = true; dirty = true; }   // coming back from an opaque section: jump straight to the right pose
      visible = v;
    },
    resize() { resize(); dirty = true; },
    info: () => ({ dpr, calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, frameEma }),
    dispose() {
      disposeObject(scene);
      envRT?.dispose(); pmrem.dispose();
      composer?.renderTarget1.dispose(); composer?.renderTarget2.dispose();
      composer?.passes.forEach(p => p.dispose?.());
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
