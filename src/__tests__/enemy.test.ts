import { describe, it, expect, beforeEach } from 'vitest';
import { createEnemy, damageEnemy, setEnemyState, isEnemyAlive, resetEnemyIdCounter, tickEnemyInvincibility, moveEnemy } from '../models/Enemy';

describe('Enemy', () => {
  beforeEach(() => resetEnemyIdCounter());

  /* ── Creation ── */
  it('creates GRUNT with correct stats', () => {
    const e = createEnemy('GRUNT', { x: 0, y: 0, z: 0 });
    expect(e.type).toBe('GRUNT');
    expect(e.health).toBe(50);
    expect(e.maxHealth).toBe(50);
    expect(e.state).toBe('idle');
    expect(e.speed).toBe(3.5);
    expect(e.damage).toBe(10);
    expect(e.points).toBe(100);
    expect(e.attackRange).toBe(2);
    expect(e.attackCooldown).toBe(1.5);
    expect(e.detectionRange).toBe(20);
  });

  it('creates FAST with correct stats', () => {
    const e = createEnemy('FAST', { x: 0, y: 0, z: 0 });
    expect(e.type).toBe('FAST');
    expect(e.health).toBe(30);
    expect(e.speed).toBe(7);
    expect(e.damage).toBe(5);
    expect(e.points).toBe(150);
  });

  it('creates TANK with correct stats', () => {
    const e = createEnemy('TANK', { x: 0, y: 0, z: 0 });
    expect(e.type).toBe('TANK');
    expect(e.health).toBe(150);
    expect(e.speed).toBe(2);
    expect(e.damage).toBe(25);
    expect(e.points).toBe(300);
  });

  it('assigns unique IDs', () => {
    const e1 = createEnemy('GRUNT', { x: 0, y: 0, z: 0 });
    const e2 = createEnemy('GRUNT', { x: 0, y: 0, z: 0 });
    expect(e1.id).not.toBe(e2.id);
  });

  it('creates at specified position', () => {
    const e = createEnemy('GRUNT', { x: 10, y: 2, z: -5 });
    expect(e.position.x).toBe(10);
    expect(e.position.y).toBe(2);
    expect(e.position.z).toBe(-5);
  });

  it('starts with zero velocity', () => {
    const e = createEnemy('GRUNT', { x: 0, y: 0, z: 0 });
    expect(e.velocity.x).toBe(0);
    expect(e.velocity.y).toBe(0);
    expect(e.velocity.z).toBe(0);
  });

  /* ── Damage ── */
  it('takes partial damage', () => {
    const e = createEnemy('GRUNT', { x: 0, y: 0, z: 0 });
    const d = damageEnemy(e, 20);
    expect(d.health).toBe(30);
    expect(d.state).toBe('idle');
  });

  it('takes exactly lethal damage', () => {
    const e = createEnemy('GRUNT', { x: 0, y: 0, z: 0 });
    const d = damageEnemy(e, 50);
    expect(d.health).toBe(0);
    expect(d.state).toBe('dead');
  });

  it('takes overkill damage', () => {
    const e = createEnemy('GRUNT', { x: 0, y: 0, z: 0 });
    const d = damageEnemy(e, 999);
    expect(d.health).toBe(0);
    expect(d.state).toBe('dead');
  });

  it('takes zero damage', () => {
    const e = createEnemy('GRUNT', { x: 0, y: 0, z: 0 });
    const d = damageEnemy(e, 0);
    expect(d.health).toBe(50);
    expect(d.state).toBe('idle');
  });

  it('does not take damage when dead', () => {
    const e = createEnemy('GRUNT', { x: 0, y: 0, z: 0 });
    const dead = damageEnemy(e, 100);
    const d = damageEnemy(dead, 50);
    expect(d.health).toBe(0);
    expect(d.state).toBe('dead');
  });

  it('TANK survives GRUNT-level damage', () => {
    const e = createEnemy('TANK', { x: 0, y: 0, z: 0 });
    const d = damageEnemy(e, 50);
    expect(d.health).toBe(100);
    expect(d.state).toBe('idle');
  });

  it('FAST dies quickly', () => {
    const e = createEnemy('FAST', { x: 0, y: 0, z: 0 });
    const d = damageEnemy(e, 30);
    expect(d.health).toBe(0);
    expect(d.state).toBe('dead');
  });

  /* ── State transitions ── */
  it('changes to chasing', () => {
    const e = createEnemy('GRUNT', { x: 0, y: 0, z: 0 });
    const c = setEnemyState(e, 'chasing');
    expect(c.state).toBe('chasing');
  });

  it('changes to attacking', () => {
    const e = createEnemy('GRUNT', { x: 0, y: 0, z: 0 });
    const c = setEnemyState(e, 'attacking');
    expect(c.state).toBe('attacking');
  });

  it('changes to idle', () => {
    const e = createEnemy('GRUNT', { x: 0, y: 0, z: 0 });
    const c = setEnemyState(setEnemyState(e, 'chasing'), 'idle');
    expect(c.state).toBe('idle');
  });

  it('does not change state when dead', () => {
    const e = createEnemy('GRUNT', { x: 0, y: 0, z: 0 });
    const dead = damageEnemy(e, 100);
    const c = setEnemyState(dead, 'chasing');
    expect(c.state).toBe('dead');
  });

  it('dead enemy stays dead through any state change', () => {
    const e = createEnemy('GRUNT', { x: 0, y: 0, z: 0 });
    const dead = damageEnemy(e, 100);
    const c = setEnemyState(dead, 'attacking');
    expect(c.state).toBe('dead');
  });

  /* ── isEnemyAlive ── */
  it('alive enemy returns true', () => {
    const e = createEnemy('GRUNT', { x: 0, y: 0, z: 0 });
    expect(isEnemyAlive(e)).toBe(true);
  });

  it('dead enemy returns false', () => {
    const e = createEnemy('GRUNT', { x: 0, y: 0, z: 0 });
    expect(isEnemyAlive(damageEnemy(e, 100))).toBe(false);
  });

  it('damaged but alive returns true', () => {
    const e = createEnemy('GRUNT', { x: 0, y: 0, z: 0 });
    expect(isEnemyAlive(damageEnemy(e, 40))).toBe(true);
  });

  /* ── Invincibility ── */
  it('damage sets brief invincibility', () => {
    const e = createEnemy('GRUNT', { x: 0, y: 0, z: 0 });
    const d = damageEnemy(e, 10);
    expect(d.invincibilityTimer).toBe(0.05);
  });

  it('invincibility ticks down', () => {
    let e = createEnemy('GRUNT', { x: 0, y: 0, z: 0 });
    e = damageEnemy(e, 10);
    e = tickEnemyInvincibility(e, 0.03);
    expect(e.invincibilityTimer).toBeCloseTo(0.02, 5);
  });

  it('invincibility expires', () => {
    let e = createEnemy('GRUNT', { x: 0, y: 0, z: 0 });
    e = damageEnemy(e, 10);
    e = tickEnemyInvincibility(e, 0.1);
    expect(e.invincibilityTimer).toBe(0);
  });

  it('tick on non-invincible enemy is no-op', () => {
    const e = createEnemy('GRUNT', { x: 0, y: 0, z: 0 });
    const t = tickEnemyInvincibility(e, 10);
    expect(t).toBe(e);
  });

  /* ── Movement ── */
  it('moves to new position', () => {
    const e = createEnemy('GRUNT', { x: 0, y: 0, z: 0 });
    const m = moveEnemy(e, { x: 5, y: 0, z: 3 });
    expect(m.position.x).toBe(5);
    expect(m.position.z).toBe(3);
  });

  it('move preserves other properties', () => {
    const e = createEnemy('GRUNT', { x: 0, y: 0, z: 0 });
    const m = moveEnemy(e, { x: 5, y: 0, z: 3 });
    expect(m.health).toBe(e.health);
    expect(m.state).toBe(e.state);
    expect(m.type).toBe(e.type);
  });

  /* ── ID counter reset ── */
  it('resetEnemyIdCounter restarts IDs', () => {
    createEnemy('GRUNT', { x: 0, y: 0, z: 0 });
    resetEnemyIdCounter();
    const e2 = createEnemy('GRUNT', { x: 0, y: 0, z: 0 });
    expect(e2.id).toBe('enemy_1');
  });
});
