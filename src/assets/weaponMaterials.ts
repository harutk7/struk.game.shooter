/**
 * Per-weapon PBR material configuration (T8).
 *
 * Maps each weapon's named mesh parts to a physical material category
 * (metal / polymer / wood / rubber). `WeaponModels.applyWeaponMaterials()`
 * walks a built weapon (procedural box model OR a loaded glTF), matches each
 * mesh's name to a category defined here, and assigns a `MeshStandardMaterial`
 * tuned for that surface:
 *
 *   - metal   → high metalness, low roughness  → reflects the scene HDRI
 *   - polymer → zero metalness, high roughness  → matte plastic
 *   - wood    → zero metalness, mid roughness   → procedural wood-grain map
 *   - rubber  → zero metalness, full roughness  → dead-matte (cheek pads etc.)
 *
 * Kept as PLAIN DATA (no three.js import) so future tasks can re-tune the look —
 * tweak a roughness, re-route a part to a different category — without touching
 * rendering code or re-exporting the glTF models.
 */

import type { WeaponType } from '../models/Weapon';

export type MaterialCategory = 'metal' | 'polymer' | 'wood' | 'rubber';

export interface PBRMaterialSpec {
  /** Base colour as a hex int (ignored when a colour map is supplied). */
  color: number;
  /** 0 = dielectric (plastic/wood), 1 = pure metal. */
  metalness: number;
  /** 0 = mirror, 1 = fully diffuse. */
  roughness: number;
  /** Which texture map to apply, if any. 'wood' = procedural grain. */
  map: 'wood' | null;
  /** How strongly the surface reflects `scene.environment` (the HDRI). */
  envMapIntensity: number;
}

/**
 * The four physical surface presets. Metal sits well above the 0.7 metalness
 * threshold (so it visibly reflects the sky); polymer/wood/rubber stay at 0 so
 * they read as non-metallic.
 */
export const MATERIAL_PRESETS: Record<MaterialCategory, PBRMaterialSpec> = {
  metal:   { color: 0x3f444b, metalness: 0.9, roughness: 0.3, map: null,   envMapIntensity: 1.0 },
  polymer: { color: 0x17191d, metalness: 0.0, roughness: 0.7, map: null,   envMapIntensity: 0.35 },
  wood:    { color: 0x6b4422, metalness: 0.0, roughness: 0.6, map: 'wood', envMapIntensity: 0.25 },
  rubber:  { color: 0x0d0d0d, metalness: 0.0, roughness: 1.0, map: null,   envMapIntensity: 0.1 },
};

/**
 * Default mesh-name → category mapping, shared by every weapon. Names are
 * matched case-insensitively after stripping a trailing numeric suffix, so
 * `barrel`, `Barrel.001` and `barrel_02` all resolve to `metal`. Names that
 * aren't an exact key fall back to the longest matching prefix (so glTF parts
 * like `barrel_low` still resolve).
 */
export const DEFAULT_PART_MATERIALS: Record<string, MaterialCategory> = {
  // Metal — barrels, slides, receivers, hardware.
  barrel: 'metal',
  slide: 'metal',
  receiver: 'metal',
  bolt: 'metal',
  muzzle: 'metal',
  muzzlebrake: 'metal',
  trigger: 'metal',
  sight: 'metal',
  scopemount: 'metal',
  rail: 'metal',
  bipod: 'metal',
  // Polymer — frames, grips, magazines, optics housings.
  body: 'polymer',
  grip: 'polymer',
  magazine: 'polymer',
  scope: 'polymer',
  foregrip: 'polymer',
  // Wood — furniture.
  handguard: 'wood',
  stock: 'wood',
  // Rubber — recoil/cheek pads.
  cheek: 'rubber',
  pad: 'rubber',
};

/**
 * Per-weapon overrides layered on top of {@link DEFAULT_PART_MATERIALS}. The
 * pump-shotgun has a wooden receiver and wooden pump fore-end (which reuses the
 * `magazine` name for its reload animation); the bolt-action sniper keeps a
 * steel receiver. Future tasks tune individual weapons here.
 */
export const WEAPON_PART_OVERRIDES: Partial<Record<WeaponType, Record<string, MaterialCategory>>> = {
  SHOTGUN: {
    body: 'wood',
    magazine: 'wood', // the pump fore-end is named 'magazine' for reload anim
  },
  SNIPER: {
    body: 'metal',
  },
};

/** Strip a trailing numeric suffix and lowercase: `Barrel.001` → `barrel`. */
export function normalizePartName(name: string): string {
  return name.toLowerCase().replace(/[._-]?\d+$/, '').trim();
}

/**
 * Resolve the material category for a weapon + mesh name, or `null` when the
 * name isn't recognised — callers MUST leave unrecognised meshes' existing
 * materials untouched (so glTF-authored materials survive).
 */
export function categoryForPart(type: WeaponType, meshName: string): MaterialCategory | null {
  if (!meshName) return null;
  const key = normalizePartName(meshName);
  const overrides = WEAPON_PART_OVERRIDES[type];

  // 1. Exact match — overrides win over defaults.
  if (overrides && overrides[key]) return overrides[key];
  if (DEFAULT_PART_MATERIALS[key]) return DEFAULT_PART_MATERIALS[key];

  // 2. Longest-prefix fallback (for arbitrarily-suffixed glTF mesh names).
  let best: MaterialCategory | null = null;
  let bestLen = 0;
  const consider = (table: Record<string, MaterialCategory>, winTies: boolean) => {
    for (const prefix of Object.keys(table)) {
      if (key.startsWith(prefix) && (winTies ? prefix.length >= bestLen : prefix.length > bestLen)) {
        best = table[prefix];
        bestLen = prefix.length;
      }
    }
  };
  consider(DEFAULT_PART_MATERIALS, false);
  if (overrides) consider(overrides, true); // overrides win on equal-length prefix
  return best;
}

/** Resolve the full PBR spec for a part, or `null` if the name is unrecognised. */
export function specForPart(type: WeaponType, meshName: string): PBRMaterialSpec | null {
  const category = categoryForPart(type, meshName);
  return category ? MATERIAL_PRESETS[category] : null;
}
