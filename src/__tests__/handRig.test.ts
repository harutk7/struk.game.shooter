import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { PlayerBodyRenderer } from '../rendering/PlayerBodyRenderer';

/**
 * T6 — procedural hand rig. These tests exercise the rig headlessly:
 * Three.js builds geometry/groups in pure JS (no WebGL needed), so we can
 * instantiate the body, inspect the named finger hierarchy, and tick the
 * animation to confirm the trigger finger reacts to recoil.
 */

const FINGER_PARTS = [
  'palm',
  'index_proximal', 'index_distal',
  'middle_proximal', 'middle_distal',
  'ring_proximal', 'ring_distal',
  'pinky_proximal', 'pinky_distal',
  'thumb',
];

/** Collect the two arm groups (children of the body root). */
function getArms(body: PlayerBodyRenderer): THREE.Object3D[] {
  const arms: THREE.Object3D[] = [];
  // The wrists are the unambiguous markers of a hand; find their arm ancestors.
  body.root.traverse((o) => {
    if (o.name === 'wrist') arms.push(o);
  });
  return arms;
}

describe('PlayerBodyRenderer hand rig', () => {
  it('builds two hands', () => {
    const body = new PlayerBodyRenderer();
    expect(getArms(body).length).toBe(2);
    body.dispose();
  });

  it('each hand has all named finger parts (5 digits per hand)', () => {
    const body = new PlayerBodyRenderer();
    const hands = getArms(body);
    for (const hand of hands) {
      for (const part of FINGER_PARTS) {
        expect(hand.getObjectByName(part), `missing "${part}"`).toBeTruthy();
      }
    }
    body.dispose();
  });

  it('curls the trigger finger in response to recoil', () => {
    const body = new PlayerBodyRenderer();
    // Tick once at rest to establish the idle pose.
    body.tick({ dt: 0.016, isMoving: false, isCrouching: false, isSprinting: false, walkPhase: 0 });
    const hands = getArms(body);
    const idxBefore = hands.map((h) => (h.getObjectByName('index_proximal') as THREE.Object3D).rotation.x);

    body.addRecoil('ak', 1.0, 0);
    body.tick({ dt: 0.016, isMoving: false, isCrouching: false, isSprinting: false, walkPhase: 0 });

    for (let i = 0; i < hands.length; i++) {
      const idx = hands[i].getObjectByName('index_proximal') as THREE.Object3D;
      // Non-zero rotation proves the finger is being driven procedurally …
      expect(idx.rotation.x).not.toBe(0);
      // … and recoil straightens it (curl magnitude drops vs idle).
      expect(Math.abs(idx.rotation.x)).toBeLessThan(Math.abs(idxBefore[i]));
    }
    body.dispose();
  });

  it('subtly tracks camera look (wrist rotates when the view turns)', () => {
    const body = new PlayerBodyRenderer();
    const wrist = getArms(body)[0] as THREE.Object3D;
    body.tick({ dt: 0.016, isMoving: false, isCrouching: false, isSprinting: false, walkPhase: 0, cameraYaw: 0, cameraPitch: 0 });
    const restY = wrist.rotation.y;
    // Swing the view fast — wrist should pick up a follow offset.
    for (let i = 0; i < 5; i++) {
      body.tick({ dt: 0.016, isMoving: false, isCrouching: false, isSprinting: false, walkPhase: 0, cameraYaw: 0.4 * (i + 1), cameraPitch: 0 });
    }
    expect(wrist.rotation.y).not.toBe(restY);
    body.dispose();
  });
});
