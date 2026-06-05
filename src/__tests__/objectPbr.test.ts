import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { SceneBuilder } from '../rendering/SceneBuilder';
import type { FloorTextureLoader } from '../rendering/SceneBuilder';

function makeMockLoader(): FloorTextureLoader {
  return {
    load: (_url: string): THREE.Texture => new THREE.Texture(),
  };
}

function buildScene(): THREE.Scene {
  const scene = new THREE.Scene();
  const builder = new SceneBuilder(scene, makeMockLoader());
  builder.build();
  return scene;
}

function getMeshesByName(scene: THREE.Scene, name: string): THREE.Mesh[] {
  const result: THREE.Mesh[] = [];
  scene.traverse((obj) => {
    if (obj instanceof THREE.Mesh && obj.name === name) result.push(obj);
  });
  return result;
}

describe('Object PBR materials', () => {
  it('at least 4 distinct MeshStandardMaterial instances exist after build', () => {
    const scene = buildScene();
    const materials = new Set<THREE.MeshStandardMaterial>();
    ['wall', 'crate', 'barrel', 'pillar'].forEach((name) => {
      const mesh = getMeshesByName(scene, name)[0];
      expect(mesh, `expected at least one mesh named "${name}"`).toBeDefined();
      expect(mesh.material).toBeInstanceOf(THREE.MeshStandardMaterial);
      materials.add(mesh.material as THREE.MeshStandardMaterial);
    });
    expect(materials.size).toBeGreaterThanOrEqual(4);
  });

  it('wall material is MeshStandardMaterial with map and normalMap', () => {
    const scene = buildScene();
    const mesh = getMeshesByName(scene, 'wall')[0];
    const mat = mesh.material as THREE.MeshStandardMaterial;
    expect(mat).toBeInstanceOf(THREE.MeshStandardMaterial);
    expect(mat.map).not.toBeNull();
    expect(mat.normalMap).not.toBeNull();
    expect(mat.roughness).toBeCloseTo(0.9);
    expect(mat.metalness).toBeCloseTo(0.0);
  });

  it('crate material is MeshStandardMaterial with map and normalMap', () => {
    const scene = buildScene();
    const mesh = getMeshesByName(scene, 'crate')[0];
    const mat = mesh.material as THREE.MeshStandardMaterial;
    expect(mat).toBeInstanceOf(THREE.MeshStandardMaterial);
    expect(mat.map).not.toBeNull();
    expect(mat.normalMap).not.toBeNull();
    expect(mat.roughness).toBeCloseTo(0.85);
    expect(mat.metalness).toBeCloseTo(0.0);
  });

  it('barrel material is MeshStandardMaterial with map and normalMap', () => {
    const scene = buildScene();
    const mesh = getMeshesByName(scene, 'barrel')[0];
    const mat = mesh.material as THREE.MeshStandardMaterial;
    expect(mat).toBeInstanceOf(THREE.MeshStandardMaterial);
    expect(mat.map).not.toBeNull();
    expect(mat.normalMap).not.toBeNull();
    expect(mat.roughness).toBeCloseTo(0.4);
    expect(mat.metalness).toBeCloseTo(0.7);
  });

  it('pillar material is MeshStandardMaterial with map and normalMap', () => {
    const scene = buildScene();
    const mesh = getMeshesByName(scene, 'pillar')[0];
    const mat = mesh.material as THREE.MeshStandardMaterial;
    expect(mat).toBeInstanceOf(THREE.MeshStandardMaterial);
    expect(mat.map).not.toBeNull();
    expect(mat.normalMap).not.toBeNull();
    expect(mat.roughness).toBeCloseTo(0.95);
    expect(mat.metalness).toBeCloseTo(0.0);
  });

  it('all 4 material types are distinct instances', () => {
    const scene = buildScene();
    const names = ['wall', 'crate', 'barrel', 'pillar'];
    const mats = names.map((name) => {
      const mesh = getMeshesByName(scene, name)[0];
      return mesh.material as THREE.MeshStandardMaterial;
    });
    const unique = new Set(mats);
    expect(unique.size).toBe(4);
  });

  it('wall and low_wall share the same concrete material', () => {
    const scene = buildScene();
    const wallMat = (getMeshesByName(scene, 'wall')[0].material) as THREE.MeshStandardMaterial;
    const lowWallMat = (getMeshesByName(scene, 'low_wall')[0].material) as THREE.MeshStandardMaterial;
    expect(wallMat).toBe(lowWallMat);
  });

  it('colliders count matches obstacle objects', () => {
    const scene = new THREE.Scene();
    const builder = new SceneBuilder(scene, makeMockLoader());
    const colliders = builder.build();
    // 4 walls + 8 crates + 8 barrels + 4 low_walls + 4 pillars = 28
    expect(colliders.length).toBeGreaterThanOrEqual(28);
  });

  it('crates have random y-rotation applied', () => {
    const scene = buildScene();
    const crates = getMeshesByName(scene, 'crate');
    expect(crates.length).toBe(8);
    const rotations = new Set(crates.map((c) => c.rotation.y));
    // With 8 crates and random rotations, expect more than 1 unique value
    expect(rotations.size).toBeGreaterThan(1);
  });
});
