#!/usr/bin/env node
/**
 * fetch_assets.mjs
 *
 * Downloads a small set of CC0-licensed sample assets from Poly Haven into
 * public/assets/. Run once at setup or in CI before a full build.
 *
 * Usage:
 *   node scripts/fetch_assets.mjs
 *
 * Assets fetched:
 *   1. HDR environment map  — Kiara 9 Dusk (1k)    [polyhaven.com/kiara_9_dusk]
 *   2. PBR concrete texture — Concrete Floor 02     [polyhaven.com/concrete_floor_02]
 *   3. PBR metal texture    — Metal Plate           [polyhaven.com/metal_plate]
 *   4. Weapon glTF models   — pistol / rifle / shotgun / sniper (T7)
 *        Quaternius "Ultimate Guns Pack", CC0, mirrored on poly.pizza.
 *
 * LICENSE: All assets are CC0 1.0 Universal — see CREDITS.md for details.
 */

import { createWriteStream, mkdirSync, existsSync } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, '../public/assets');

mkdirSync(OUT_DIR, { recursive: true });

// ── Asset list ───────────────────────────────────────────────────────────────
const ASSETS = [
  {
    name: 'kiara_9_dusk_1k.hdr',
    // Poly Haven CDN — direct 1k HDR for Kiara 9 Dusk
    url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/kiara_9_dusk_1k.hdr',
    description: 'HDR environment map — Kiara 9 Dusk 1k',
    credit: 'Kiara 9 Dusk by Poly Haven, CC0 1.0 — polyhaven.com/kiara_9_dusk',
  },
  {
    name: 'concrete_floor_02_diff_1k.jpg',
    url: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/concrete_floor_02/concrete_floor_02_diff_1k.jpg',
    description: 'PBR concrete diffuse texture — Concrete Floor 02 1k',
    credit: 'Concrete Floor 02 by Poly Haven, CC0 1.0 — polyhaven.com/concrete_floor_02',
  },
  {
    name: 'metal_plate_diff_1k.jpg',
    url: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/metal_plate/metal_plate_diff_1k.jpg',
    description: 'PBR metal diffuse texture — Metal Plate 1k',
    credit: 'Metal Plate by Poly Haven, CC0 1.0 — polyhaven.com/metal_plate',
  },

  // ── T7: CC0 low-poly weapon glTF models ─────────────────────────────────────
  // All from Quaternius "Ultimate Guns Pack" (Public Domain / CC0 1.0), mirrored
  // on poly.pizza. Saved into public/assets/weapons/ keyed by in-game weapon type.
  {
    name: 'pistol.glb',
    subdir: 'weapons',
    url: 'https://static.poly.pizza/f5a88c73-af97-49ca-8650-4bde579d2f80.glb',
    description: 'Low-poly pistol — maps to WeaponType PISTOL',
    credit: 'Pistol by Quaternius, CC0 1.0 — poly.pizza/m/J3i9KDQ3kt',
  },
  {
    name: 'rifle.glb',
    subdir: 'weapons',
    url: 'https://static.poly.pizza/9a0e478c-de82-4773-9b70-a0219bb0057c.glb',
    description: 'Low-poly assault rifle — maps to WeaponType RIFLE',
    credit: 'Assault Rifle by Quaternius, CC0 1.0 — poly.pizza/m/Bgvuu4CUMV',
  },
  {
    name: 'shotgun.glb',
    subdir: 'weapons',
    url: 'https://static.poly.pizza/f71d6771-f512-4374-bd23-ba00b564db68.glb',
    description: 'Low-poly shotgun — maps to WeaponType SHOTGUN',
    credit: 'Shotgun by Quaternius, CC0 1.0 — poly.pizza/m/ZmPTnh7njL',
  },
  {
    name: 'sniper.glb',
    subdir: 'weapons',
    url: 'https://static.poly.pizza/f03e21b7-e3b7-49fd-b47d-d1908649fcee.glb',
    description: 'Low-poly sniper rifle — maps to WeaponType SNIPER',
    credit: 'Sniper Rifle by Quaternius, CC0 1.0 — poly.pizza/m/ASOMZIErq3',
  },
];

// ── Fetch helpers ────────────────────────────────────────────────────────────

async function fetchFile(url, destPath) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'struk.game.shooter/asset-fetcher' },
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText} — ${url}`);
  }
  const ws = createWriteStream(destPath);
  await pipeline(res.body, ws);
}

// ── Main ─────────────────────────────────────────────────────────────────────

let ok = 0;
let skipped = 0;
let failed = 0;

for (const asset of ASSETS) {
  const destDir = asset.subdir ? path.join(OUT_DIR, asset.subdir) : OUT_DIR;
  mkdirSync(destDir, { recursive: true });
  const dest = path.join(destDir, asset.name);

  if (existsSync(dest)) {
    console.log(`  [skip] ${asset.name} — already present`);
    skipped++;
    continue;
  }

  process.stdout.write(`  [fetch] ${asset.name} … `);
  try {
    await fetchFile(asset.url, dest);
    console.log('OK');
    ok++;
  } catch (err) {
    console.log(`FAILED: ${err.message}`);
    failed++;
  }
}

console.log(`\nDone: ${ok} downloaded, ${skipped} skipped, ${failed} failed.`);

if (failed > 0) {
  console.error('\nSome assets failed to download. Check your network connection.');
  process.exit(1);
}
