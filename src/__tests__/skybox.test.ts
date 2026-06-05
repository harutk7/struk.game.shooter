import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { SceneBuilder } from '../rendering/SceneBuilder';
import type { FloorTextureLoader } from '../rendering/SceneBuilder';
import { Skybox } from '../rendering/Skybox';
import { WeaponRenderer } from '../rendering/WeaponRenderer';

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

describe('skybox v2 + exp2 fog', () => {
  it('scene.fog is FogExp2 after SceneBuilder.build()', () => {
    const scene = buildScene();
    expect(scene.fog).not.toBeNull();
    expect(scene.fog).toBeInstanceOf(THREE.FogExp2);
  });

  it('FogExp2 density is 0.012', () => {
    const scene = buildScene();
    expect((scene.fog as THREE.FogExp2).density).toBeCloseTo(0.012, 4);
  });

  it('skybox shader has uSunPosition uniform', () => {
    const scene = new THREE.Scene();
    new Skybox(scene);
    const mesh = scene.children[0] as THREE.Mesh;
    const mat = mesh.material as THREE.ShaderMaterial;
    expect(mat.uniforms['uSunPosition']).toBeDefined();
    expect(mat.uniforms['uSunPosition'].value).toBeInstanceOf(THREE.Vector3);
  });

  it('weapon group materials have fog: false', () => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera();
    const renderer = new WeaponRenderer(scene, camera);
    let hasFogFalse = false;
    renderer.weaponGroup.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if ((mesh as any).material) {
        const mat = mesh.material as THREE.Material;
        if (mat.fog === false) hasFogFalse = true;
      }
    });
    expect(hasFogFalse).toBe(true);
  });
});
