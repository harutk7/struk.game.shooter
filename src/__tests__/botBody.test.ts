import { describe, it, expect } from 'vitest';
import { BotBody } from '../rendering/BotBodyRenderer';

/**
 * T18 — procedural humanoid bot body. These run in vitest's node env (no DOM);
 * BotBody is intentionally DOM-free so it imports the real `three` cleanly.
 */
describe('BotBody', () => {
  const LIMBS = ['head', 'torso', 'leftArm', 'rightArm', 'leftLeg', 'rightLeg'];

  it('is visibly humanoid: exposes all six named limb groups', () => {
    const body = new BotBody({ color: 0x6b7a3a });
    for (const name of LIMBS) {
      expect(body.group.getObjectByName(name), `missing limb "${name}"`).toBeDefined();
    }
    body.dispose();
  });

  it('swings legs in opposite phase while walking (distance-driven)', () => {
    const body = new BotBody({ color: 0x6b7a3a });
    // 0.5m travelled = a quarter stride (stride = 2m) → phase = π/2 → max swing.
    body.tick({ dt: 0.016, isMoving: true, distanceTraveled: 0.5 });
    expect(body.leftLeg.rotation.x).toBeGreaterThan(0.1);
    expect(body.rightLeg.rotation.x).toBeLessThan(-0.1);
    // Arms counter-swing the legs.
    expect(Math.sign(body.leftArm.rotation.x)).toBe(-Math.sign(body.leftLeg.rotation.x));
    body.dispose();
  });

  it('breathes while idle: torso scale.y stays within 0.98 .. 1.02', () => {
    const body = new BotBody({ color: 0x6b7a3a });
    // Advance to the breathing peak (0.3 Hz → quarter-cycle at ~0.833s).
    body.tick({ dt: 0.8333, isMoving: false, distanceTraveled: 0 });
    expect(body.torso.scale.y).toBeGreaterThan(1.0);
    expect(body.torso.scale.y).toBeLessThanOrEqual(1.02 + 1e-6);
    expect(body.torso.scale.y).toBeGreaterThanOrEqual(0.98 - 1e-6);
    body.dispose();
  });

  it('plays a death ragdoll then fades: opacity < 1 after setAlive(false) + 700ms', () => {
    const body = new BotBody({ color: 0x6b7a3a });
    expect(body.material.opacity).toBe(1);

    body.setAlive(false);
    body.tick({ dt: 0.7, isMoving: false, distanceTraveled: 0 });

    // Ragdoll (600ms) has completed → body has leaned forward.
    expect(body.group.rotation.x).toBeGreaterThan(1.0);
    // 100ms into the 400ms fade → partially transparent.
    expect(body.material.opacity).toBeLessThan(1.0);
    expect(body.isDeathComplete()).toBe(false);

    // Finish the fade.
    body.tick({ dt: 0.4, isMoving: false, distanceTraveled: 0 });
    expect(body.material.opacity).toBeLessThanOrEqual(0);
    expect(body.isDeathComplete()).toBe(true);
    body.dispose();
  });

  it('resets pose and opacity on respawn (setAlive(true))', () => {
    const body = new BotBody({ color: 0x6b7a3a });
    body.setAlive(false);
    body.tick({ dt: 1.1, isMoving: false, distanceTraveled: 0 });
    expect(body.isDeathComplete()).toBe(true);

    body.setAlive(true);
    expect(body.material.opacity).toBe(1);
    expect(body.group.rotation.x).toBe(0);
    body.dispose();
  });
});
