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

/** Build a model for the given weapon type, with an optional camo pattern. */
export function buildWeaponModel(type: WeaponType, camo: 'none' | 'woodland' | 'desert' | 'urban' = 'none'): THREE.Group {
  let g: THREE.Group;
  switch (type) {
    case 'PISTOL':  g = buildPistol(); break;
    case 'RIFLE':   g = buildRifle(); break;
    case 'SHOTGUN': g = buildShotgun(); break;
    case 'SNIPER':  g = buildSniper(); break;
    default:        g = buildPistol();
  }
  if (camo !== 'none') applyCamo(g, camo);
  return g;
}

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
