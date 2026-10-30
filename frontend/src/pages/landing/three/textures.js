import * as THREE from "three";
import { rng } from "./kit.js";

/*
 * Procedural PBR textures (albedo + roughness + normal) drawn at start-up — no image downloads.
 * Each generator paints a height field alongside the colour, and the normal map is derived from it,
 * so cracks, gravel and tyre tracks catch the light the way real surfaces do.
 */

function makeCanvas(w, h) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  return [c, c.getContext("2d", { willReadFrequently: true })];
}

/** value-noise field (tileable) for organic variation */
function valueNoise(w, h, cell, rand) {
  const gw = Math.ceil(w / cell), gh = Math.ceil(h / cell);
  const g = new Float32Array(gw * gh).map(() => rand());
  const at = (x, y) => g[((y % gh + gh) % gh) * gw + ((x % gw + gw) % gw)];
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const fx = x / cell, fy = y / cell, x0 = Math.floor(fx), y0 = Math.floor(fy);
    let tx = fx - x0, ty = fy - y0; tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
    const a = at(x0, y0), b = at(x0 + 1, y0), c = at(x0, y0 + 1), d = at(x0 + 1, y0 + 1);
    out[y * w + x] = (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty;
  }
  return out;
}
function fbm(w, h, rand, cells = [64, 24, 8, 3], weights = [0.45, 0.3, 0.17, 0.08]) {
  const out = new Float32Array(w * h);
  cells.forEach((c, i) => { const n = valueNoise(w, h, c, rand); for (let k = 0; k < out.length; k++) out[k] += n[k] * weights[i]; });
  return out;
}

function heightToNormal(height, w, h, strength) {
  const [c, ctx] = makeCanvas(w, h);
  const img = ctx.createImageData(w, h);
  const H = (x, y) => height[((y + h) % h) * w + ((x + w) % w)];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = (H(x + 1, y) - H(x - 1, y)) * strength, dy = (H(x, y + 1) - H(x, y - 1)) * strength;
    const nx = -dx, ny = -dy, nz = 1, l = Math.hypot(nx, ny, nz);
    const i = (y * w + x) * 4;
    img.data[i] = (nx / l * 0.5 + 0.5) * 255; img.data[i + 1] = (ny / l * 0.5 + 0.5) * 255; img.data[i + 2] = (nz / l * 0.5 + 0.5) * 255; img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

function toTexture(canvas, { srgb, repeat = [1, 1], anisotropy = 8 }) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = anisotropy;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  return t;
}

/** draws a field: colour(x,y,n) → [r,g,b], rough(x,y,n) → 0..1, height(x,y,n) → 0..1 */
function surface(w, h, rand, { colour, rough, height, noise }) {
  const [cc, cx] = makeCanvas(w, h), [rc, rx] = makeCanvas(w, h);
  const ci = cx.createImageData(w, h), ri = rx.createImageData(w, h);
  const hf = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const k = y * w + x, n = noise[k], i = k * 4;
    const [r, g, b] = colour(x, y, n); ci.data[i] = r; ci.data[i + 1] = g; ci.data[i + 2] = b; ci.data[i + 3] = 255;
    const ro = rough(x, y, n) * 255; ri.data[i] = ro; ri.data[i + 1] = ro; ri.data[i + 2] = ro; ri.data[i + 3] = 255;
    hf[k] = height(x, y, n);
  }
  cx.putImageData(ci, 0, 0); rx.putImageData(ri, 0, 0);
  return { colourCanvas: cc, roughCanvas: rc, height: hf, cctx: cx, rctx: rx };
}

