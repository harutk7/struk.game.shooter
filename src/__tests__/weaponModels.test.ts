import { describe, it, expect, afterEach } from 'vitest';
import * as THREE from 'three';
import {
  buildWeaponModel,
  loadWeaponModel,
  createPistol,
  createRifle,
  createShotgun,
  createSniper,
  setWeaponAssetLoader,
} from '../rendering/WeaponModels';
import { AssetLoader } from '../assets/AssetLoader';
import type { GLTFLoaderLike, TextureLoaderLike, AudioLoaderLike, GLTF } from '../assets/AssetLoader';
import type { WeaponType } from '../models/Weapon';

// ── Mock loader plumbing ──────────────────────────────────────────────────────

const noopTexture: TextureLoaderLike = { load: (_u, onLoad) => onLoad?.({} as THREE.Texture) };
const noopAudio: AudioLoaderLike = { load: (_u, onLoad) => onLoad?.({} as AudioBuffer) };

/** A glTF scene with a single real Mesh, so bounding-box maths is finite. */
function meshScene(): THREE.Group {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.BoxGeometry(2, 0.3, 0.5), new THREE.MeshStandardMaterial()));
  return g;
}

function loaderReturning(scene: THREE.Group): AssetLoader {
  const gltfLoader: GLTFLoaderLike = {
    load: (_url, onLoad) => onLoad?.({ scene, scenes: [] } as GLTF),
  };
  return new AssetLoader({ gltfLoader, textureLoader: noopTexture, audioLoader: noopAudio });
}

function erroringLoader(): AssetLoader {
  const gltfLoader: GLTFLoaderLike = {
    load: (_url, _onLoad, _onProgress, onError) => onError?.(new Error('404 Not Found')),
  };
  return new AssetLoader({ gltfLoader, textureLoader: noopTexture, audioLoader: noopAudio });
}

function countMeshes(obj: THREE.Object3D): number {
  let n = 0;
  obj.traverse((o) => { if ((o as THREE.Mesh).isMesh) n++; });
  return n;
}

afterEach(() => setWeaponAssetLoader(null));

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('WeaponModels — glTF loading (T7)', () => {
  it('createPistol() resolves to a Group with at least one Mesh, scale matching the original', async () => {
    setWeaponAssetLoader(null);
    const original = buildWeaponModel('PISTOL'); // procedural reference (scale 1)

    setWeaponAssetLoader(loaderReturning(meshScene()));
    const g = await createPistol();

    expect(g).toBeInstanceOf(THREE.Group);
    expect(countMeshes(g)).toBeGreaterThanOrEqual(1);
    expect(Math.abs(g.scale.x - original.scale.x)).toBeLessThanOrEqual(0.1);
  });

  it('loads a glTF model for every weapon type and swaps out the procedural boxes', async () => {
    const types: WeaponType[] = ['PISTOL', 'RIFLE', 'SHOTGUN', 'SNIPER'];
    for (const type of types) {
      setWeaponAssetLoader(loaderReturning(meshScene()));
      const g = await loadWeaponModel(type);
      expect(countMeshes(g)).toBeGreaterThanOrEqual(1);
      // The swapped-in glTF wrapper is named "<TYPE>_GLTF".
      expect(g.getObjectByName(`${type}_GLTF`)).toBeDefined();
    }
  });

  it('createRifle/createShotgun/createSniper all resolve with meshes', async () => {
    setWeaponAssetLoader(loaderReturning(meshScene()));
    for (const create of [createRifle, createShotgun, createSniper]) {
      const g = await create();
      expect(countMeshes(g)).toBeGreaterThanOrEqual(1);
    }
  });

  it('falls back to the procedural model when the glTF fails to load', async () => {
    setWeaponAssetLoader(erroringLoader());
    const g = await loadWeaponModel('PISTOL');
    expect(countMeshes(g)).toBeGreaterThanOrEqual(1);
    // No glTF wrapper — the procedural boxes are still present.
    expect(g.getObjectByName('PISTOL_GLTF')).toBeUndefined();
    expect(g.getObjectByName('body')).toBeDefined();
  });

  it('keeps the procedural model when the glTF scene is empty (no meshes)', async () => {
    setWeaponAssetLoader(loaderReturning(new THREE.Group()));
    const g = await loadWeaponModel('RIFLE');
    expect(g.getObjectByName('RIFLE_GLTF')).toBeUndefined();
    expect(countMeshes(g)).toBeGreaterThanOrEqual(1);
  });

  it('buildWeaponModel stays synchronous and returns a procedural group immediately', () => {
    setWeaponAssetLoader(loaderReturning(meshScene()));
    const g = buildWeaponModel('SNIPER');
    // Synchronously (before the async swap) the procedural geometry is present.
    expect(countMeshes(g)).toBeGreaterThanOrEqual(1);
    expect(g.name).toBe('SNIPER');
  });
});
