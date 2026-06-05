#!/usr/bin/env node
/**
 * render_weapon_silhouettes.mjs
 *
 * Headless verification helper for T7. The agent CI environment has no WebGL /
 * browser, so an in-engine FPV screenshot cannot be captured. Instead this
 * script reads each downloaded weapon .glb, decodes its triangle geometry, and
 * software-renders an orthographic side-view silhouette to a PNG. The result is
 * genuine proof that each asset is a recognisable gun, not a colored box.
 *
 * Usage: node scripts/render_weapon_silhouettes.mjs
 * Output: tasks/realism-v2/screenshots/t7-<weapon>.png
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const WEAPON_DIR = path.join(ROOT, 'public/assets/weapons');
const OUT_DIR = path.join(ROOT, 'tasks/realism-v2/screenshots');

const WEAPONS = [
  { file: 'pistol.glb', out: 't7-pistol.png' },
  { file: 'rifle.glb', out: 't7-rifle.png' },
  { file: 'shotgun.glb', out: 't7-shotgun.png' },
  { file: 'sniper.glb', out: 't7-sniper.png' },
];

// ── 4×4 matrix helpers (column-major, glTF convention) ────────────────────────
const matIdentity = () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

function matMul(a, b) {
  const o = new Array(16).fill(0);
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++)
      for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return o;
}

function trs(t = [0, 0, 0], q = [0, 0, 0, 1], s = [1, 1, 1]) {
  const [x, y, z, w] = q;
  const x2 = x + x, y2 = y + y, z2 = z + z;
  const xx = x * x2, xy = x * y2, xz = x * z2;
  const yy = y * y2, yz = y * z2, zz = z * z2;
  const wx = w * x2, wy = w * y2, wz = w * z2;
  const [sx, sy, sz] = s;
  return [
    (1 - (yy + zz)) * sx, (xy + wz) * sx, (xz - wy) * sx, 0,
    (xy - wz) * sy, (1 - (xx + zz)) * sy, (yz + wx) * sy, 0,
    (xz + wy) * sz, (yz - wx) * sz, (1 - (xx + yy)) * sz, 0,
    t[0], t[1], t[2], 1,
  ];
}

function applyMat(m, p) {
  const [x, y, z] = p;
  return [
    m[0] * x + m[4] * y + m[8] * z + m[12],
    m[1] * x + m[5] * y + m[9] * z + m[13],
    m[2] * x + m[6] * y + m[10] * z + m[14],
  ];
}

// ── GLB decode ────────────────────────────────────────────────────────────────
function parseGLB(buf) {
  const jsonLen = buf.readUInt32LE(12);
  const json = JSON.parse(buf.toString('utf8', 20, 20 + jsonLen));
  const binStart = 20 + jsonLen + 8; // skip BIN chunk header
  return { json, bin: buf.subarray(binStart) };
}

const COMP_SIZE = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
const TYPE_COUNT = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };

function readAccessor(json, bin, idx) {
  const acc = json.accessors[idx];
  const view = json.bufferViews[acc.bufferView];
  const compSize = COMP_SIZE[acc.componentType];
  const numComp = TYPE_COUNT[acc.type];
  const base = (view.byteOffset || 0) + (acc.byteOffset || 0);
  const stride = view.byteStride || compSize * numComp;
  const out = [];
  for (let i = 0; i < acc.count; i++) {
    const row = [];
    for (let c = 0; c < numComp; c++) {
      const off = base + i * stride + c * compSize;
      switch (acc.componentType) {
        case 5126: row.push(bin.readFloatLE(off)); break;
        case 5125: row.push(bin.readUInt32LE(off)); break;
        case 5123: row.push(bin.readUInt16LE(off)); break;
        case 5121: row.push(bin.readUInt8(off)); break;
        default: row.push(0);
      }
    }
    out.push(numComp === 1 ? row[0] : row);
  }
  return out;
}

/** Collect world-space triangles [{a,b,c}] from a glb. */
function collectTriangles(json, bin) {
  const tris = [];
  const nodes = json.nodes || [];
  const sceneNodes = (json.scenes?.[json.scene || 0]?.nodes) || nodes.map((_, i) => i);

  const walk = (nodeIdx, parent) => {
    const node = nodes[nodeIdx];
    const local = node.matrix
      ? node.matrix
      : trs(node.translation, node.rotation, node.scale);
    const world = matMul(parent, local);
    if (node.mesh != null) {
      for (const prim of json.meshes[node.mesh].primitives) {
        const pos = readAccessor(json, bin, prim.attributes.POSITION).map((p) => applyMat(world, p));
        const idx = prim.indices != null
          ? readAccessor(json, bin, prim.indices)
          : pos.map((_, i) => i);
        for (let i = 0; i < idx.length; i += 3) {
          tris.push({ a: pos[idx[i]], b: pos[idx[i + 1]], c: pos[idx[i + 2]] });
        }
      }
    }
    for (const child of node.children || []) walk(child, world);
  };
  for (const n of sceneNodes) walk(n, matIdentity());
  return tris;
}

