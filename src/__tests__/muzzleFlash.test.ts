/**
 * Muzzle flash v2 — verifies the flash is an additive billboard mesh with a
 * procedurally-generated texture, plus a pulsing point light, and that color
 * varies per weapon.
 */

import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { WeaponRenderer } from '../rendering/WeaponRenderer';

function makeRenderer(): { wr: WeaponRenderer; scene: THREE.Scene; camera: THREE.Camera } {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 100);
  const wr = new WeaponRenderer(scene, camera);
  return { wr, scene, camera };
}

describe('muzzle flash v2', () => {
  it('flash is an additive, transparent MeshBasicMaterial billboard and the light pulses', () => {
    const { wr } = makeRenderer();
    wr.triggerMuzzleFlash('ak');

    const mesh = (wr as any).muzzleFlashMesh as THREE.Mesh;
    const mat = mesh.material as THREE.MeshBasicMaterial;
    const light = (wr as any).muzzleFlash as THREE.PointLight;

    // Billboard mesh, not a Sprite, and visible right after firing.
    expect(mesh).toBeInstanceOf(THREE.Mesh);
    expect(mesh.visible).toBe(true);

    // Material: additive, transparent MeshBasicMaterial with a generated texture.
    expect(mat).toBeInstanceOf(THREE.MeshBasicMaterial);
    expect(mat.transparent).toBe(true);
    expect(mat.blending).toBe(THREE.AdditiveBlending);
    expect(mat.map).toBeTruthy();

    // Point light pulses (non-zero intensity, visible) at the muzzle.
    expect(light.visible).toBe(true);
    expect(light.intensity).toBeGreaterThan(0);
  });

  it('animates: scales up then fades out, hiding after the lifetime', () => {
    const { wr } = makeRenderer();
    const mesh = (wr as any).muzzleFlashMesh as THREE.Mesh;
    const mat = mesh.material as THREE.MeshBasicMaterial;
    const light = (wr as any).muzzleFlash as THREE.PointLight;

    wr.triggerMuzzleFlash('rifle');
    const start = (wr as any).flashStart as number;

    // Early in the bloom the flash has scaled up and is still bright.
    wr.tick(start + 28); // ~35% through the 80ms bloom (near peak)
    const peakScale = mesh.scale.x;
    expect(peakScale).toBeGreaterThan(0.3);
    expect(mat.opacity).toBeGreaterThan(0.5);

    // Past both lifetimes the mesh and light are hidden and the light is dark.
    wr.tick(start + 200);
    expect(mesh.visible).toBe(false);
    expect(light.visible).toBe(false);
    expect(light.intensity).toBe(0);
  });

  it('uses different light colors per weapon (color variation)', () => {
    const { wr } = makeRenderer();
    const light = (wr as any).muzzleFlash as THREE.PointLight;

    wr.triggerMuzzleFlash('pistol');
    const pistolColor = light.color.getHex();

    wr.triggerMuzzleFlash('ak');
    const akColor = light.color.getHex();

    expect(pistolColor).not.toBe(akColor);
  });
});
