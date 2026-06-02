/**
 * Spawn system — manages enemy and power-up spawning with wave-based difficulty.
 */

import type { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/GameEvents';
import type { EnemyData } from '../models/Enemy';
import { createEnemy } from '../models/Enemy';
import type { PowerUpData, PowerUpType } from '../models/PowerUp';
import { createPowerUp } from '../models/PowerUp';
import type { WaveState } from '../models/WaveManager';
import {
  shouldSpawnEnemy,
  registerSpawn,
  chooseEnemyType,
} from '../models/WaveManager';
import { PhysicsSystem } from './PhysicsSystem';
import { GAME_CONFIG } from '../core/GameConfig';

export class SpawnSystem {
  private bus: EventBus<GameEvents>;
  private physics: PhysicsSystem;

  constructor(bus: EventBus<GameEvents>, physics: PhysicsSystem) {
    this.bus = bus;
    this.physics = physics;
  }

  /** Try to spawn an enemy this frame. Returns the new enemy or null. */
  trySpawnEnemy(
    wave: WaveState,
    aliveEnemies: EnemyData[],
    playerPos: { x: number; z: number },
  ): { enemy: EnemyData | null; wave: WaveState } {
    if (!shouldSpawnEnemy(wave, aliveEnemies.length)) {
      return { enemy: null, wave };
    }

    const type = chooseEnemyType(wave.waveNumber);
    const spawnPos = this.physics.getSpawnPosition(10, playerPos);
    const enemy = createEnemy(type, spawnPos);

    this.bus.emit('enemySpawned', {
      id: enemy.id,
      type: enemy.type,
      position: enemy.position,
    });

    return {
      enemy,
      wave: registerSpawn(wave),
    };
  }

  /** Roll for a power-up drop at an enemy death position. */
  tryDropPowerUp(position: { x: number; y: number; z: number }): PowerUpData | null {
    if (Math.random() > GAME_CONFIG.powerUps.dropChance) return null;

    const types: PowerUpType[] = ['healthPack', 'ammoPack', 'speedBoost', 'damageBoost'];
    const weights = [0.35, 0.35, 0.15, 0.15];

    const roll = Math.random();
    let cumulative = 0;
    let chosenType: PowerUpType = 'healthPack';

    for (let i = 0; i < types.length; i++) {
      cumulative += weights[i];
      if (roll <= cumulative) {
        chosenType = types[i];
        break;
      }
    }

    const dropPos = {
      x: position.x + (Math.random() - 0.5) * 2,
      y: 0.5,
      z: position.z + (Math.random() - 0.5) * 2,
    };

    const powerUp = createPowerUp(chosenType, dropPos);

    this.bus.emit('powerUpSpawned', {
      id: powerUp.id,
      type: powerUp.type,
      position: powerUp.position,
    });

    return powerUp;
  }
}
