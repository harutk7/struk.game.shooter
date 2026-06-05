import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { SceneBuilder } from '../rendering/SceneBuilder';
import type { FloorTextureLoader } from '../rendering/SceneBuilder';

function makeMockLoader(): FloorTextureLoader {
  return {
    load: (_url: string): THREE.Texture => new THREE.Texture(),
  };
}

function buildScene(envMap?: THREE.Texture): THREE.Scene {
  const scene = new THREE.Scene();
  const builder = new SceneBuilder(scene, makeMockLoader(), envMap);
  builder.build();
  return scene;
}

function findSunLight(scene: THREE.Scene): THREE.DirectionalLight | undefined {
  let found: THREE.DirectionalLight | undefined;
  scene.traverse((obj) => {
    if (obj instanceof THREE.DirectionalLight && obj.castShadow) {
      found = obj;
    }
  });
  return found;
}

describe('lighting', () => {
  it('scene.environment is set when envMap is provided', () => {
    const envMap = new THREE.Texture();
    const scene = buildScene(envMap);
    expect(scene.environment).not.toBeNull();
    expect(scene.environment).toBe(envMap);
  });

  it('scene.fog is enabled after build', () => {
    const scene = buildScene();
    expect(scene.fog).not.toBeNull();
    expect(scene.fog).toBeInstanceOf(THREE.Fog);
  });

  it('sun directional light has castShadow = true', () => {
    const scene = buildScene();
    const sunLight = findSunLight(scene);
    expect(sunLight).toBeDefined();
    expect(sunLight!.castShadow).toBe(true);
  });

  it('shadow map size is at least 2048', () => {
    const scene = buildScene();
    const sunLight = findSunLight(scene);
    expect(sunLight).toBeDefined();
    expect(sunLight!.shadow.mapSize.width).toBeGreaterThanOrEqual(2048);
    expect(sunLight!.shadow.mapSize.height).toBeGreaterThanOrEqual(2048);
  });
});
