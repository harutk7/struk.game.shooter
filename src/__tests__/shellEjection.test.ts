/**
 * Shell ejection (T10) — verifies that firing ejects a pooled brass shell from
 * the weapon's ejection port, that the shell obeys gravity (falls below the
 * floor plane), bounces, and is recycled after its lifetime.
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

/** Identity-ish weapon pose at ~1.4m eye height looking down -z. */
function pose(): { position: THREE.Vector3; rotation: THREE.Quaternion } {
  const position = new THREE.Vector3(0, 1.4, 0);
  const rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, 0, 'YXZ'));
  return { position, rotation };
}

describe('shell ejection', () => {
  it('ejects a brass shell at the ejection port when the weapon fires', () => {
    const { wr } = makeRenderer();
    const { position, rotation } = pose();

    const shells = (wr as any).activeShells as Array<any>;
    expect(shells.length).toBe(0);

    wr.ejectShell(position, rotation);

    expect(shells.length).toBe(1);
    const shell = shells[0];
    // Mesh is added to the scene, visible, and uses a brass standard material.
    expect(shell.mesh).toBeInstanceOf(THREE.Mesh);
    expect(shell.mesh.visible).toBe(true);
    const mat = shell.mesh.material as THREE.MeshStandardMaterial;
    expect(mat).toBeInstanceOf(THREE.MeshStandardMaterial);
    expect(mat.metalness).toBeCloseTo(0.9);
    expect(mat.color.getHex()).toBe(0xb87333);

    // Spawned at the ejection port, i.e. close to (and above the floor relative
    // to) the weapon position — well within a hand's reach of it.
    expect(shell.mesh.position.distanceTo(position)).toBeLessThan(0.5);

    // Has a non-trivial initial velocity and a tumble on all 3 axes.
    const v = shell.velocity;
    expect(Math.abs(v.x) + Math.abs(v.y) + Math.abs(v.z)).toBeGreaterThan(0);
    expect(shell.angular.x).not.toBe(0);
    expect(shell.angular.y).not.toBe(0);
    expect(shell.angular.z).not.toBe(0);
  });

  it('respects gravity: the shell falls below the floor plane within 5s of simulation', () => {
    const { wr } = makeRenderer();
    const { position, rotation } = pose();

    wr.ejectShell(position, rotation);
    const shell = ((wr as any).activeShells as Array<any>)[0];
    const startY = shell.mesh.position.y;

    // Manually tick the simulation forward; record whether the shell ever sinks
    // to/through the floor (gravity pulled it all the way down) and whether its
    // vertical velocity ever flips upward (a bounce happened).
    let start = performance.now();
    let t = start;
    let sawBelowFloor = false;
    let bounced = false;
    let prevVy = shell.velocity.y;
    for (let i = 0; i < 300; i++) { // 300 * 16ms ≈ 5s
      t += 16;
      wr.tick(t);
      if (shell.mesh.position.y < 0) sawBelowFloor = true;
      if (prevVy < 0 && shell.velocity.y > 0) bounced = true;
      prevVy = shell.velocity.y;
    }

    expect(startY).toBeGreaterThan(0); // ejected above the floor
    expect(sawBelowFloor).toBe(true); // gravity brought it to the floor
    expect(bounced).toBe(true); // and it bounced
  });

  it('recycles the shell back to the pool after its lifetime', () => {
    const { wr } = makeRenderer();
    const { position, rotation } = pose();

    wr.ejectShell(position, rotation);
    const shells = (wr as any).activeShells as Array<any>;
    expect(shells.length).toBe(1);
    const mesh = shells[0].mesh;

    let t = performance.now();
    for (let i = 0; i < 150; i++) { // ~2.4s, past the 1.5s lifetime
      t += 16;
      wr.tick(t);
    }

    expect(shells.length).toBe(0);
    expect(mesh.visible).toBe(false);
  });

  it('reuses pooled instances rather than leaking meshes (≥20 shells stay bounded)', () => {
    const { wr, scene } = makeRenderer();
    const { position, rotation } = pose();

    // Fire 25 shells in a burst, then drain past their lifetime.
    for (let i = 0; i < 25; i++) wr.ejectShell(position, rotation);
    const shells = (wr as any).activeShells as Array<any>;
    expect(shells.length).toBe(25);

    let t = performance.now();
    for (let i = 0; i < 150; i++) {
      t += 16;
      wr.tick(t);
    }
    expect(shells.length).toBe(0);

    // Fire another burst — the pool should be reused, so the number of shell
    // meshes parented to the scene never grows without bound.
    for (let i = 0; i < 25; i++) wr.ejectShell(position, rotation);
    const shellMeshes = scene.children.filter(
      (c) => c instanceof THREE.Mesh && (c as THREE.Mesh).material instanceof THREE.MeshStandardMaterial,
    );
    // 25 active + at most the pooled spares; comfortably bounded.
    expect(shellMeshes.length).toBeLessThanOrEqual(45);
    expect(shellMeshes.length).toBeGreaterThanOrEqual(25);
  });
});
