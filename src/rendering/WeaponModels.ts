/**
 * Procedural weapon models — built from Three.js primitive geometry.
 *
 * No external assets. Each build*() returns a Group with named child
 * meshes ("body", "magazine", "muzzle") so the body renderer can
 * animate the magazine during reload.
 *
 * All models are designed to be parented to a forward-facing anchor
 * at the right hand. The "muzzle" child marks where tracers should
 * originate (in weapon-local space).
 */

import * as THREE from 'three';
import type { WeaponType } from '../models/Weapon';
import { AssetLoader } from '../assets/AssetLoader';

// ── glTF weapon models (T7) ───────────────────────────────────────────────────
//
// Each in-game weapon type maps to a CC0 low-poly glTF model fetched into
// public/assets/weapons/ by scripts/fetch_assets.mjs. The procedural box models
// below are KEPT as a fallback: buildWeaponModel() always returns a procedural
// group immediately, then asynchronously swaps in the glTF once it loads. If the
// glTF fails to load (404, parse error, headless test), the procedural model
// stays — the game never breaks.
//
// `targetLength` is the desired world-space size of the model's longest axis, in
// metres, chosen to roughly match the original procedural silhouette so the gun
// doesn't appear huge or tiny in the player's hands.

interface WeaponGLTFConfig {
  url: string;
  targetLength: number;
}

const WEAPON_GLTF: Record<WeaponType, WeaponGLTFConfig> = {
  PISTOL:  { url: '/assets/weapons/pistol.glb',  targetLength: 0.24 },
  RIFLE:   { url: '/assets/weapons/rifle.glb',   targetLength: 0.62 },
  SHOTGUN: { url: '/assets/weapons/shotgun.glb', targetLength: 0.70 },
  SNIPER:  { url: '/assets/weapons/sniper.glb',  targetLength: 0.85 },
};

// Shared, lazily-created loader. Tests inject a mock via setWeaponAssetLoader().
let weaponLoader: AssetLoader | null = null;

function getWeaponLoader(): AssetLoader {
  if (!weaponLoader) weaponLoader = new AssetLoader();
  return weaponLoader;
}

/** Override the AssetLoader used to fetch weapon glTF models (test hook). */
export function setWeaponAssetLoader(loader: AssetLoader | null): void {
  weaponLoader = loader;
}

/** Count descendant meshes of an object (a loaded glTF scene or fallback). */
function countMeshes(obj: THREE.Object3D): number {
  let n = 0;
  obj.traverse((o: THREE.Object3D) => {
    if ((o as THREE.Mesh).isMesh) n++;
  });
  return n;
}

/**
 * Normalise a loaded glTF scene so it visually replaces the procedural model:
 *   - uniformly scaled so its longest axis equals `targetLength` metres,
 *   - re-oriented so its longest axis lies along Z (the firing axis) and it is
 *     recentred on its own bounding box,
 *   - every mesh casts shadows.
 *
 * Robust to degenerate/empty geometry (mocked meshes in tests): if the bounding
 * box is zero-sized or non-finite, scaling/orienting is skipped.
 */
function prepareGLTFModel(scene: THREE.Object3D, type: WeaponType): THREE.Group {
  const wrapper = new THREE.Group();
  wrapper.name = `${type}_GLTF`;

  scene.traverse((o: THREE.Object3D) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) m.castShadow = true;
  });

  const box = new THREE.Box3().setFromObject(scene);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);

  const dims = [size.x, size.y, size.z];
  const longest = Math.max(dims[0], dims[1], dims[2]);
  const finite = Number.isFinite(longest) && longest > 1e-6 &&
    Number.isFinite(center.x) && Number.isFinite(center.y) && Number.isFinite(center.z);

  // Recentre the model on its bounding-box centre so it pivots about itself.
  if (finite) scene.position.set(-center.x, -center.y, -center.z);

  // Re-orient: if the longest axis is X (typical for these Quaternius models),
  // rotate +90° about Y so the barrel runs along Z like the procedural models.
  const inner = new THREE.Group();
  inner.add(scene);
  if (finite && size.x >= size.y && size.x >= size.z) {
    inner.rotation.y = Math.PI / 2;
  }

  if (finite) {
    const cfg = WEAPON_GLTF[type];
    const s = cfg.targetLength / longest;
    wrapper.scale.set(s, s, s);
  }

  wrapper.add(inner);
  return wrapper;
}

/**
 * Try to load the glTF model for `type` and, on success, replace the procedural
 * children of `group` with it. On any failure the procedural model is left in
 * place. Fire-and-forget; safe to ignore the returned promise.
 */