// ------------------------------------------------------------------------------------------
/** Asphalt road tile: 16 m along the road (u) × full road width (v). */
export function asphalt(lengthRepeat, quality) {
  const rand = rng(11);
  const W = quality.texSize, H = W / 4;          // 16 m × 4 m per pixel-row ratio (road is 8.5 m wide, stretched)
  const n = fbm(W, H, rand, [96, 32, 6, 2], [0.35, 0.3, 0.2, 0.15]);
  const grain = new Float32Array(W * H).map(() => rand());
  const vOf = y => y / H;                          // 0 = one edge, 1 = other edge
  const track = v => Math.max(...[0.62, 0.79, 0.21, 0.38].map(c => Math.exp(-((v - c) ** 2) / 0.0018)));   // wheel paths
  const edge = v => Math.min(v, 1 - v);
  const s = surface(W, H, rand, {
    noise: n,
    colour: (x, y, nn) => {
      const v = vOf(y), g = grain[y * W + x];
      let base = 58 + (nn - 0.5) * 26 + (g > 0.93 ? 34 : g < 0.05 ? -14 : 0);   // aggregate stones
      base -= track(v) * 10;                                                    // polished, darker tyre tracks
      const e = edge(v), crumble = e < 0.035 + nn * 0.03;
      if (crumble) return [118 + nn * 30, 86 + nn * 20, 60 + nn * 14];            // laterite soil at the edge
      return [base, base + 1, base + 3];
    },
    rough: (x, y, nn) => 0.92 - track(vOf(y)) * 0.28 + (nn - 0.5) * 0.08,
    height: (x, y, nn) => nn * 0.6 + (grain[y * W + x] > 0.9 ? 0.25 : 0) - track(vOf(y)) * 0.1,
  });
  // repairs, cracks, oil, worn paint — painted over colour/roughness/height
  const { cctx, rctx, height } = s;
  const paintRect = (x, y, w, h, col, rough, dh) => {
    cctx.fillStyle = col; cctx.fillRect(x, y, w, h); rctx.fillStyle = `rgb(${rough * 255},${rough * 255},${rough * 255})`; rctx.fillRect(x, y, w, h);
    for (let yy = Math.max(0, y | 0); yy < Math.min(H, y + h); yy++) for (let xx = Math.max(0, x | 0); xx < Math.min(W, x + w); xx++) height[yy * W + xx] += dh;
  };
  for (let i = 0; i < 3; i++) paintRect(rand() * W * 0.8, H * (0.15 + rand() * 0.5), W * (0.06 + rand() * 0.1), H * (0.12 + rand() * 0.2), "rgba(30,31,33,.55)", 0.8, 0.05);  // patch repairs
  // worn white edge lines and dashed centre line
  const worn = (x, y, w, h) => { for (let k = 0; k < w * h / 9; k++) { const px = x + rand() * w, py = y + rand() * h; if (rand() > 0.18) paintRect(px, py, 3, 3, "rgba(222,222,212,.9)", 0.62, 0.04); } };
  worn(0, H * 0.075, W, H * 0.022); worn(0, H * 0.903, W, H * 0.022);
  for (let x = 0; x < W; x += W / 2) worn(x + W * 0.04, H * 0.49, W * 0.19, H * 0.022);
  // cracks
  cctx.lineWidth = Math.max(1, W / 1024); cctx.strokeStyle = "rgba(14,14,15,.75)";
  for (let i = 0; i < 18; i++) {
    let x = rand() * W, y = rand() * H; cctx.beginPath(); cctx.moveTo(x, y);
    for (let k = 0; k < 12; k++) {
      x += (rand() - 0.5) * W * 0.03; y += (rand() - 0.5) * H * 0.08; cctx.lineTo(x, y);
      const ix = ((x | 0) + W) % W, iy = Math.min(H - 1, Math.max(0, y | 0));
      height[iy * W + ix] -= 0.5;
    }
    cctx.stroke();
  }
  // oil drips along the lane centre
  for (let i = 0; i < 30; i++) { cctx.fillStyle = `rgba(10,10,12,${0.08 + rand() * 0.12})`; cctx.beginPath(); cctx.ellipse(rand() * W, H * (0.7 + (rand() - 0.5) * 0.06), 4 + rand() * 10, 2 + rand() * 4, 0, 0, 6.28); cctx.fill(); }

  const rep = [lengthRepeat, 1];
  return {
    map: toTexture(s.colourCanvas, { srgb: true, repeat: rep }),
    roughnessMap: toTexture(s.roughCanvas, { srgb: false, repeat: rep }),
    normalMap: toTexture(heightToNormal(height, W, H, 3.2), { srgb: false, repeat: rep }),
  };
}

/** Laterite soil / gravel verge (North Sumatra red-brown earth). */
export function soil(repeat, quality) {
  const rand = rng(23);
  const W = quality.texSize / 2, H = W;
  const n = fbm(W, W, rand, [48, 16, 5, 2], [0.4, 0.3, 0.2, 0.1]);
  const pebbles = new Float32Array(W * H).map(() => rand());
  const s = surface(W, H, rand, {
    noise: n,
    colour: (x, y, nn) => { const p = pebbles[y * W + x]; const v = (nn - 0.5) * 40 + (p > 0.95 ? 30 : 0); return [128 + v, 92 + v * 0.8, 64 + v * 0.6]; },
    rough: () => 0.97,
    height: (x, y, nn) => nn + (pebbles[y * W + x] > 0.95 ? 0.4 : 0),
  });
  return {
    map: toTexture(s.colourCanvas, { srgb: true, repeat }),
    roughnessMap: toTexture(s.roughCanvas, { srgb: false, repeat }),
    normalMap: toTexture(heightToNormal(s.height, W, H, 4), { srgb: false, repeat }),
  };
}

