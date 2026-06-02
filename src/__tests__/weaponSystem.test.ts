import { describe, it, expect } from 'vitest';
import { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/GameEvents';
import { WeaponSystem } from '../systems/WeaponSystem';
import { createPlayer } from '../models/Player';

describe('WeaponSystem', () => {
  it('initializes weapons', () => {
    const bus = new EventBus<GameEvents>();
    const ws = new WeaponSystem(bus);
    ws.initWeapons(['PISTOL', 'RIFLE']);
    expect(ws.getWeapon('PISTOL')).toBeDefined();
    expect(ws.getWeapon('RIFLE')).toBeDefined();
  });

  it('fires weapon', () => {
    const bus = new EventBus<GameEvents>();
    const ws = new WeaponSystem(bus);
    ws.initWeapons(['PISTOL']);
    const player = createPlayer();
    const result = ws.tryFire(player, 1000);
    expect(result).not.toBeNull();
    expect(result!.fired).toBe(true);
    expect(result!.damage).toBe(25);
  });

  it('switches weapons', () => {
    const bus = new EventBus<GameEvents>();
    const ws = new WeaponSystem(bus);
    ws.initWeapons(['PISTOL', 'RIFLE']);
    let player = createPlayer();
    player = { ...player, ownedWeapons: ['PISTOL', 'RIFLE'] };
    const switched = ws.switchWeapon(player, 1);
    expect(switched.currentWeapon).toBe('RIFLE');
  });

  it('reloads weapon', () => {
    const bus = new EventBus<GameEvents>();
    const ws = new WeaponSystem(bus);
    ws.initWeapons(['PISTOL']);
    const player = createPlayer();
    ws.tryFire(player, 1000);
    ws.tryFire(player, 2000);
    const reloaded = ws.tryReload(player);
    expect(reloaded).toBe(true);
  });

  it('adds ammo', () => {
    const bus = new EventBus<GameEvents>();
    const ws = new WeaponSystem(bus);
    ws.initWeapons(['PISTOL']);
    ws.addAmmo('PISTOL', 20);
    const w = ws.getWeapon('PISTOL')!;
    expect(w.reserveAmmo).toBe(68);
  });

  it('adds new weapon type', () => {
    const bus = new EventBus<GameEvents>();
    const ws = new WeaponSystem(bus);
    ws.initWeapons(['PISTOL']);
    let player = createPlayer();
    player = ws.addWeaponType(player, 'RIFLE');
    expect(player.ownedWeapons).toContain('RIFLE');
    expect(ws.getWeapon('RIFLE')).toBeDefined();
  });
});
