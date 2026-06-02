import { describe, it, expect } from 'vitest';
import { createWeapon, canFireWeapon, consumeAmmo, startReload, tickReload, addReserveAmmo, releaseTrigger, getWeaponDamage } from '../models/Weapon';

describe('Weapon', () => {
  it('creates with full magazine', () => {
    const w = createWeapon('PISTOL');
    expect(w.currentAmmo).toBe(12);
    expect(w.reserveAmmo).toBe(48);
    expect(w.isReloading).toBe(false);
  });

  it('can fire when ready', () => {
    const w = createWeapon('PISTOL');
    expect(canFireWeapon(w, 1000)).toBe(true);
  });

  it('cannot fire when empty', () => {
    let w = createWeapon('PISTOL');
    w = { ...w, currentAmmo: 0 };
    expect(canFireWeapon(w, 1000)).toBe(false);
  });

  it('consumes ammo on fire', () => {
    const w = createWeapon('PISTOL');
    const c = consumeAmmo(w, 1000);
    expect(c.currentAmmo).toBe(11);
    expect(c.lastFireTime).toBe(1000);
  });

  it('respects fire rate', () => {
    const w = createWeapon('PISTOL');
    const c = consumeAmmo(w, 1.0);
    const r = releaseTrigger(c);
    expect(canFireWeapon(r, 1.0)).toBe(false);
    expect(canFireWeapon(r, 1.24)).toBe(false);
    expect(canFireWeapon(r, 1.25)).toBe(true);
  });

  it('reloads correctly', () => {
    let w = createWeapon('PISTOL');
    w = consumeAmmo(w, 1000);
    w = consumeAmmo(w, 2000);
    const r = startReload(w);
    expect(r).not.toBeNull();
    expect(r!.isReloading).toBe(true);
  });

  it('does not reload when full', () => {
    const w = createWeapon('PISTOL');
    expect(startReload(w)).toBeNull();
  });

  it('completes reload', () => {
    let w = createWeapon('PISTOL');
    w = consumeAmmo(w, 1000);
    w = consumeAmmo(w, 2000);
    w = startReload(w)!;
    const done = tickReload(w, 2);
    expect(done).not.toBeNull();
    expect(done!.isReloading).toBe(false);
    expect(done!.currentAmmo).toBe(12);
    expect(done!.reserveAmmo).toBe(46);
  });

  it('releases trigger for semi-auto', () => {
    let w = createWeapon('PISTOL');
    w = consumeAmmo(w, 1000);
    expect(w.canFire).toBe(false);
    w = releaseTrigger(w);
    expect(w.canFire).toBe(true);
  });

  it('adds reserve ammo', () => {
    const w = createWeapon('PISTOL');
    const a = addReserveAmmo(w, 10);
    expect(a.reserveAmmo).toBe(58);
  });

  it('rifle is automatic', () => {
    const w = createWeapon('RIFLE');
    const c = consumeAmmo(w, 1000);
    expect(c.canFire).toBe(true);
  });

  it('shotgun has pellets', () => {
    const w = createWeapon('SHOTGUN');
    expect(w.currentAmmo).toBe(8);
    expect(getWeaponDamage(w)).toBe(12);
  });
});
