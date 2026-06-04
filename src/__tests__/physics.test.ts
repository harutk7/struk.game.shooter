import { describe, it, expect } from 'vitest';
import { PhysicsSystem } from '../systems/PhysicsSystem';
import { createPlayer } from '../models/Player';
import { createEnemy } from '../models/Enemy';

const emptySnap = { moveX: 0, moveY: 0, sprint: false, jump: false, shoot: false, reload: false, weaponSwitch: 0, lookX: 0, lookY: 0, pointerLocked: true, pause: false };

describe('PhysicsSystem', () => {
  /* ── Arena clamping ── */
  it('clamps player to arena bounds', () => {
    const phys = new PhysicsSystem();
    let p = createPlayer();
    p = { ...p, position: { x: 100, y: 1.7, z: 100 } };
    const r = phys.updatePlayer(p, emptySnap, 0.016, 0);
    expect(Math.abs(r.position.x)).toBeLessThanOrEqual(25);
    expect(Math.abs(r.position.z)).toBeLessThanOrEqual(25);
  });

  it('clamps negative overflow', () => {
    const phys = new PhysicsSystem();
    let p = createPlayer();
    p = { ...p, position: { x: -100, y: 1.7, z: -100 } };
    const r = phys.updatePlayer(p, emptySnap, 0.016, 0);
    expect(r.position.x).toBeGreaterThanOrEqual(-25);
    expect(r.position.z).toBeGreaterThanOrEqual(-25);
  });

  it('does not clamp within bounds', () => {
    const phys = new PhysicsSystem();
    const p = createPlayer();
    const r = phys.updatePlayer(p, emptySnap, 0.016, 0);
    expect(r.position.x).toBe(0);
    expect(r.position.z).toBe(5);
  });

  /* ── Gravity ── */
  it('applies gravity when not grounded', () => {
    const phys = new PhysicsSystem();
    let p = createPlayer();
    p = { ...p, isGrounded: false, velocity: { x: 0, y: 0, z: 0 }, position: { x: 0, y: 10, z: 0 } };
    const r = phys.updatePlayer(p, emptySnap, 0.1, 0);
    expect(r.velocity.y).toBeLessThan(0);
  });

  it('does not apply gravity when grounded', () => {
    const phys = new PhysicsSystem();
    const p = createPlayer();
    const r = phys.updatePlayer(p, emptySnap, 0.1, 0);
    expect(r.velocity.y).toBe(0);
  });

  it('ground clamps at player height', () => {
    const phys = new PhysicsSystem();
    let p = createPlayer();
    p = { ...p, isGrounded: false, velocity: { x: 0, y: -50, z: 0 }, position: { x: 0, y: 2, z: 0 } };
    const r = phys.updatePlayer(p, emptySnap, 0.1, 0);
    expect(r.position.y).toBe(1.7);
    expect(r.isGrounded).toBe(true);
    expect(r.velocity.y).toBe(0);
  });

  /* ── Jump ── */
  it('jump applies upward velocity', () => {
    const phys = new PhysicsSystem();
    const p = createPlayer();
    const snap = { ...emptySnap, jump: true };
    const r = phys.updatePlayer(p, snap, 0.016, 0);
    expect(r.velocity.y).toBe(10);
    expect(r.isGrounded).toBe(false);
  });

  it('cannot jump when not grounded', () => {
    const phys = new PhysicsSystem();
    let p = createPlayer();
    p = { ...p, isGrounded: false, velocity: { x: 0, y: 5, z: 0 } };
    const snap = { ...emptySnap, jump: true };
    const r = phys.updatePlayer(p, snap, 0.016, 0);
    // Gravity still applies, velocity decreases
    expect(r.velocity.y).toBeLessThan(5);
  });

  /* ── Movement (camera-relative) ── */
  it('moves forward (W) at yaw=0', () => {
    const phys = new PhysicsSystem();
    const p = createPlayer();
    const snap = { ...emptySnap, moveY: 1 };
    const r = phys.updatePlayer(p, snap, 1, 0);
    expect(r.position.z).toBeLessThan(5);
  });

  it('moves right (D) at yaw=0', () => {
    const phys = new PhysicsSystem();
    const p = createPlayer();
    const snap = { ...emptySnap, moveX: 1 };
    const r = phys.updatePlayer(p, snap, 1, 0);
    expect(r.position.x).toBeGreaterThan(0);
  });

  it('moves forward at yaw=-PI/2 (looking right)', () => {
    const phys = new PhysicsSystem();
    const p = createPlayer();
    const snap = { ...emptySnap, moveY: 1 };
    const r = phys.updatePlayer(p, snap, 1, -Math.PI / 2);
    expect(r.position.x).toBeGreaterThan(0);
  });

  it('moves backward at yaw=PI', () => {
    const phys = new PhysicsSystem();
    const p = createPlayer();
    const snap = { ...emptySnap, moveY: -1 };
    const r = phys.updatePlayer(p, snap, 1, Math.PI);
    expect(r.position.z).toBeLessThan(5);
  });

  it('sprint increases speed', () => {
    const phys = new PhysicsSystem();
    const p = createPlayer();
    const normal = phys.updatePlayer(p, { ...emptySnap, moveY: 1 }, 1, 0);
    const sprint = phys.updatePlayer(p, { ...emptySnap, moveY: 1, sprint: true }, 1, 0);
    const normalDist = Math.abs(normal.position.z - 5);
    const sprintDist = Math.abs(sprint.position.z - 5);
    expect(sprintDist).toBeGreaterThan(normalDist);
  });

  /* ── Collision ── */
  it('detects collision with obstacle', () => {
    const phys = new PhysicsSystem();
    phys.setColliders([{ minX: -1, minZ: -1, maxX: 1, maxZ: 1 }]);
    expect(phys.collidesWithWorld(0, 0, 0.3)).toBe(true);
  });

  it('no collision away from obstacle', () => {
    const phys = new PhysicsSystem();
    phys.setColliders([{ minX: -1, minZ: -1, maxX: 1, maxZ: 1 }]);
    expect(phys.collidesWithWorld(5, 5, 0.3)).toBe(false);
  });

  it('collision at edge of obstacle', () => {
    const phys = new PhysicsSystem();
    phys.setColliders([{ minX: -1, minZ: -1, maxX: 1, maxZ: 1 }]);
    expect(phys.collidesWithWorld(1.2, 0, 0.3)).toBe(true);
    expect(phys.collidesWithWorld(1.4, 0, 0.3)).toBe(false);
  });

  it('collision with arena boundary', () => {
    const phys = new PhysicsSystem();
    // arenaHalfWidth = 24, so boundary at x=24 with radius 0.3
    expect(phys.collidesWithWorld(23.8, 0, 0.3)).toBe(true);
    expect(phys.collidesWithWorld(23.5, 0, 0.3)).toBe(false);
  });

  /* ── Spawn positions ── */
  it('spawns at minimum distance from player', () => {
    const phys = new PhysicsSystem();
    const pos = phys.getSpawnPosition(10, { x: 0, z: 0 });
    const dist = Math.sqrt(pos.x * pos.x + pos.z * pos.z);
    expect(dist).toBeGreaterThanOrEqual(10);
  });

  it('spawns within arena bounds', () => {
    const phys = new PhysicsSystem();
    for (let i = 0; i < 20; i++) {
      const pos = phys.getSpawnPosition(10, { x: 0, z: 0 });
      expect(Math.abs(pos.x)).toBeLessThanOrEqual(24);
      expect(Math.abs(pos.z)).toBeLessThanOrEqual(24);
    }
  });

  /* ── Enemy movement ── */
  it('enemy moves toward target', () => {
    const phys = new PhysicsSystem();
    const enemy = { ...createEnemy('GRUNT', { x: 0, y: 0, z: 0 }), state: 'chasing' as const };
    const target = { x: 10, y: 0, z: 0 };
    const moved = phys.updateEnemy(enemy, target, 1);
    expect(moved.position.x).toBeGreaterThan(0);
  });

  it('enemy does not move when dead', () => {
    const phys = new PhysicsSystem();
    const enemy = { ...createEnemy('GRUNT', { x: 0, y: 0, z: 0 }), state: 'dead' as const };
    const target = { x: 10, y: 0, z: 0 };
    const moved = phys.updateEnemy(enemy, target, 1);
    expect(moved.position.x).toBe(0);
  });

  it('enemy at target does not overshoot', () => {
    const phys = new PhysicsSystem();
    const enemy = createEnemy('GRUNT', { x: 0, y: 0, z: 0 });
    const target = { x: 0.001, y: 0, z: 0 };
    const moved = phys.updateEnemy(enemy, target, 1);
    expect(moved.position.x).toBeCloseTo(0, 2);
  });

  /* ── Distance helpers ── */
  it('distance calculates 3D distance', () => {
    const d = PhysicsSystem.distance({ x: 0, y: 0, z: 0 }, { x: 3, y: 4, z: 0 });
    expect(d).toBe(5);
  });

  it('distance with all components', () => {
    const d = PhysicsSystem.distance({ x: 1, y: 2, z: 3 }, { x: 4, y: 6, z: 3 });
    expect(d).toBe(5);
  });

  it('distance same point is zero', () => {
    const d = PhysicsSystem.distance({ x: 1, y: 2, z: 3 }, { x: 1, y: 2, z: 3 });
    expect(d).toBe(0);
  });

  it('horizontalDistance ignores Y', () => {
    const d = PhysicsSystem.horizontalDistance({ x: 3, z: 4 }, { x: 0, z: 0 });
    expect(d).toBe(5);
  });

  it('horizontalDistance same point is zero', () => {
    const d = PhysicsSystem.horizontalDistance({ x: 3, z: 4 }, { x: 3, z: 4 });
    expect(d).toBe(0);
  });
});
