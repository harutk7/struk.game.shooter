import { describe, it, expect, afterEach } from 'vitest';
import * as THREE from 'three';
import {
  buildWeaponModel,
  applyWeaponMaterials,
  setWeaponAssetLoader,
} from '../rendering/WeaponModels';
import {
  categoryForPart,
  specForPart,
  normalizePartName,
  MATERIAL_PRESETS,
} from '../assets/weaponMaterials';

// buildWeaponModel kicks off an async glTF load via the default loader; in the
// headless test env that load just fails and the procedural model stays. Reset
// the loader hook after each test for hygiene.
afterEach(() => setWeaponAssetLoader(null));

function std(mesh: THREE.Object3D | undefined): THREE.MeshStandardMaterial {
  expect(mesh, 'expected mesh to exist').toBeDefined();
  return (mesh as THREE.Mesh).material as THREE.MeshStandardMaterial;
}

// ── Config layer ──────────────────────────────────────────────────────────────

describe('weaponMaterials config (T8)', () => {
  it('classifies barrels as metal, grips as polymer, stocks as wood', () => {
    expect(categoryForPart('RIFLE', 'barrel')).toBe('metal');
    expect(categoryForPart('PISTOL', 'grip')).toBe('polymer');
    expect(categoryForPart('SNIPER', 'stock')).toBe('wood');
    expect(categoryForPart('SNIPER', 'cheek')).toBe('rubber');
  });

  it('applies per-weapon overrides (shotgun wood receiver/pump, sniper steel receiver)', () => {
    expect(categoryForPart('SHOTGUN', 'body')).toBe('wood');
    expect(categoryForPart('SHOTGUN', 'magazine')).toBe('wood'); // pump fore-end
    expect(categoryForPart('SNIPER', 'body')).toBe('metal');
    expect(categoryForPart('RIFLE', 'body')).toBe('polymer');
  });

  it('normalises suffixed glTF mesh names', () => {
    expect(normalizePartName('Barrel.001')).toBe('barrel');
    expect(normalizePartName('grip_02')).toBe('grip');
    expect(categoryForPart('RIFLE', 'barrel_01')).toBe('metal');
  });

  it('returns null for unrecognised parts so glTF materials survive', () => {
    expect(categoryForPart('RIFLE', 'Cube')).toBeNull();
    expect(categoryForPart('RIFLE', '')).toBeNull();
    expect(specForPart('RIFLE', 'xyzzy')).toBeNull();
  });

  it('metal preset is reflective, polymer is matte, wood carries a map', () => {
    expect(MATERIAL_PRESETS.metal.metalness).toBeGreaterThanOrEqual(0.7);
    expect(MATERIAL_PRESETS.metal.roughness).toBeLessThanOrEqual(0.4);
    expect(MATERIAL_PRESETS.polymer.metalness).toBeLessThanOrEqual(0.1);
    expect(MATERIAL_PRESETS.wood.map).toBe('wood');
  });
});

// ── Applied to real built weapons ─────────────────────────────────────────────

describe('applyWeaponMaterials on built weapons (T8)', () => {
  it('rifle: barrel is metallic, grip is matte plastic, handguard has a grain map', () => {
    const rifle = buildWeaponModel('RIFLE', 'none');
    expect(std(rifle.getObjectByName('barrel')).metalness).toBeGreaterThanOrEqual(0.7);
    expect(std(rifle.getObjectByName('grip')).metalness).toBeLessThanOrEqual(0.1);
    expect(std(rifle.getObjectByName('handguard')).map).not.toBeNull();
  });

  it('sniper: wooden stock has a map, optic housing is matte', () => {
    const sniper = buildWeaponModel('SNIPER', 'none');
    expect(std(sniper.getObjectByName('stock')).map).not.toBeNull();
    expect(std(sniper.getObjectByName('scope')).metalness).toBeLessThanOrEqual(0.1);
    // The bolt-action receiver is steel (per-weapon override).
    expect(std(sniper.getObjectByName('body')).metalness).toBeGreaterThanOrEqual(0.7);
  });

  it('shotgun: wooden receiver and pump both carry the wood map', () => {
    const shotgun = buildWeaponModel('SHOTGUN', 'none');
    expect(std(shotgun.getObjectByName('body')).map).not.toBeNull();
    expect(std(shotgun.getObjectByName('magazine')).map).not.toBeNull();
  });

  it('leaves unknown-named meshes untouched (glTF materials survive)', () => {
    const g = new THREE.Group();
    const keep = new THREE.MeshStandardMaterial({ metalness: 0.5 });
    const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), keep);
    m.name = 'totally_unknown_part';
    g.add(m);
    applyWeaponMaterials(g, 'RIFLE');
    expect(m.material).toBe(keep); // same instance — not replaced
  });

  it('reuses a single shared wood texture across parts and weapons', () => {
    const a = buildWeaponModel('SNIPER', 'none');
    const b = buildWeaponModel('SHOTGUN', 'none');
    const woodA = std(a.getObjectByName('stock')).map;
    const woodB = std(b.getObjectByName('body')).map;
    expect(woodA).not.toBeNull();
    expect(woodA).toBe(woodB); // cached, not re-generated per part
  });
});
