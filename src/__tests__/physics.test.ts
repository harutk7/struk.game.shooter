import { describe, it, expect } from 'vitest';
import { PhysicsSystem } from '../systems/PhysicsSystem';
import { createPlayer } from '../models/Player';
import { createEnemy } from '../models/Enemy';

describe('PhysicsSystem', () => {
  it('clamps player to arena', () => {
    const phys = new PhysicsSystem();
    let p = createPlayer();
    p = { ...p, position: { x: 100, y: 1.7, z: 100 } };
    const snap = { moveX: 0, moveY: 0, sprint: false, jump: false, shoot: false, reload: false, weaponSwitch: 0, lookX: 0, lookY: 0, pointerLocked: true, pause: false };
    const r = phys.updatePlayer(p, snap, 0.016);
    expect(Math.abs(r.position.x)).toBeLessThanOrEqual(25);
    expect(Math.abs(r.position.z)).toBeLessThanOrEqual(25);
  });

  it('applies gravity', () => {
    const phys = new PhysicsSystem();
    let p = createPlayer();
    p = { ...p, isGrounded: false, velocity: { x: 0, y: 0, z: 0 }, position: { x: 0, y: 10, z: 0 } };
    const snap = { moveX: 0, moveY: 0, sprint: false, jump: false, shoot: false, reload: false, weaponSwitch: 0, lookX: 0, lookY: 0, pointerLocked: true, pause: false };
    const r = phys.updatePlayer(p, snap, 0.1);
    expect(r.velocity.y).toBeLessThan(0);
  });

  it('detects collision with obstacles', () => {
    const phys = new PhysicsSystem();
    phys.setColliders([{ minX: -1, minZ: -1, maxX: 1, maxZ: 1 }]);
    expect(phys.collidesWithWorld(0, 0, 0.3)).toBe(true);
    expect(phys.collidesWithWorld(5, 5, 0.3)).toBe(false);
  });

  it('generates spawn positions away from player', () => {
    const phys = new PhysicsSystem();
    const pos = phys.getSpawnPosition(10, { x: 0, z: 0 });
    const dist = Math.sqrt(pos.x * pos.x + pos.z * pos.z);
    expect(dist).toBeGreaterThanOrEqual(10);
  });

  it('distance calculation works', () => {
    const d = PhysicsSystem.distance({ x: 0, y: 0, z: 0 }, { x: 3, y: 4, z: 0 });
    expect(d).toBe(5);
  });

  it('horizontal distance ignores Y', () => {
    const d = PhysicsSystem.horizontalDistance({ x: 3, z: 4 }, { x: 0, z: 0 });
    expect(d).toBe(5);
  });

  it('moves enemy toward target', () => {
    const phys = new PhysicsSystem();
    const enemy = createEnemy('GRUNT', { x: 0, y: 0, z: 0 });
    const target = { x: 10, y: 0, z: 0 };
    const moved = phys.updateEnemy(enemy, target, 1);
    expect(moved.position.x).toBeGreaterThan(0);
  });
});
