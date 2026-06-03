import { describe, it, expect } from 'vitest';
import { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/GameEvents';
import { WeaponSystem } from '../systems/WeaponSystem';
import { createPlayer } from '../models/Player';

describe('WeaponSystem', () => {
  /* ── Initialization ── */
  it('initializes single weapon', () => {
    const bus = new EventBus<GameEvents>();
    const ws = new WeaponSystem(bus);
    ws.initWeapons(['PISTOL']);
    expect(ws.getWeapon('PISTOL')).toBeDefined();
  });

  it('initializes multiple weapons', () => {
    const bus = new EventBus<GameEvents>();
    const ws = new WeaponSystem(bus);
    ws.initWeapons(['PISTOL', 'RIFLE', 'SHOTGUN']);
    expect(ws.getWeapon('PISTOL')).toBeDefined();
    expect(ws.getWeapon('RIFLE')).toBeDefined();
    expect(ws.getWeapon('SHOTGUN')).toBeDefined();
  });

  it('getWeapon returns undefined for uninitialized', () => {
    const bus = new EventBus<GameEvents>();
    const ws = new WeaponSystem(bus);
    ws.initWeapons(['PISTOL']);
    expect(ws.getWeapon('RIFLE')).toBeUndefined();
  });

  it('getCurrentWeapon returns player weapon', () => {
    const bus = new EventBus<GameEvents>();
    const ws = new WeaponSystem(bus);
    ws.initWeapons(['PISTOL']);
    const player = createPlayer();
    const w = ws.getCurrentWeapon(player);
    expect(w).toBeDefined();
    expect(w!.type).toBe('PISTOL');
  });

  /* ── Firing ── */
  it('tryFire succeeds when ready', () => {
    const bus = new EventBus<GameEvents>();
    const ws = new WeaponSystem(bus);
    ws.initWeapons(['PISTOL']);
    const player = createPlayer();
    const result = ws.tryFire(player, 1.0);
    expect(result).not.toBeNull();
    expect(result!.fired).toBe(true);
    expect(result!.damage).toBe(25);
    expect(result!.spread).toBe(1);
    expect(result!.range).toBe(100);
    expect(result!.pellets).toBe(1);
  });

  it('tryFire consumes ammo', () => {
    const bus = new EventBus<GameEvents>();
    const ws = new WeaponSystem(bus);
    ws.initWeapons(['PISTOL']);
    const player = createPlayer();
    ws.tryFire(player, 1.0);
    const w = ws.getWeapon('PISTOL')!;
    expect(w.currentAmmo).toBe(11);
  });

  it('tryFire emits weaponFired event', () => {
    const bus = new EventBus<GameEvents>();
    const ws = new WeaponSystem(bus);
    ws.initWeapons(['PISTOL']);
    let fired = false;
    bus.on('weaponFired', (d) => {
      expect(d.weaponType).toBe('PISTOL');
      expect(d.ammo).toBe(11);
      fired = true;
    });
    ws.tryFire(createPlayer(), 1.0);
    expect(fired).toBe(true);
  });

  it('tryFire emits ammoChanged event', () => {
    const bus = new EventBus<GameEvents>();
    const ws = new WeaponSystem(bus);
    ws.initWeapons(['PISTOL']);
    let changed = false;
    bus.on('ammoChanged', (d) => {
      expect(d.ammo).toBe(11);
      changed = true;
    });
    ws.tryFire(createPlayer(), 1.0);
    expect(changed).toBe(true);
  });

  it('tryFire emits ammoDepleted when empty', () => {
    const bus = new EventBus<GameEvents>();
    const ws = new WeaponSystem(bus);
    ws.initWeapons(['PISTOL']);
    const player = createPlayer();
    // Fire all 12 rounds
    for (let i = 0; i < 11; i++) {
      ws.tryFire(player, i + 1);
      ws.release(player);
    }
    let depleted = false;
    bus.on('ammoDepleted', () => { depleted = true; });
    ws.tryFire(player, 12);
    expect(depleted).toBe(true);
  });

  it('tryFire auto-reloads when empty', () => {
    const bus = new EventBus<GameEvents>();
    const ws = new WeaponSystem(bus);
    ws.initWeapons(['PISTOL']);
    const player = createPlayer();
    // Fire all rounds
    for (let i = 0; i < 12; i++) {
      ws.tryFire(player, i + 1);
      ws.release(player);
    }
    // Next tryFire should trigger auto-reload
    const result = ws.tryFire(player, 13);
    expect(result).toBeNull();
    const w = ws.getWeapon('PISTOL')!;
    expect(w.isReloading).toBe(true);
  });

  it('tryFire returns null when reloading', () => {
    const bus = new EventBus<GameEvents>();
    const ws = new WeaponSystem(bus);
    ws.initWeapons(['PISTOL']);
    const player = createPlayer();
    ws.tryFire(player, 1.0);
    ws.tryReload(player);
    const result = ws.tryFire(player, 2.0);
    expect(result).toBeNull();
  });

  /* ── Release ── */
  it('release re-enables semi-auto', () => {
    const bus = new EventBus<GameEvents>();
    const ws = new WeaponSystem(bus);
    ws.initWeapons(['PISTOL']);
    const player = createPlayer();
    ws.tryFire(player, 1.0);
    ws.release(player);
    const w = ws.getWeapon('PISTOL')!;
    expect(w.canFire).toBe(true);
  });

  /* ── Reload ── */
  it('tryReload starts reload', () => {
    const bus = new EventBus<GameEvents>();
    const ws = new WeaponSystem(bus);
    ws.initWeapons(['PISTOL']);
    const player = createPlayer();
    ws.tryFire(player, 1.0);
    const result = ws.tryReload(player);
    expect(result).toBe(true);
  });

  it('tryReload emits weaponReloadStart', () => {
    const bus = new EventBus<GameEvents>();
    const ws = new WeaponSystem(bus);
    ws.initWeapons(['PISTOL']);
    let started = false;
    bus.on('weaponReloadStart', (d) => {
      expect(d.weaponType).toBe('PISTOL');
      started = true;
    });
    const player = createPlayer();
    ws.tryFire(player, 1.0);
    ws.tryReload(player);
    expect(started).toBe(true);
  });

  it('tickReloads completes reload', () => {
    const bus = new EventBus<GameEvents>();
    const ws = new WeaponSystem(bus);
    ws.initWeapons(['PISTOL']);
    const player = createPlayer();
    ws.tryFire(player, 1.0);
    ws.tryReload(player);
    ws.tickReloads(2.0);
    const w = ws.getWeapon('PISTOL')!;
    expect(w.isReloading).toBe(false);
    expect(w.currentAmmo).toBe(12);
  });

  it('tickReloads emits weaponReloadEnd', () => {
    const bus = new EventBus<GameEvents>();
    const ws = new WeaponSystem(bus);
    ws.initWeapons(['PISTOL']);
    let ended = false;
    bus.on('weaponReloadEnd', (d) => {
      expect(d.weaponType).toBe('PISTOL');
      ended = true;
    });
    const player = createPlayer();
    ws.tryFire(player, 1.0);
    ws.tryReload(player);
    ws.tickReloads(2.0);
    expect(ended).toBe(true);
  });

  /* ── Weapon switching ── */
  it('switchWeapon changes current weapon', () => {
    const bus = new EventBus<GameEvents>();
    const ws = new WeaponSystem(bus);
    ws.initWeapons(['PISTOL', 'RIFLE']);
    let player = createPlayer();
    player = { ...player, ownedWeapons: ['PISTOL', 'RIFLE'] };
    const switched = ws.switchWeapon(player, 1);
    expect(switched.currentWeapon).toBe('RIFLE');
  });

  it('switchWeapon wraps around', () => {
    const bus = new EventBus<GameEvents>();
    const ws = new WeaponSystem(bus);
    ws.initWeapons(['PISTOL', 'RIFLE']);
    let player = createPlayer();
    player = { ...player, ownedWeapons: ['PISTOL', 'RIFLE'] };
    const s1 = ws.switchWeapon(player, 1);
    const s2 = ws.switchWeapon(s1, 1);
    expect(s2.currentWeapon).toBe('PISTOL');
  });

  it('switchWeapon backward wraps', () => {
    const bus = new EventBus<GameEvents>();
    const ws = new WeaponSystem(bus);
    ws.initWeapons(['PISTOL', 'RIFLE']);
    let player = createPlayer();
    player = { ...player, ownedWeapons: ['PISTOL', 'RIFLE'] };
    const switched = ws.switchWeapon(player, -1);
    expect(switched.currentWeapon).toBe('RIFLE');
  });

  it('switchWeapon emits weaponSwitched', () => {
    const bus = new EventBus<GameEvents>();
    const ws = new WeaponSystem(bus);
    ws.initWeapons(['PISTOL', 'RIFLE']);
    let switched = false;
    bus.on('weaponSwitched', (d) => {
      expect(d.from).toBe('PISTOL');
      expect(d.to).toBe('RIFLE');
      switched = true;
    });
    let player = createPlayer();
    player = { ...player, ownedWeapons: ['PISTOL', 'RIFLE'] };
    ws.switchWeapon(player, 1);
    expect(switched).toBe(true);
  });

  it('switchWeapon with single weapon is no-op', () => {
    const bus = new EventBus<GameEvents>();
    const ws = new WeaponSystem(bus);
    ws.initWeapons(['PISTOL']);
    const player = createPlayer();
    const switched = ws.switchWeapon(player, 1);
    expect(switched.currentWeapon).toBe('PISTOL');
  });

  /* ── Ammo ── */
  it('addAmmo increases reserve', () => {
    const bus = new EventBus<GameEvents>();
    const ws = new WeaponSystem(bus);
    ws.initWeapons(['PISTOL']);
    ws.addAmmo('PISTOL', 20);
    const w = ws.getWeapon('PISTOL')!;
    expect(w.reserveAmmo).toBe(68);
  });

  it('addAmmo emits ammoChanged', () => {
    const bus = new EventBus<GameEvents>();
    const ws = new WeaponSystem(bus);
    ws.initWeapons(['PISTOL']);
    let changed = false;
    bus.on('ammoChanged', () => { changed = true; });
    ws.addAmmo('PISTOL', 20);
    expect(changed).toBe(true);
  });

  it('addAmmo on uninitialized weapon is no-op', () => {
    const bus = new EventBus<GameEvents>();
    const ws = new WeaponSystem(bus);
    ws.initWeapons(['PISTOL']);
    ws.addAmmo('RIFLE', 20);
    expect(ws.getWeapon('RIFLE')).toBeUndefined();
  });

  /* ── addWeaponType ── */
  it('addWeaponType adds new weapon', () => {
    const bus = new EventBus<GameEvents>();
    const ws = new WeaponSystem(bus);
    ws.initWeapons(['PISTOL']);
    let player = createPlayer();
    player = ws.addWeaponType(player, 'RIFLE');
    expect(player.ownedWeapons).toContain('RIFLE');
    expect(ws.getWeapon('RIFLE')).toBeDefined();
  });

  it('addWeaponType does not duplicate', () => {
    const bus = new EventBus<GameEvents>();
    const ws = new WeaponSystem(bus);
    ws.initWeapons(['PISTOL']);
    let player = createPlayer();
    player = ws.addWeaponType(player, 'PISTOL');
    expect(player.ownedWeapons).toHaveLength(1);
  });

  /* ── Reset ── */
  it('reset clears all weapons', () => {
    const bus = new EventBus<GameEvents>();
    const ws = new WeaponSystem(bus);
    ws.initWeapons(['PISTOL', 'RIFLE']);
    ws.reset();
    expect(ws.getWeapon('PISTOL')).toBeUndefined();
    expect(ws.getWeapon('RIFLE')).toBeUndefined();
  });
});