/** Plantation floor: short grass, frond litter, bare patches. */
export function plantationFloor(repeat, quality) {
  const rand = rng(31);
  const W = quality.texSize / 2, H = W;
  const n = fbm(W, W, rand, [64, 20, 6, 2], [0.4, 0.3, 0.2, 0.1]);
  const blades = new Float32Array(W * H).map(() => rand());
  const s = surface(W, H, rand, {
    noise: n,
    colour: (x, y, nn) => {
      const b = blades[y * W + x];
      if (nn < 0.33) { const v = (nn - 0.3) * 60; return [96 + v, 78 + v, 52 + v]; }            // bare soil & litter
      const g = 70 + (b - 0.5) * 40 + (nn - 0.5) * 30;
      return [g * 0.62, g, g * 0.38];
    },
    rough: (x, y, nn) => (nn < 0.33 ? 0.96 : 0.88),
    height: (x, y, nn) => nn * 0.5 + blades[y * W + x] * 0.5,
  });
  return {
    map: toTexture(s.colourCanvas, { srgb: true, repeat }),
    roughnessMap: toTexture(s.roughCanvas, { srgb: false, repeat }),
    normalMap: toTexture(heightToNormal(s.height, W, H, 2.5), { srgb: false, repeat }),
  };
}

/** Oil-palm bark: overlapping frond-base scales. */
export function bark(quality) {
  const rand = rng(41);
  const W = quality.texSize / 4, H = W * 2;
  const n = fbm(W, H, rand, [32, 10, 3], [0.5, 0.3, 0.2]);
  const s = surface(W, H, rand, {
    noise: n,
    colour: (x, y, nn) => {
      const sx = x / (W / 6), sy = y / (H / 14) + (Math.floor(sx) % 2) * 0.5;
      const fy = sy - Math.floor(sy), fx = sx - Math.floor(sx);
      const scale = Math.max(0, 1 - Math.abs(fx - 0.5) * 2 - fy * 0.6);
      const v = 50 + scale * 40 + (nn - 0.5) * 30;
      return [v * 1.1, v * 0.92, v * 0.7];
    },
    rough: () => 0.95,
    height: (x, y, nn) => {
      const sx = x / (W / 6), sy = y / (H / 14) + (Math.floor(sx) % 2) * 0.5;
      const fy = sy - Math.floor(sy), fx = sx - Math.floor(sx);
      return Math.max(0, 1 - Math.abs(fx - 0.5) * 2 - fy * 0.6) + nn * 0.3;
    },
  });
  return {
    map: toTexture(s.colourCanvas, { srgb: true, repeat: [1, 1] }),
    normalMap: toTexture(heightToNormal(s.height, W, H, 5), { srgb: false, repeat: [1, 1] }),
  };
}

/** Grass clump billboard (alpha). */
export function grassCard() {
  const rand = rng(53);
  const [c, ctx] = makeCanvas(256, 256);
  for (let i = 0; i < 260; i++) {
    const x = 10 + rand() * 236, hgt = 70 + rand() * 170, lean = (rand() - 0.5) * 60;
    const g = 60 + rand() * 50, dry = rand() < 0.18;
    const grad = ctx.createLinearGradient(0, 256, 0, 256 - hgt);
    const tip = dry ? `rgb(${Math.round(g * 1.25)},${Math.round(g * 1.1)},${Math.round(g * 0.55)})` : `rgb(${Math.round(g * 0.62)},${Math.round(g)},${Math.round(g * 0.38)})`;
    grad.addColorStop(0, "rgb(28,34,18)"); grad.addColorStop(1, tip);
    ctx.strokeStyle = grad; ctx.lineWidth = 1 + rand() * 1.4;
    ctx.beginPath(); ctx.moveTo(x, 256); ctx.quadraticCurveTo(x + lean * 0.3, 256 - hgt * 0.6, x + lean, 256 - hgt); ctx.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Fine honeycomb for the grille (normal map). */
export function grilleNormal() {
  const W = 128, H = 64; const h = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const ox = (Math.floor(y / 8) % 2) * 4;
    const fx = ((x + ox) % 8) / 8, fy = (y % 8) / 8;
    h[y * W + x] = (fx > 0.15 && fx < 0.85 && fy > 0.15 && fy < 0.85) ? 0 : 1;
  }
  const t = toTexture(heightToNormal(h, W, H, 6), { srgb: false, repeat: [8, 3] });
  return t;
}
