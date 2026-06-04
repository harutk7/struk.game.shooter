/**
 * Weapon system — manages weapon switching, fire logic, reload, and ammo.
 * Operates on WeaponState models and emits events via EventBus.
 */

import type { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/GameEvents';
import type { WeaponType, WeaponState } from '../models/Weapon';
import {
  createWeapon,
  canFireWeapon,
  consumeAmmo,
  releaseTrigger,
  startReload,
  tickReload,
  addReserveAmmo,
  getWeaponDamage,
  getWeaponSpread,
  getWeaponRange,
  getWeaponPelletCount,
} from '../models/Weapon';
import type { PlayerState } from '../models/Player';
import { switchWeapon } from '../models/Player';

export class WeaponSystem {
  private bus: EventBus<GameEvents>;
  private weapons = new Map<WeaponType, WeaponState>();

  constructor(bus: EventBus<GameEvents>) {
    this.bus = bus;
  }

  /** Initialize weapons for a player. */
  initWeapons(ownedTypes: WeaponType[]): void {
    this.weapons.clear();
    for (const type of ownedTypes) {
      this.weapons.set(type, createWeapon(type));
    }
  }

  /** Get the state for a specific weapon. */
  getWeapon(type: WeaponType): WeaponState | undefined {
    return this.weapons.get(type);
  }

  /** Get the current weapon for the player. */
  getCurrentWeapon(player: PlayerState): WeaponState | undefined {
    return this.weapons.get(player.currentWeapon);
  }

  /** Attempt to fire the current weapon. Returns hit-scan data. */
  tryFire(
    player: PlayerState,
    now: number,
  ): {
    fired: boolean;
    weapon: WeaponState;
    damage: number;
    spread: number;
    range: number;
    pellets: number;
  } | null {
    const weapon = this.weapons.get(player.currentWeapon);
    if (!weapon) return null;

    if (!canFireWeapon(weapon, now)) {
      // Auto-reload if empty
      if (weapon.currentAmmo <= 0 && !weapon.isReloading) {
        this.tryReload(player);
      }
      return null;
    }

    const updated = consumeAmmo(weapon, now);
    this.weapons.set(player.currentWeapon, updated);

    this.bus.emit('weaponFired', {
      weaponType: updated.type,
      ammo: updated.currentAmmo,
      reserve: updated.reserveAmmo,
    });

    this.bus.emit('ammoChanged', {
      weaponType: updated.type,
      ammo: updated.currentAmmo,
      reserve: updated.reserveAmmo,
    });

    if (updated.currentAmmo <= 0) {
      this.bus.emit('ammoDepleted', { weaponType: updated.type });
    }

    return {
      fired: true,
      weapon: updated,
      damage: getWeaponDamage(updated),
      spread: getWeaponSpread(updated),
      range: getWeaponRange(updated),
      pellets: getWeaponPelletCount(updated),
    };
  }

  /** Release the trigger (for semi-auto weapons). */
  release(player: PlayerState): void {
    const weapon = this.weapons.get(player.currentWeapon);
    if (!weapon) return;

    this.weapons.set(player.currentWeapon, releaseTrigger(weapon));
  }

  /** Attempt to reload the current weapon. */
  tryReload(player: PlayerState): boolean {
    const weapon = this.weapons.get(player.currentWeapon);
    if (!weapon) return false;

    const reloading = startReload(weapon);
    if (!reloading) return false;

    this.weapons.set(player.currentWeapon, reloading);

    this.bus.emit('weaponReloadStart', { weaponType: reloading.type });
    return true;
  }

  /** Tick reload timers. Call every frame. */
  tickReloads(dt: number): void {
    for (const [type, weapon] of this.weapons) {
      if (!weapon.isReloading) continue;

      const result = tickReload(weapon, dt);
      if (result) {
        this.weapons.set(type, result);

        if (!result.isReloading) {
          this.bus.emit('weaponReloadEnd', {
            weaponType: result.type,
            ammo: result.currentAmmo,
            reserve: result.reserveAmmo,
          });
          this.bus.emit('ammoChanged', {
            weaponType: result.type,
            ammo: result.currentAmmo,
            reserve: result.reserveAmmo,
          });
        }
      }
    }
  }

  /** Switch player to a weapon by direct slot index (0=first, 1=second, …). */
  switchToSlot(player: PlayerState, slot: number): PlayerState {
    const owned = player.ownedWeapons;
    if (slot < 0 || slot >= owned.length) return player;
    const newWeapon = owned[slot];
    if (newWeapon === player.currentWeapon) return player;

    const updated = switchWeapon(player, newWeapon);

    this.bus.emit('weaponSwitched', {
      from: player.currentWeapon,
      to: newWeapon,
    });

    const wp = this.weapons.get(newWeapon);
    if (wp) {
      this.bus.emit('ammoChanged', {
        weaponType: wp.type,
        ammo: wp.currentAmmo,
        reserve: wp.reserveAmmo,
      });
    }

    return updated;
  }

  /** Switch player to a different weapon by direction (1=next, -1=prev). */
  switchWeapon(player: PlayerState, direction: number): PlayerState {
    const owned = player.ownedWeapons;
    if (owned.length <= 1) return player;

    const currentIdx = owned.indexOf(player.currentWeapon);
    const newIdx = (currentIdx + direction + owned.length) % owned.length;
    const newWeapon = owned[newIdx];

    if (newWeapon === player.currentWeapon) return player;

    const updated = switchWeapon(player, newWeapon);

    this.bus.emit('weaponSwitched', {
      from: player.currentWeapon,
      to: newWeapon,
    });

    // Emit ammo for the new weapon
    const wp = this.weapons.get(newWeapon);
    if (wp) {
      this.bus.emit('ammoChanged', {
        weaponType: wp.type,
        ammo: wp.currentAmmo,
        reserve: wp.reserveAmmo,
      });
    }

    return updated;
  }

  /** Add ammo to a weapon (from power-up). */
  addAmmo(type: WeaponType, amount: number): void {
    const weapon = this.weapons.get(type);
    if (!weapon) return;

    const updated = addReserveAmmo(weapon, amount);
    this.weapons.set(type, updated);

    this.bus.emit('ammoChanged', {
      weaponType: updated.type,
      ammo: updated.currentAmmo,
      reserve: updated.reserveAmmo,
    });
  }

  /** Add a new weapon to the player's arsenal. */
  addWeaponType(player: PlayerState, type: WeaponType): PlayerState {
    if (player.ownedWeapons.includes(type)) return player;

    if (!this.weapons.has(type)) {
      this.weapons.set(type, createWeapon(type));
    }

    return {
      ...player,
      ownedWeapons: [...player.ownedWeapons, type],
    };
  }

  /** Reset all weapons. */
  reset(): void {
    this.weapons.clear();
  }
}