function enhanceWithGLTF(group: THREE.Group, type: WeaponType): Promise<void> {
  const cfg = WEAPON_GLTF[type];
  return getWeaponLoader().loadGLTF(cfg.url).then((gltf) => {
    const scene = gltf.scene;
    if (!scene || countMeshes(scene) === 0) return; // keep procedural fallback
    const model = prepareGLTFModel(scene, type);
    // Drop procedural geometry, keep the group's transform/orientation.
    for (const child of [...group.children]) {
      group.remove(child);
      disposeWeaponModel(child);
    }
    group.add(model);
  }).catch(() => {
    // Network/parse error — procedural model already in place.
  });
}

const MAT = {
  steel: () => new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.4, metalness: 0.7 }),
  black: () => new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.6, metalness: 0.3 }),
  wood: () => new THREE.MeshStandardMaterial({ color: 0x5a3a1a, roughness: 0.9 }),
  rubber: () => new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 1.0 }),
  darkWood: () => new THREE.MeshStandardMaterial({ color: 0x3a2a14, roughness: 0.9 }),
};

/**
 * Apply a procedural camo to all named 'body' / 'handguard' / 'stock'
 * materials of a weapon model. Camo types:
 *   - 'woodland' — green/brown/black stripes
 *   - 'desert'   — tan/khaki/brown stripes
 *   - 'urban'    — grey/black blocks
 *   - 'none'     — leave as-is
 *
 * The camo is implemented by overriding the material's color with a
 * striped vertex-color-style overlay (a small canvas texture).
 */
export function applyCamo(model: THREE.Object3D, camo: 'none' | 'woodland' | 'desert' | 'urban'): void {
  if (camo === 'none') return;
  const palette = (() => {
    switch (camo) {
      case 'woodland': return ['#3a4a1a', '#1f2a0e', '#5a4a2a', '#2a3a14'];
      case 'desert':   return ['#c2a060', '#a08040', '#806030', '#d8b870'];
      case 'urban':    return ['#4a4a4a', '#2a2a2a', '#6a6a6a', '#3a3a3a'];
      default:         return [];
    }
  })();
  const tex = makeCamoTexture(palette);
  const targets = ['body', 'handguard', 'stock'];
  model.traverse((o: THREE.Object3D) => {
    const m = o as THREE.Mesh;
    if (targets.includes(o.name) && (m as any).material) {
      const mat = m.material as THREE.MeshStandardMaterial;
      if (mat && mat.map === null) {
        mat.map = tex;
        mat.color.setHex(0xffffff);
        mat.needsUpdate = true;
      }
    }
  });
}

function makeCamoTexture(colors: string[]): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const ctx = c.getContext('2d')!;
  // Base color
  ctx.fillStyle = colors[0] || '#3a4a1a';
  ctx.fillRect(0, 0, 64, 64);
  // Random blobs in the other colors
  for (let i = 0; i < 18; i++) {
    ctx.fillStyle = colors[1 + Math.floor(Math.random() * (colors.length - 1))] || colors[0];
    const x = Math.random() * 64, y = Math.random() * 64;
    const r = 4 + Math.random() * 8;
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.7, Math.random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  return tex;
}

/** Standard mesh creator that names the result for later animation. */
function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, name: string): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.name = name;
  m.castShadow = true;
  return m;
}

/** Build a simple semi-auto pistol. */
function buildPistol(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'PISTOL';

  const body = mesh(new THREE.BoxGeometry(0.06, 0.06, 0.18), MAT.black(), 'body');
  body.position.set(0, 0, 0);
  g.add(body);

  const barrel = mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.10, 8), MAT.steel(), 'barrel');
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.012, -0.13);
  g.add(barrel);

  const muzzle = mesh(new THREE.BoxGeometry(0.01, 0.01, 0.01), MAT.steel(), 'muzzle');
  muzzle.position.set(0, 0.012, -0.19);
  g.add(muzzle);

  const grip = mesh(new THREE.BoxGeometry(0.05, 0.10, 0.05), MAT.black(), 'grip');
  grip.position.set(0, -0.07, 0.04);
  grip.rotation.x = -0.2;
  g.add(grip);

  const magazine = mesh(new THREE.BoxGeometry(0.04, 0.06, 0.03), MAT.black(), 'magazine');
  magazine.position.set(0, -0.10, 0.02);
  g.add(magazine);

  const trigger = mesh(new THREE.BoxGeometry(0.01, 0.03, 0.01), MAT.steel(), 'trigger');
  trigger.position.set(0, -0.04, 0.05);
  g.add(trigger);

  // Adjust group origin so the grip sits near the hand origin
  g.position.set(0, 0, 0.04);
  g.rotation.set(0, Math.PI, 0); // muzzle points -Z away from the camera
  return g;
}

