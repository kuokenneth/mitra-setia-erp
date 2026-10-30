import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/** Merge geometries of mixed origin (indexed or not; only position/normal/uv kept). */
export function mergeParts(geos) {
  const prepared = geos.map(g => {
    const n = g.index ? g.toNonIndexed() : g.clone();
    for (const key of Object.keys(n.attributes)) if (!["position", "normal", "uv"].includes(key)) n.deleteAttribute(key);
    if (!n.attributes.uv) n.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(n.attributes.position.count * 2), 2));
    return n;
  });
  const merged = mergeGeometries(prepared, false);
  prepared.forEach(g => g.dispose());
  return merged;
}

/**
 * Collects static parts per material and merges them into one mesh per
 * material — a whole truck or building costs a handful of draw calls.
 */
export class Collector {
  constructor() { this.parts = new Map(); }
  add(geometry, material, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1 } = {}) {
    const g = geometry.clone();
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
      new THREE.Vector3(sx, sy, sz)
    );
    g.applyMatrix4(m);
    if (!this.parts.has(material)) this.parts.set(material, []);
    this.parts.get(material).push(g);
    return this;
  }
  box(w, h, d, material, t) { return this.add(new THREE.BoxGeometry(w, h, d), material, t); }
  build({ castShadow = true, receiveShadow = true } = {}) {
    const group = new THREE.Group();
    for (const [material, geos] of this.parts) {
      const merged = mergeParts(geos);
      geos.forEach(g => g.dispose());
      const mesh = new THREE.Mesh(merged, material);
      mesh.castShadow = castShadow;
      mesh.receiveShadow = receiveShadow;
      group.add(mesh);
    }
    this.parts.clear();
    return group;
  }
}

/** Small seeded PRNG so the world looks identical on every load. */
export function rng(seed = 1) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

/** Canvas-drawn texture helper (no image downloads needed). */
export function canvasTexture(w, h, draw, { repeat = [1, 1], srgb = true, anisotropy = 4 } = {}) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = anisotropy;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function noiseFill(ctx, w, h, base, spread, rand, cell = 2) {
  ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += cell) for (let x = 0; x < w; x += cell) {
    const v = (rand() - 0.5) * spread;
    ctx.fillStyle = v > 0 ? `rgba(255,255,255,${v})` : `rgba(0,0,0,${-v})`;
    ctx.fillRect(x, y, cell, cell);
  }
}

/**
 * Weathering: road mud builds up towards the bottom (world height), with splatter, and a fine dust film
 * settles on upward-facing surfaces. Pattern noise uses object-space coordinates so it sticks to the
 * part (and turns with the wheels) instead of sliding as the truck drives.
 */