// ── Software rasteriser (orthographic side view: X→horizontal, Y→vertical) ─────
function render(tris, W, H, margin) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const t of tris) for (const v of [t.a, t.b, t.c]) {
    minX = Math.min(minX, v[0]); maxX = Math.max(maxX, v[0]);
    minY = Math.min(minY, v[1]); maxY = Math.max(maxY, v[1]);
    minZ = Math.min(minZ, v[2]); maxZ = Math.max(maxZ, v[2]);
  }
  const spanX = maxX - minX || 1, spanY = maxY - minY || 1;
  const scale = Math.min((W - 2 * margin) / spanX, (H - 2 * margin) / spanY);
  const ox = (W - spanX * scale) / 2, oy = (H - spanY * scale) / 2;
  const proj = (v) => [ox + (v[0] - minX) * scale, H - (oy + (v[1] - minY) * scale)];

  const px = new Uint8Array(W * H).fill(245); // light background
  const depth = new Float32Array(W * H).fill(Infinity);

  // Painter's order via per-pixel depth (z). Front (larger z) wins → lighter.
  for (const t of tris) {
    const p0 = proj(t.a), p1 = proj(t.b), p2 = proj(t.c);
    const zc = (t.a[2] + t.b[2] + t.c[2]) / 3;
    const shade = Math.round(90 + ((zc - minZ) / (maxZ - minZ || 1)) * 120); // 90..210
    fillTri(px, depth, W, H, p0, p1, p2, zc, shade);
  }
  return px;
}

function fillTri(px, depth, W, H, p0, p1, p2, z, shade) {
  const minx = Math.max(0, Math.floor(Math.min(p0[0], p1[0], p2[0])));
  const maxx = Math.min(W - 1, Math.ceil(Math.max(p0[0], p1[0], p2[0])));
  const miny = Math.max(0, Math.floor(Math.min(p0[1], p1[1], p2[1])));
  const maxy = Math.min(H - 1, Math.ceil(Math.max(p0[1], p1[1], p2[1])));
  const area = edge(p0, p1, p2);
  if (Math.abs(area) < 1e-9) return;
  for (let y = miny; y <= maxy; y++) {
    for (let x = minx; x <= maxx; x++) {
      const p = [x + 0.5, y + 0.5];
      let w0 = edge(p1, p2, p), w1 = edge(p2, p0, p), w2 = edge(p0, p1, p);
      if ((w0 >= 0 && w1 >= 0 && w2 >= 0) || (w0 <= 0 && w1 <= 0 && w2 <= 0)) {
        const i = y * W + x;
        if (z < depth[i]) { depth[i] = z; px[i] = shade; }
      }
    }
  }
}

const edge = (a, b, c) => (c[0] - a[0]) * (b[1] - a[1]) - (c[1] - a[1]) * (b[0] - a[0]);

// ── Minimal grayscale PNG encoder ─────────────────────────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function encodePNG(px, W, H) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; ihdr[9] = 0; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0; // 8-bit grayscale
  const raw = Buffer.alloc((W + 1) * H);
  for (let y = 0; y < H; y++) {
    raw[y * (W + 1)] = 0; // filter: none
    for (let x = 0; x < W; x++) raw[y * (W + 1) + 1 + x] = px[y * W + x];
  }
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

// ── Main ──────────────────────────────────────────────────────────────────────
mkdirSync(OUT_DIR, { recursive: true });
const W = 640, H = 320, MARGIN = 36;
for (const w of WEAPONS) {
  const { json, bin } = parseGLB(readFileSync(path.join(WEAPON_DIR, w.file)));
  const tris = collectTriangles(json, bin);
  const px = render(tris, W, H, MARGIN);
  writeFileSync(path.join(OUT_DIR, w.out), encodePNG(px, W, H));
  console.log(`  ${w.out}  (${tris.length} triangles)`);
}
console.log(`\nSilhouettes written to ${path.relative(ROOT, OUT_DIR)}/`);