/** Build a military-style assault rifle. */
function buildRifle(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'RIFLE';

  // Receiver
  const body = mesh(new THREE.BoxGeometry(0.07, 0.08, 0.30), MAT.black(), 'body');
  body.position.set(0, 0, 0);
  g.add(body);

  // Barrel
  const barrel = mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.34, 8), MAT.steel(), 'barrel');
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.015, -0.32);
  g.add(barrel);

  // Muzzle
  const muzzle = mesh(new THREE.BoxGeometry(0.01, 0.01, 0.01), MAT.steel(), 'muzzle');
  muzzle.position.set(0, 0.015, -0.50);
  g.add(muzzle);

  // Handguard
  const handguard = mesh(new THREE.BoxGeometry(0.06, 0.06, 0.16), MAT.wood(), 'handguard');
  handguard.position.set(0, -0.015, -0.18);
  g.add(handguard);

  // Magazine
  const magazine = mesh(new THREE.BoxGeometry(0.04, 0.14, 0.05), MAT.black(), 'magazine');
  magazine.position.set(0, -0.13, 0.02);
  g.add(magazine);

  // Stock
  const stock = mesh(new THREE.BoxGeometry(0.05, 0.07, 0.20), MAT.darkWood(), 'stock');
  stock.position.set(0, -0.01, 0.22);
  g.add(stock);

  // Grip
  const grip = mesh(new THREE.BoxGeometry(0.05, 0.10, 0.05), MAT.black(), 'grip');
  grip.position.set(0, -0.10, 0.06);
  g.add(grip);

  // Sight on top
  const sight = mesh(new THREE.BoxGeometry(0.02, 0.02, 0.04), MAT.black(), 'sight');
  sight.position.set(0, 0.055, -0.05);
  g.add(sight);

  g.position.set(0, 0, 0.05);
  g.rotation.set(0, Math.PI, 0);
  return g;
}

/** Build a pump-action shotgun (kept for wave mode). */
function buildShotgun(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'SHOTGUN';

  const body = mesh(new THREE.BoxGeometry(0.07, 0.07, 0.32), MAT.darkWood(), 'body');
  body.position.set(0, 0, 0);
  g.add(body);

  const barrel = mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.50, 8), MAT.steel(), 'barrel');
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.02, -0.36);
  g.add(barrel);

  const muzzle = mesh(new THREE.BoxGeometry(0.01, 0.01, 0.01), MAT.steel(), 'muzzle');
  muzzle.position.set(0, 0.02, -0.62);
  g.add(muzzle);

  const pump = mesh(new THREE.BoxGeometry(0.06, 0.04, 0.08), MAT.wood(), 'magazine'); // 'magazine' name reused for anim
  pump.position.set(0, -0.04, -0.18);
  g.add(pump);

  const stock = mesh(new THREE.BoxGeometry(0.05, 0.10, 0.22), MAT.darkWood(), 'stock');
  stock.position.set(0, -0.02, 0.22);
  g.add(stock);

  g.position.set(0, 0, 0.05);
  g.rotation.set(0, Math.PI, 0);
  return g;
}

/** Build a long bolt-action sniper rifle. */
function buildSniper(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'SNIPER';

  // Receiver
  const body = mesh(new THREE.BoxGeometry(0.06, 0.07, 0.28), MAT.black(), 'body');
  body.position.set(0, 0, 0);
  g.add(body);

  // Long barrel
  const barrel = mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.55, 8), MAT.steel(), 'barrel');
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.012, -0.42);
  g.add(barrel);

  // Muzzle brake
  const muzzleBrake = mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.05, 8), MAT.steel(), 'muzzleBrake');
  muzzleBrake.rotation.x = Math.PI / 2;
  muzzleBrake.position.set(0, 0.012, -0.72);
  g.add(muzzleBrake);

  // Muzzle anchor
  const muzzle = mesh(new THREE.BoxGeometry(0.01, 0.01, 0.01), MAT.steel(), 'muzzle');
  muzzle.position.set(0, 0.012, -0.75);
  g.add(muzzle);

  // Scope
  const scope = mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.20, 12), MAT.black(), 'scope');
  scope.rotation.x = Math.PI / 2;
  scope.position.set(0, 0.065, -0.04);
  g.add(scope);

  // Scope mount
  const mount = mesh(new THREE.BoxGeometry(0.04, 0.03, 0.08), MAT.steel(), 'scopeMount');
  mount.position.set(0, 0.045, -0.04);
  g.add(mount);

  // Internal magazine (bolt-action style)
  const magazine = mesh(new THREE.BoxGeometry(0.035, 0.05, 0.04), MAT.black(), 'magazine');
  magazine.position.set(0, -0.075, -0.02);
  g.add(magazine);

  // Wooden stock
  const stock = mesh(new THREE.BoxGeometry(0.05, 0.10, 0.26), MAT.wood(), 'stock');
  stock.position.set(0, -0.025, 0.24);
  g.add(stock);

  // Cheek pad
  const cheek = mesh(new THREE.BoxGeometry(0.04, 0.015, 0.18), MAT.rubber(), 'cheek');
  cheek.position.set(0, 0.03, 0.18);
  g.add(cheek);

  // Bipod legs (very simple, collapsed)
  const bipod = mesh(new THREE.BoxGeometry(0.06, 0.015, 0.04), MAT.black(), 'bipod');
  bipod.position.set(0, -0.06, -0.20);
  g.add(bipod);

  g.position.set(0, 0, 0.05);
  g.rotation.set(0, Math.PI, 0);
  return g;
}

