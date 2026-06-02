/**
 * Combat system — damage pipeline, hit registration, death handling.
 * Pure logic operating on models; emits events via EventBus.
 */

import type { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/GameEvents';
import type { PlayerState } from '../models/Player';
import type { EnemyData } from '../models/Enemy';
import { damagePlayer, healPlayer, tickInvincibility, getDamageMultiplier } from '../models/Player';
import { damageEnemy, tickEnemyInvincibility, isEnemyAlive } from '../models/Enemy';
import type { WeaponState } from '../models/Weapon';
import { getWeaponDamage } from '../models/Weapon';

export interface HitResult {
  hit: boolean;
  enemyId?: string;
  damageDealt?: number;
  killed: boolean;
}

export class CombatSystem {
  private bus: EventBus<GameEvents>;

  constructor(bus: EventBus<GameEvents>) {
    this.bus = bus;
  }

  /** Apply damage to the player. Returns updated player state. */
  damagePlayer(player: PlayerState, amount: number): PlayerState {
    if (!player.isAlive || player.isInvincible) return player;

    const updated = damagePlayer(player, amount);

    this.bus.emit('playerDamaged', {
      amount,
      currentHealth: updated.health,
      maxHealth: updated.maxHealth,
    });

    if (!updated.isAlive) {
      this.bus.emit('playerDied', {});
    }

    return updated;
  }

  /** Heal the player. Returns updated player state. */
  healPlayer(player: PlayerState, amount: number): PlayerState {
    const updated = healPlayer(player, amount);
    const healed = updated.health - player.health;

    if (healed > 0) {
      this.bus.emit('playerHealed', {
        amount: healed,
        currentHealth: updated.health,
      });
    }

    return updated;
  }

  /** Process a weapon hit against enemies. Returns the hit result. */
  processHit(
    weapon: WeaponState,
    enemy: EnemyData,
    player: PlayerState,
  ): { enemy: EnemyData; result: HitResult } {
    if (!isEnemyAlive(enemy)) {
      return { enemy, result: { hit: false, killed: false } };
    }

    const baseDamage = getWeaponDamage(weapon);
    const multiplier = getDamageMultiplier(player);
    const totalDamage = baseDamage * multiplier;

    const updated = damageEnemy(enemy, totalDamage);
    const damageDealt = enemy.health - updated.health;

    this.bus.emit('enemyDamaged', {
      id: enemy.id,
      amount: damageDealt,
      currentHealth: updated.health,
      maxHealth: updated.maxHealth,
    });

    if (updated.state === 'dead') {
      this.bus.emit('enemyKilled', {
        id: enemy.id,
        type: enemy.type,
        points: enemy.points,
        position: enemy.position,
      });
    }

    return {
      enemy: updated,
      result: {
        hit: true,
        enemyId: enemy.id,
        damageDealt,
        killed: updated.state === 'dead',
      },
    };
  }

  /** Process enemy attack on player. Returns updated player state. */
  processEnemyAttack(
    enemy: EnemyData,
    player: PlayerState,
    now: number,
  ): { enemy: EnemyData; player: PlayerState; attacked: boolean } {
    if (enemy.state === 'dead' || !player.isAlive) {
      return { enemy, player, attacked: false };
    }

    if (now - enemy.lastAttackTime < enemy.attackCooldown) {
      return { enemy, player, attacked: false };
    }

    const updatedEnemy = { ...enemy, lastAttackTime: now };
    const updatedPlayer = this.damagePlayer(player, enemy.damage);

    this.bus.emit('enemyAttack', { id: enemy.id, damage: enemy.damage });

    return { enemy: updatedEnemy, player: updatedPlayer, attacked: true };
  }

  /** Tick invincibility timers. Returns updated states. */
  tickInvincibility(player: PlayerState, enemies: EnemyData[], dt: number): {
    player: PlayerState;
    enemies: EnemyData[];
  } {
    return {
      player: tickInvincibility(player, dt),
      enemies: enemies.map(e => tickEnemyInvincibility(e, dt)),
    };
  }
}