export function applyGrime(material, { mud = 1, dust = 1, mudColor = 0x5b4632, dustColor = 0xb9a688 } = {}) {
  const prev = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    prev?.(shader, renderer);
    shader.uniforms.uMudColor = { value: new THREE.Color(mudColor) };
    shader.uniforms.uDustColor = { value: new THREE.Color(dustColor) };
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vGrimeObj; varying float vGrimeY; varying vec3 vGrimeN;")
      .replace("#include <worldpos_vertex>", `#include <worldpos_vertex>
        vGrimeObj = position;
        vec4 grimeWorld = modelMatrix * vec4( transformed, 1.0 );
        #ifdef USE_INSTANCING
          grimeWorld = modelMatrix * instanceMatrix * vec4( transformed, 1.0 );
        #endif
        vGrimeY = grimeWorld.y;
        vGrimeN = normalize( mat3( modelMatrix ) * objectNormal );`);
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>
        varying vec3 vGrimeObj; varying float vGrimeY; varying vec3 vGrimeN;
        uniform vec3 uMudColor; uniform vec3 uDustColor;
        float gHash( vec3 p ) { p = fract( p * 0.3183099 + 0.1 ); p *= 17.0; return fract( p.x * p.y * p.z * ( p.x + p.y + p.z ) ); }
        float gNoise( vec3 x ) {
          vec3 i = floor( x ); vec3 f = fract( x ); f = f * f * ( 3.0 - 2.0 * f );
          return mix( mix( mix( gHash( i ), gHash( i + vec3( 1, 0, 0 ) ), f.x ), mix( gHash( i + vec3( 0, 1, 0 ) ), gHash( i + vec3( 1, 1, 0 ) ), f.x ), f.y ),
                      mix( mix( gHash( i + vec3( 0, 0, 1 ) ), gHash( i + vec3( 1, 0, 1 ) ), f.x ), mix( gHash( i + vec3( 0, 1, 1 ) ), gHash( i + vec3( 1, 1, 1 ) ), f.x ), f.y ), f.z );
        }`)
      .replace("#include <color_fragment>", `#include <color_fragment>
        float gN1 = gNoise( vGrimeObj * 3.1 );
        float gN2 = gNoise( vGrimeObj * 11.0 + 7.0 );
        float mudMask = smoothstep( 1.35, 0.25, vGrimeY ) * ( 0.45 + 0.55 * gN1 );
        float splash = step( 0.8, gN2 ) * smoothstep( 1.9, 0.5, vGrimeY ) * 0.7;
        float grimeAmt = clamp( ( mudMask * 0.8 + splash ) * ${mud.toFixed(2)}, 0.0, 0.85 );
        float dustAmt = smoothstep( 0.55, 0.95, vGrimeN.y ) * ( 0.25 + 0.35 * gN1 ) * ${dust.toFixed(2)};
        diffuseColor.rgb = mix( diffuseColor.rgb, uMudColor, grimeAmt );
        diffuseColor.rgb = mix( diffuseColor.rgb, uDustColor, dustAmt );`)
      .replace("#include <roughnessmap_fragment>", `#include <roughnessmap_fragment>
        roughnessFactor = mix( roughnessFactor, 0.96, max( grimeAmt, dustAmt ) );`);
  };
  material.customProgramCacheKey = () => `grime-${mud}-${dust}-${material.type}`;
  return material;
}

/** Shared materials (created once per engine, disposed with it). */
export function createMaterials() {
  const std = (color, roughness = 0.6, metalness = 0, extra = {}) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
  const m = {
    // the fleet's real body colour (lime green), with a clear-coat for a factory-paint look
    paint: new THREE.MeshPhysicalMaterial({ color: 0x9bbd3c, roughness: 0.42, metalness: 0.1, clearcoat: 0.6, clearcoatRoughness: 0.25 }),
    paintDark: std(0x6f8a2a, 0.55, 0.1),
    steel: std(0x9aa2a8, 0.45, 0.65),
    chrome: std(0xd9dde0, 0.18, 1),
    darkSteel: std(0x2a2f34, 0.55, 0.4),
    plastic: std(0x1b1f23, 0.6, 0),
    rubber: std(0x121314, 0.92, 0),
    rim: std(0xc9ccd0, 0.35, 0.7),
    glass: new THREE.MeshPhysicalMaterial({ color: 0x0b1118, roughness: 0.06, metalness: 0.2, envMapIntensity: 1.4 }),
    headlight: new THREE.MeshStandardMaterial({ color: 0xbfc2c4, emissive: 0xfff3dc, emissiveIntensity: 0.6, roughness: 0.2 }),
    tail: new THREE.MeshStandardMaterial({ color: 0x5a0d0d, emissive: 0xff2a1a, emissiveIntensity: 0.4, roughness: 0.4 }),
    amber: new THREE.MeshStandardMaterial({ color: 0x7a4300, emissive: 0xff9a1a, emissiveIntensity: 0.9, roughness: 0.4 }),
    sack: std(0xe8e5dc, 0.95, 0),
    concrete: std(0x7c7c76, 0.95, 0),
    metalRoof: std(0x7d868d, 0.5, 0.55),
    wallGrey: std(0xb3b6b2, 0.85, 0.1),
    darkInterior: std(0x16191c, 1, 0),
    grille: std(0x15181b, 0.5, 0.3),
  };
  // working-truck weathering on everything that meets the road
  applyGrime(m.paint, { mud: 1, dust: 1 });
  applyGrime(m.paintDark, { mud: 1, dust: 0.8 });
  applyGrime(m.darkSteel, { mud: 1.2, dust: 0.6 });
  applyGrime(m.plastic, { mud: 1, dust: 0.6 });
  applyGrime(m.steel, { mud: 0.8, dust: 0.6 });
  applyGrime(m.rim, { mud: 0.9, dust: 0.4 });
  applyGrime(m.rubber, { mud: 0.7, dust: 0.5, mudColor: 0x3d3126 });
  return m;
}

export function disposeObject(root) {
  const seen = new Set();
  root.traverse(o => {
    if (o.geometry && !seen.has(o.geometry)) { seen.add(o.geometry); o.geometry.dispose(); }
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    mats.forEach(m => {
      if (seen.has(m)) return; seen.add(m);
      Object.values(m).forEach(v => { if (v && v.isTexture && !seen.has(v)) { seen.add(v); v.dispose(); } });
      m.dispose();
    });
  });
}

export const smoothstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (current, target, lambda, dt) => lerp(current, target, 1 - Math.exp(-lambda * dt));
