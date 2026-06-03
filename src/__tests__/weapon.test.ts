import { describe, it, expect } from 'vitest';
import {
  createWeapon, canFireWeapon, consumeAmmo, startReload, tickReload,
  addReserveAmmo, releaseTrigger, getWeaponDamage, getWeaponSpread,
  getWeaponRange, getWeaponPelletCount, getWeaponConfig,
} from '../models/Weapon';

describe('Weapon', () => {
  /* ── Creation ── */
  it('PISTOL has correct stats', () => {
    const w = createWeapon('PISTOL');
    expect(w.type).toBe('PISTOL');
    expect(w.currentAmmo).toBe(12);
    expect(w.reserveAmmo).toBe(48);
    expect(w.isReloading).toBe(false);
    expect(w.canFire).toBe(true);
    expect(w.lastFireTime).toBe(0);
  });

  it('RIFLE has correct stats', () => {
    const w = createWeapon('RIFLE');
    expect(w.currentAmmo).toBe(30);
    expect(w.reserveAmmo).toBe(120);
  });

  it('SHOTGUN has correct stats', () => {
    const w = createWeapon('SHOTGUN');
    expect(w.currentAmmo).toBe(8);
    expect(w.reserveAmmo).toBe(32);
  });

  /* ── getWeaponConfig ── */
  it('getWeaponConfig returns correct PISTOL config', () => {
    const c = getWeaponConfig('PISTOL');
    expect(c.damage).toBe(25);
    expect(c.fireRate).toBe(4);
    expect(c.magazineSize).toBe(12);
    expect(c.automatic).toBe(false);
  });

  it('getWeaponConfig returns correct RIFLE config', () => {
    const c = getWeaponConfig('RIFLE');
    expect(c.damage).toBe(18);
    expect(c.fireRate).toBe(10);
    expect(c.automatic).toBe(true);
  });

  it('getWeaponConfig returns correct SHOTGUN config', () => {
    const c = getWeaponConfig('SHOTGUN');
    expect(c.damage).toBe(12);
    expect(c.fireRate).toBe(1.2);
    expect(c.automatic).toBe(false);
  });

  /* ── canFireWeapon ── */
  it('can fire when ready', () => {
    const w = createWeapon('PISTOL');
    expect(canFireWeapon(w, 1000)).toBe(true);
  });

  it('cannot fire when empty', () => {
    const w = { ...createWeapon('PISTOL'), currentAmmo: 0 };
    expect(canFireWeapon(w, 1000)).toBe(false);
  });

  it('cannot fire when reloading', () => {
    let w = createWeapon('PISTOL');
    w = consumeAmmo(w, 1);
    w = startReload(w)!;
    expect(canFireWeapon(w, 1000)).toBe(false);
  });

  it('cannot fire when canFire is false', () => {
    const w = { ...createWeapon('PISTOL'), canFire: false };
    expect(canFireWeapon(w, 1000)).toBe(false);
  });

  /* ── consumeAmmo ── */
  it('consumes one round', () => {
    const w = createWeapon('PISTOL');
    const c = consumeAmmo(w, 1.0);
    expect(c.currentAmmo).toBe(11);
  });

  it('records last fire time', () => {
    const w = createWeapon('PISTOL');
    const c = consumeAmmo(w, 3.5);
    expect(c.lastFireTime).toBe(3.5);
  });

  it('PISTOL sets canFire=false (semi-auto)', () => {
    const w = createWeapon('PISTOL');
    const c = consumeAmmo(w, 1.0);
    expect(c.canFire).toBe(false);
  });

  it('RIFLE keeps canFire=true (automatic)', () => {
    const w = createWeapon('RIFLE');
    const c = consumeAmmo(w, 1.0);
    expect(c.canFire).toBe(true);
  });

  it('SHOTGUN sets canFire=false (semi-auto)', () => {
    const w = createWeapon('SHOTGUN');
    const c = consumeAmmo(w, 1.0);
    expect(c.canFire).toBe(false);
  });

  /* ── Fire rate ── */
  it('respects PISTOL fire rate (4 rps = 0.25s interval)', () => {
    const w = createWeapon('PISTOL');
    const c = consumeAmmo(w, 1.0);
    const r = releaseTrigger(c);
    expect(canFireWeapon(r, 1.0)).toBe(false);
    expect(canFireWeapon(r, 1.24)).toBe(false);
    expect(canFireWeapon(r, 1.25)).toBe(true);
  });

  it('respects RIFLE fire rate (10 rps = 0.1s interval)', () => {
    const w = createWeapon('RIFLE');
    const c = consumeAmmo(w, 1.0);
    expect(canFireWeapon(c, 1.0)).toBe(false);
    expect(canFireWeapon(c, 1.09)).toBe(false);
    expect(canFireWeapon(c, 1.10)).toBe(true);
  });

  it('respects SHOTGUN fire rate (1.2 rps ≈ 0.833s interval)', () => {
    const w = createWeapon('SHOTGUN');
    const c = consumeAmmo(w, 1.0);
    const r = releaseTrigger(c);
    expect(canFireWeapon(r, 1.0)).toBe(false);
    expect(canFireWeapon(r, 1.83)).toBe(false);
    expect(canFireWeapon(r, 1.84)).toBe(true);
  });

  /* ── releaseTrigger ── */
  it('releaseTrigger re-enables firing', () => {
    const w = createWeapon('PISTOL');
    const c = consumeAmmo(w, 1.0);
    expect(c.canFire).toBe(false);
    const r = releaseTrigger(c);
    expect(r.canFire).toBe(true);
  });

  it('releaseTrigger on already-released is no-op', () => {
    const w = createWeapon('PISTOL');
    const r = releaseTrigger(w);
    expect(r.canFire).toBe(true);
  });

  /* ── Reload ── */
  it('starts reload when not full', () => {
    let w = createWeapon('PISTOL');
    w = consumeAmmo(w, 1.0);
    w = consumeAmmo(w, 2.0);
    const r = startReload(w);
    expect(r).not.toBeNull();
    expect(r!.isReloading).toBe(true);
    expect(r!.reloadTimer).toBe(1.5);
    expect(r!.canFire).toBe(false);
  });

  it('does not reload when full', () => {
    const w = createWeapon('PISTOL');
    expect(startReload(w)).toBeNull();
  });

  it('does not reload when already reloading', () => {
    let w = createWeapon('PISTOL');
    w = consumeAmmo(w, 1.0);
    w = startReload(w)!;
    expect(startReload(w)).toBeNull();
  });

  it('does not reload when no reserve ammo', () => {
    const w = { ...createWeapon('PISTOL'), currentAmmo: 5, reserveAmmo: 0 };
    expect(startReload(w)).toBeNull();
  });

  it('reload timer ticks down', () => {
    let w = createWeapon('PISTOL');
    w = consumeAmmo(w, 1.0);
    w = startReload(w)!;
    const t = tickReload(w, 0.5);
    expect(t).not.toBeNull();
    expect(t!.reloadTimer).toBeCloseTo(1.0, 5);
    expect(t!.isReloading).toBe(true);
  });

  it('reload completes', () => {
    let w = createWeapon('PISTOL');
    w = consumeAmmo(w, 1.0);
    w = consumeAmmo(w, 2.0);
    w = startReload(w)!;
    const done = tickReload(w, 2.0);
    expect(done).not.toBeNull();
    expect(done!.isReloading).toBe(false);
    expect(done!.currentAmmo).toBe(12);
    expect(done!.reserveAmmo).toBe(46);
    expect(done!.canFire).toBe(true);
  });

  it('reload with partial reserve fills what it can', () => {
    let w = createWeapon('PISTOL');
    w = consumeAmmo(w, 1.0);
    w = consumeAmmo(w, 2.0);
    w = consumeAmmo(w, 3.0);
    w = consumeAmmo(w, 4.0);
    w = consumeAmmo(w, 5.0);
    w = consumeAmmo(w, 6.0);
    w = consumeAmmo(w, 7.0);
    w = consumeAmmo(w, 8.0);
    w = consumeAmmo(w, 9.0);
    w = consumeAmmo(w, 10.0);
    // 2 rounds left, 48 reserve, need 10
    w = startReload(w)!;
    const done = tickReload(w, 2.0);
    expect(done!.currentAmmo).toBe(12);
    expect(done!.reserveAmmo).toBe(38);
  });

  it('reload when reserve is less than needed', () => {
    const w = { ...createWeapon('PISTOL'), currentAmmo: 0, reserveAmmo: 5 };
    const r = startReload(w)!;
    const done = tickReload(r, 2.0);
    expect(done!.currentAmmo).toBe(5);
    expect(done!.reserveAmmo).toBe(0);
  });

  it('tickReload on non-reloading weapon returns null', () => {
    const w = createWeapon('PISTOL');
    expect(tickReload(w, 1.0)).toBeNull();
  });

  /* ── Ammo ── */
  it('addReserveAmmo increases reserve', () => {
    const w = createWeapon('PISTOL');
    const a = addReserveAmmo(w, 20);
    expect(a.reserveAmmo).toBe(68);
  });

  it('addReserveAmmo with zero does nothing', () => {
    const w = createWeapon('PISTOL');
    const a = addReserveAmmo(w, 0);
    expect(a.reserveAmmo).toBe(48);
  });

  /* ── Damage / Spread / Range / Pellets ── */
  it('getWeaponDamage returns correct values', () => {
    expect(getWeaponDamage(createWeapon('PISTOL'))).toBe(25);
    expect(getWeaponDamage(createWeapon('RIFLE'))).toBe(18);
    expect(getWeaponDamage(createWeapon('SHOTGUN'))).toBe(12);
  });

  it('getWeaponSpread returns correct values', () => {
    expect(getWeaponSpread(createWeapon('PISTOL'))).toBe(1);
    expect(getWeaponSpread(createWeapon('RIFLE'))).toBe(2.5);
    expect(getWeaponSpread(createWeapon('SHOTGUN'))).toBe(12);
  });

  it('getWeaponRange returns correct values', () => {
    expect(getWeaponRange(createWeapon('PISTOL'))).toBe(100);
    expect(getWeaponRange(createWeapon('RIFLE'))).toBe(150);
    expect(getWeaponRange(createWeapon('SHOTGUN'))).toBe(30);
  });

  it('getWeaponPelletCount returns 1 for non-shotgun', () => {
    expect(getWeaponPelletCount(createWeapon('PISTOL'))).toBe(1);
    expect(getWeaponPelletCount(createWeapon('RIFLE'))).toBe(1);
  });

  it('getWeaponPelletCount returns 8 for shotgun', () => {
    expect(getWeaponPelletCount(createWeapon('SHOTGUN'))).toBe(8);
  });
});
