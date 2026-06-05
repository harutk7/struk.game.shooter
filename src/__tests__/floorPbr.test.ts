import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { SceneBuilder } from '../rendering/SceneBuilder';
import type { FloorTextureLoader } from '../rendering/SceneBuilder';

const REPEAT = 8;

function makeMockLoader(): FloorTextureLoader {
  return {
    load: (_url: string): THREE.Texture => new THREE.Texture(),
  };
}

function buildScene(): { floor: THREE.Mesh; mat: THREE.MeshStandardMaterial } {
  const scene = new THREE.Scene();
  const builder = new SceneBuilder(scene, makeMockLoader());
  builder.build();
  const floor = scene.children.find(c => c.name === 'floor') as THREE.Mesh;
  return { floor, mat: floor.material as THREE.MeshStandardMaterial };
}

describe('Floor PBR material', () => {
  it('floor mesh exists and is named floor', () => {
    const { floor } = buildScene();
    expect(floor).toBeDefined();
    expect(floor.name).toBe('floor');
  });

  it('floor material is MeshStandardMaterial', () => {
    const { mat } = buildScene();
    expect(mat).toBeInstanceOf(THREE.MeshStandardMaterial);
  });

  it('floor material has non-null map', () => {
    const { mat } = buildScene();
    expect(mat.map).not.toBeNull();
  });

  it('floor material has non-null normalMap', () => {
    const { mat } = buildScene();
    expect(mat.normalMap).not.toBeNull();
  });

  it('floor diffuse texture repeat.x equals 8', () => {
    const { mat } = buildScene();
    expect(mat.map?.repeat.x).toBe(REPEAT);
  });

  it('floor diffuse texture repeat.y equals 8', () => {
    const { mat } = buildScene();
    expect(mat.map?.repeat.y).toBe(REPEAT);
  });

  it('floor material roughness is 1.0 and metalness is 0.0', () => {
    const { mat } = buildScene();
    expect(mat.roughness).toBe(1.0);
    expect(mat.metalness).toBe(0.0);
  });

  it('floor mesh has receiveShadow enabled', () => {
    const { floor } = buildScene();
    expect(floor.receiveShadow).toBe(true);
  });
});
