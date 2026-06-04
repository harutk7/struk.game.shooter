/**
 * Pure-data weapon model. Tracks ammo, reload state, and fire timing.
 */

import { GAME_CONFIG } from '../core/GameConfig';

export type WeaponType = 'PISTOL' | 'RIFLE' | 'SHOTGUN' | 'SNIPER';

export interface WeaponState {
  type: WeaponType;
  currentAmmo: number;
  reserveAmmo: number;
  isReloading: boolean;
  reloadTimer: number;
  lastFireTime: number;
  canFire: boolean;
}

export function createWeapon(type: WeaponType): WeaponState {
  const config = GAME_CONFIG.weapons[type];
  return {
    type,
    currentAmmo: config.magazineSize,
    reserveAmmo: config.reserveAmmo,
    isReloading: false,
    reloadTimer: 0,
    lastFireTime: 0,
    canFire: true,
  };
}

export function getWeaponConfig(type: WeaponType) {
  return GAME_CONFIG.weapons[type];
}

export function canFireWeapon(weapon: WeaponState, now: number): boolean {
  if (!weapon.canFire || weapon.isReloading) return false;
  if (weapon.currentAmmo <= 0) return false;

  const config = getWeaponConfig(weapon.type);
  const fireInterval = 1 / config.fireRate;
  return (now - weapon.lastFireTime) >= fireInterval;
}

export function consumeAmmo(weapon: WeaponState, now: number): WeaponState {
  const config = getWeaponConfig(weapon.type);
  return {
    ...weapon,
    currentAmmo: weapon.currentAmmo - 1,
    lastFireTime: now,
    canFire: config.automatic,
  };
}

export function releaseTrigger(weapon: WeaponState): WeaponState {
  return { ...weapon, canFire: true };
}

export function startReload(weapon: WeaponState): WeaponState | null {
  if (weapon.isReloading) return null;
  if (weapon.currentAmmo === getWeaponConfig(weapon.type).magazineSize) return null;
  if (weapon.reserveAmmo <= 0) return null;

  return {
    ...weapon,
    isReloading: true,
    reloadTimer: getWeaponConfig(weapon.type).reloadTime,
    canFire: false,
  };
}

export function tickReload(weapon: WeaponState, dt: number): WeaponState | null {
  if (!weapon.isReloading) return null;

  const newTimer = weapon.reloadTimer - dt;
  if (newTimer > 0) {
    return { ...weapon, reloadTimer: newTimer };
  }

  // Reload complete
  const config = getWeaponConfig(weapon.type);
  const needed = config.magazineSize - weapon.currentAmmo;
  const toLoad = Math.min(needed, weapon.reserveAmmo);

  return {
    ...weapon,
    currentAmmo: weapon.currentAmmo + toLoad,
    reserveAmmo: weapon.reserveAmmo - toLoad,
    isReloading: false,
    reloadTimer: 0,
    canFire: true,
  };
}

export function addReserveAmmo(weapon: WeaponState, amount: number): WeaponState {
  return { ...weapon, reserveAmmo: weapon.reserveAmmo + amount };
}

export function getWeaponDamage(weapon: WeaponState): number {
  return getWeaponConfig(weapon.type).damage;
}

export function getWeaponSpread(weapon: WeaponState): number {
  return getWeaponConfig(weapon.type).spread;
}

export function getWeaponRange(weapon: WeaponState): number {
  return getWeaponConfig(weapon.type).range;
}

export function getWeaponPelletCount(weapon: WeaponState): number {
  const config = getWeaponConfig(weapon.type);
  return 'pellets' in config ? (config as any).pellets : 1;
}