/** Build the procedural (box-geometry) model for a weapon type. */
function buildProceduralModel(type: WeaponType): THREE.Group {
  switch (type) {
    case 'PISTOL':  return buildPistol();
    case 'RIFLE':   return buildRifle();
    case 'SHOTGUN': return buildShotgun();
    case 'SNIPER':  return buildSniper();
    default:        return buildPistol();
  }
}

/**
 * Build a model for the given weapon type, with an optional camo pattern.
 *
 * Returns a procedural group SYNCHRONOUSLY (so existing call sites are
 * unchanged) and then asynchronously swaps in the CC0 glTF model once it
 * loads. If the glTF fails to load, the procedural model stays as a fallback.
 */
export function buildWeaponModel(type: WeaponType, camo: 'none' | 'woodland' | 'desert' | 'urban' = 'none'): THREE.Group {
  const g = buildProceduralModel(type);
  if (camo !== 'none') applyCamo(g, camo);
  void enhanceWithGLTF(g, type);
  return g;
}

/**
 * Asynchronously build a weapon model, preferring the CC0 glTF model and
 * falling back to the procedural box model if it fails to load. Resolves once
 * the model (glTF or fallback) is ready. The returned group keeps the same
 * outer transform/scale (1,1,1) as the procedural version — the glTF is scaled
 * on an inner wrapper — so it drops into the existing anchor structure.
 */
export async function loadWeaponModel(
  type: WeaponType,
  camo: 'none' | 'woodland' | 'desert' | 'urban' = 'none',
): Promise<THREE.Group> {
  const g = buildProceduralModel(type);
  if (camo !== 'none') applyCamo(g, camo);
  await enhanceWithGLTF(g, type);
  return g;
}

/** Convenience async builders, one per weapon type (see loadWeaponModel). */
export const createPistol  = (camo: 'none' | 'woodland' | 'desert' | 'urban' = 'none') => loadWeaponModel('PISTOL', camo);
export const createRifle   = (camo: 'none' | 'woodland' | 'desert' | 'urban' = 'none') => loadWeaponModel('RIFLE', camo);
export const createShotgun = (camo: 'none' | 'woodland' | 'desert' | 'urban' = 'none') => loadWeaponModel('SHOTGUN', camo);
export const createSniper  = (camo: 'none' | 'woodland' | 'desert' | 'urban' = 'none') => loadWeaponModel('SNIPER', camo);

/** Dispose all materials/geometries inside a weapon model. */
export function disposeWeaponModel(model: THREE.Object3D): void {
  model.traverse((o: THREE.Object3D) => {
    const m = o as THREE.Mesh;
    if ((m as any).geometry) (m as any).geometry.dispose();
    const mat = (m.material as THREE.Material | THREE.Material[] | undefined);
    if (Array.isArray(mat)) mat.forEach((mm) => mm.dispose());
    else if (mat) mat.dispose();
  });
}

/** Compute the world-space muzzle position for a weapon model. */
export function getMuzzleLocalOffset(type: WeaponType): THREE.Vector3 {
  // All weapons are rotated 180° around Y so the muzzle points -Z.
  // We return a vector that, when added to the camera's forward direction
  // scaled by range, points to the muzzle in world space.
  switch (type) {
    case 'PISTOL':  return new THREE.Vector3(0, 0.012, -0.15);
    case 'RIFLE':   return new THREE.Vector3(0, 0.015, -0.45);
    case 'SHOTGUN': return new THREE.Vector3(0, 0.02, -0.57);
    case 'SNIPER':  return new THREE.Vector3(0, 0.012, -0.70);
    default:        return new THREE.Vector3(0, 0, -0.2);
  }
}
