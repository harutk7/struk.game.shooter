import { describe, it, expect, beforeEach } from 'vitest';
import { createEnemy, damageEnemy, setEnemyState, isEnemyAlive, resetEnemyIdCounter } from '../models/Enemy';

describe('Enemy', () => {
  beforeEach(() => resetEnemyIdCounter());

  it('creates with correct stats', () => {
    const e = createEnemy('GRUNT', { x: 0, y: 0, z: 0 });
    expect(e.health).toBe(50);
    expect(e.maxHealth).toBe(50);
    expect(e.state).toBe('idle');
    expect(e.type).toBe('GRUNT');
  });

  it('takes damage and dies', () => {
    const e = createEnemy('GRUNT', { x: 0, y: 0, z: 0 });
    const d = damageEnemy(e, 50);
    expect(d.health).toBe(0);
    expect(d.state).toBe('dead');
  });

  it('does not take damage when dead', () => {
    const e = createEnemy('GRUNT', { x: 0, y: 0, z: 0 });
    const dead = damageEnemy(e, 100);
    const d = damageEnemy(dead, 50);
    expect(d.health).toBe(0);
  });

  it('changes state', () => {
    const e = createEnemy('GRUNT', { x: 0, y: 0, z: 0 });
    const c = setEnemyState(e, 'chasing');
    expect(c.state).toBe('chasing');
  });

  it('does not change state when dead', () => {
    const e = createEnemy('GRUNT', { x: 0, y: 0, z: 0 });
    const dead = damageEnemy(e, 100);
    const c = setEnemyState(dead, 'chasing');
    expect(c.state).toBe('dead');
  });

  it('isEnemyAlive works', () => {
    const e = createEnemy('GRUNT', { x: 0, y: 0, z: 0 });
    expect(isEnemyAlive(e)).toBe(true);
    expect(isEnemyAlive(damageEnemy(e, 100))).toBe(false);
  });

  it('TANK has more health', () => {
    const e = createEnemy('TANK', { x: 0, y: 0, z: 0 });
    expect(e.health).toBe(150);
    expect(e.points).toBe(300);
  });

  it('FAST has higher speed', () => {
    const e = createEnemy('FAST', { x: 0, y: 0, z: 0 });
    expect(e.speed).toBe(7);
  });
});
