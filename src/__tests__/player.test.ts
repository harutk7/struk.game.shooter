import { describe, it, expect } from 'vitest';
import {
  createPlayer, damagePlayer, healPlayer, tickInvincibility,
  addWeapon, switchWeapon, addPowerUp, tickPowerUps,
  respawnPlayer, getDamageMultiplier, getSpeedMultiplier,
} from '../models/Player';

describe('Player', () => {
  /* ── Creation ── */
  it('creates with full health', () => {
    const p = createPlayer();
    expect(p.health).toBe(100);
    expect(p.maxHealth).toBe(100);
    expect(p.isAlive).toBe(true);
    expect(p.isInvincible).toBe(false);
    expect(p.isGrounded).toBe(true);
  });

  it('starts with PISTOL only', () => {
    const p = createPlayer();
    expect(p.currentWeapon).toBe('PISTOL');
    expect(p.ownedWeapons).toEqual(['PISTOL']);
  });

  it('starts at correct position', () => {
    const p = createPlayer();
    expect(p.position.x).toBe(0);
    expect(p.position.z).toBe(5);
    expect(p.position.y).toBe(1.7);
  });

  it('starts with zero velocity', () => {
    const p = createPlayer();
    expect(p.velocity.x).toBe(0);
    expect(p.velocity.y).toBe(0);
    expect(p.velocity.z).toBe(0);
  });

  it('starts with no active power-ups', () => {
    const p = createPlayer();
    expect(p.activePowerUps).toEqual([]);
  });

  /* ── Damage ── */
  it('takes damage correctly', () => {
    const p = createPlayer();
    const d = damagePlayer(p, 30);
    expect(d.health).toBe(70);
    expect(d.isAlive).toBe(true);
    expect(d.isInvincible).toBe(true);
  });

  it('takes exactly lethal damage', () => {
    const p = createPlayer();
    const d = damagePlayer(p, 100);
    expect(d.health).toBe(0);
    expect(d.isAlive).toBe(false);
  });

  it('takes overkill damage', () => {
    const p = createPlayer();
    const d = damagePlayer(p, 999);
    expect(d.health).toBe(0);
    expect(d.isAlive).toBe(false);
  });

  it('takes zero damage', () => {
    const p = createPlayer();
    const d = damagePlayer(p, 0);
    expect(d.health).toBe(100);
    expect(d.isAlive).toBe(true);
    expect(d.isInvincible).toBe(false);
  });

  it('takes negative damage (no effect)', () => {
    const p = createPlayer();
    const d = damagePlayer(p, -10);
    expect(d.health).toBe(100);
  });

  it('does not take damage when dead', () => {
    let p = createPlayer();
    p = damagePlayer(p, 100);
    const d = damagePlayer(p, 50);
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

  it('invincibility has correct duration', () => {
    let p = createPlayer();
    p = damagePlayer(p, 10);
    expect(p.invincibilityTimer).toBe(0.5);
  });

  it('does not become invincible on lethal hit', () => {
    const p = createPlayer();
    const d = damagePlayer(p, 100);
    expect(d.isInvincible).toBe(false);
  });

  /* ── Healing ── */
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

  it('heals exactly to max', () => {
    let p = createPlayer();
    p = damagePlayer(p, 30);
    p = healPlayer(p, 30);
    expect(p.health).toBe(100);
  });

  it('does not heal dead player', () => {
    let p = createPlayer();
    p = damagePlayer(p, 100);
    const h = healPlayer(p, 50);
    expect(h.health).toBe(0);
    expect(h.isAlive).toBe(false);
  });

  it('heal with zero does nothing', () => {
    let p = createPlayer();
    p = damagePlayer(p, 30);
    p = healPlayer(p, 0);
    expect(p.health).toBe(70);
  });

  /* ── Invincibility tick ── */
  it('invincibility ticks down', () => {
    let p = createPlayer();
    p = damagePlayer(p, 10);
    p = tickInvincibility(p, 0.3);
    expect(p.invincibilityTimer).toBeCloseTo(0.2, 5);
    expect(p.isInvincible).toBe(true);
  });

  it('invincibility expires', () => {
    let p = createPlayer();
    p = damagePlayer(p, 10);
    p = tickInvincibility(p, 0.6);
    expect(p.isInvincible).toBe(false);
    expect(p.invincibilityTimer).toBe(0);
  });

  it('invincibility expires exactly at threshold', () => {
    let p = createPlayer();
    p = damagePlayer(p, 10);
    p = tickInvincibility(p, 0.5);
    expect(p.isInvincible).toBe(false);
  });

  it('tick on non-invincible player is no-op', () => {
    const p = createPlayer();
    const t = tickInvincibility(p, 10);
    expect(t).toBe(p);
  });

  /* ── Weapons ── */
  it('adds a new weapon', () => {
    let p = createPlayer();
    p = addWeapon(p, 'RIFLE');
    expect(p.ownedWeapons).toContain('RIFLE');
    expect(p.ownedWeapons).toHaveLength(2);
  });

  it('does not add duplicate weapon', () => {
    let p = createPlayer();
    p = addWeapon(p, 'PISTOL');
    expect(p.ownedWeapons).toHaveLength(1);
  });

  it('switches to owned weapon', () => {
    let p = createPlayer();
    p = addWeapon(p, 'RIFLE');
    p = switchWeapon(p, 'RIFLE');
    expect(p.currentWeapon).toBe('RIFLE');
  });

  it('does not switch to unowned weapon', () => {
    const p = createPlayer();
    const s = switchWeapon(p, 'SHOTGUN');
    expect(s.currentWeapon).toBe('PISTOL');
  });

  it('switching to current weapon is no-op', () => {
    const p = createPlayer();
    const s = switchWeapon(p, 'PISTOL');
    expect(s).toBe(p);
  });

  /* ── Power-ups ── */
  it('adds power-up', () => {
    let p = createPlayer();
    p = addPowerUp(p, 'speedBoost', 1.5, 5);
    expect(p.activePowerUps).toHaveLength(1);
    expect(p.activePowerUps[0].type).toBe('speedBoost');
    expect(p.activePowerUps[0].multiplier).toBe(1.5);
    expect(p.activePowerUps[0].remainingTime).toBe(5);
  });

  it('replaces same-type power-up', () => {
    let p = createPlayer();
    p = addPowerUp(p, 'speedBoost', 1.5, 5);
    p = addPowerUp(p, 'speedBoost', 2.0, 3);
    expect(p.activePowerUps).toHaveLength(1);
    expect(p.activePowerUps[0].multiplier).toBe(2.0);
    expect(p.activePowerUps[0].remainingTime).toBe(3);
  });

  it('stacks different-type power-ups', () => {
    let p = createPlayer();
    p = addPowerUp(p, 'speedBoost', 1.5, 5);
    p = addPowerUp(p, 'damageBoost', 2.0, 5);
    expect(p.activePowerUps).toHaveLength(2);
  });

  it('power-ups tick down', () => {
    let p = createPlayer();
    p = addPowerUp(p, 'speedBoost', 1.5, 5);
    p = tickPowerUps(p, 2);
    expect(p.activePowerUps[0].remainingTime).toBe(3);
  });

  it('power-ups expire', () => {
    let p = createPlayer();
    p = addPowerUp(p, 'speedBoost', 1.5, 5);
    p = tickPowerUps(p, 6);
    expect(p.activePowerUps).toHaveLength(0);
  });

  it('getSpeedMultiplier returns 1 with no boost', () => {
    const p = createPlayer();
    expect(getSpeedMultiplier(p)).toBe(1);
  });

  it('getSpeedMultiplier returns boost value', () => {
    let p = createPlayer();
    p = addPowerUp(p, 'speedBoost', 1.5, 5);
    expect(getSpeedMultiplier(p)).toBe(1.5);
  });

  it('getDamageMultiplier returns 1 with no boost', () => {
    const p = createPlayer();
    expect(getDamageMultiplier(p)).toBe(1);
  });

  it('getDamageMultiplier returns boost value', () => {
    let p = createPlayer();
    p = addPowerUp(p, 'damageBoost', 2.0, 5);
    expect(getDamageMultiplier(p)).toBe(2);
  });

  /* ── Respawn ── */
  it('respawns with full health', () => {
    let p = createPlayer();
    p = damagePlayer(p, 100);
    const r = respawnPlayer(p);
    expect(r.health).toBe(100);
    expect(r.isAlive).toBe(true);
    expect(r.isInvincible).toBe(false);
  });

  it('respawn preserves weapons', () => {
    let p = createPlayer();
    p = addWeapon(p, 'RIFLE');
    p = switchWeapon(p, 'RIFLE');
    p = damagePlayer(p, 100);
    const r = respawnPlayer(p);
    expect(r.ownedWeapons).toContain('RIFLE');
    expect(r.currentWeapon).toBe('RIFLE');
  });

  it('respawn clears power-ups', () => {
    let p = createPlayer();
    p = addPowerUp(p, 'speedBoost', 1.5, 5);
    p = damagePlayer(p, 100);
    const r = respawnPlayer(p);
    expect(r.activePowerUps).toHaveLength(0);
  });

  it('respawn resets position', () => {
    let p = createPlayer();
    p = { ...p, position: { x: 20, y: 10, z: 20 } };
    p = damagePlayer(p, 100);
    const r = respawnPlayer(p);
    expect(r.position.x).toBe(0);
    expect(r.position.z).toBe(5);
  });

  /* ── Edge cases ── */
  it('multiple damage hits accumulate', () => {
    let p = createPlayer();
    p = damagePlayer(p, 10);
    p = tickInvincibility(p, 0.6);
    p = damagePlayer(p, 10);
    p = tickInvincibility(p, 0.6);
    p = damagePlayer(p, 10);
    expect(p.health).toBe(70);
  });

  it('rapid damage during invincibility is ignored', () => {
    let p = createPlayer();
    p = damagePlayer(p, 10);
    p = damagePlayer(p, 10);
    p = damagePlayer(p, 10);
    expect(p.health).toBe(90);
  });

  it('heal after multiple damage hits', () => {
    let p = createPlayer();
    p = damagePlayer(p, 10);
    p = tickInvincibility(p, 0.6);
    p = damagePlayer(p, 10);
    p = tickInvincibility(p, 0.6);
    p = healPlayer(p, 15);
    expect(p.health).toBe(95);
  });
});
