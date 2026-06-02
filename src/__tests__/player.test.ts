import { describe, it, expect } from 'vitest';
import { createPlayer, damagePlayer, healPlayer, tickInvincibility, addWeapon, switchWeapon, addPowerUp, tickPowerUps, respawnPlayer, getSpeedMultiplier } from '../models/Player';

describe('Player', () => {
  it('creates with full health', () => {
    const p = createPlayer();
    expect(p.health).toBe(100);
    expect(p.maxHealth).toBe(100);
    expect(p.isAlive).toBe(true);
  });

  it('takes damage correctly', () => {
    const p = createPlayer();
    const d = damagePlayer(p, 30);
    expect(d.health).toBe(70);
    expect(d.isAlive).toBe(true);
    expect(d.isInvincible).toBe(true);
  });

  it('dies at zero health', () => {
    const p = createPlayer();
    const d = damagePlayer(p, 100);
    expect(d.health).toBe(0);
    expect(d.isAlive).toBe(false);
  });

  it('does not take damage when invincible', () => {
    let p = createPlayer();
    p = damagePlayer(p, 10);
    expect(p.isInvincible).toBe(true);
    const d = damagePlayer(p, 50);
    expect(d.health).toBe(90);
  });

  it('heals correctly', () => {
    let p = createPlayer();
    p = damagePlayer(p, 50);
    p = healPlayer(p, 20);
    expect(p.health).toBe(70);
  });

  it('does not heal above max', () => {
    const p = createPlayer();
    const h = healPlayer(p, 50);
    expect(h.health).toBe(100);
  });

  it('invincibility expires', () => {
    let p = createPlayer();
    p = damagePlayer(p, 10);
    p = tickInvincibility(p, 0.6);
    expect(p.isInvincible).toBe(false);
  });

  it('adds and switches weapons', () => {
    let p = createPlayer();
    p = addWeapon(p, 'RIFLE');
    expect(p.ownedWeapons).toContain('RIFLE');
    p = switchWeapon(p, 'RIFLE');
    expect(p.currentWeapon).toBe('RIFLE');
  });

  it('does not switch to unowned weapon', () => {
    const p = createPlayer();
    const s = switchWeapon(p, 'SHOTGUN');
    expect(s.currentWeapon).toBe('PISTOL');
  });

  it('adds and ticks power-ups', () => {
    let p = createPlayer();
    p = addPowerUp(p, 'speedBoost', 1.5, 5);
    expect(p.activePowerUps.length).toBe(1);
    expect(getSpeedMultiplier(p)).toBe(1.5);
    p = tickPowerUps(p, 6);
    expect(p.activePowerUps.length).toBe(0);
    expect(getSpeedMultiplier(p)).toBe(1);
  });

  it('respawns correctly', () => {
    let p = createPlayer();
    p = damagePlayer(p, 100);
    p = addWeapon(p, 'RIFLE');
    p = switchWeapon(p, 'RIFLE');
    const r = respawnPlayer(p);
    expect(r.health).toBe(100);
    expect(r.isAlive).toBe(true);
    expect(r.ownedWeapons).toContain('RIFLE');
    expect(r.currentWeapon).toBe('RIFLE');
  });
});
