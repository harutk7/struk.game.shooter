/**
 * Pure-data power-up model.
 */

import { GAME_CONFIG } from '../core/GameConfig';

export type PowerUpType = 'healthPack' | 'ammoPack' | 'speedBoost' | 'damageBoost';

export interface PowerUpData {
  id: string;
  type: PowerUpType;
  position: { x: number; y: number; z: number };
  collected: boolean;
  lifetime: number;       // seconds until despawn
  bobOffset: number;      // for floating animation
}

let powerUpId = 0;

export function createPowerUp(
  type: PowerUpType,
  position: { x: number; y: number; z: number },
): PowerUpData {
  return {
    id: `pu_${++powerUpId}`,
    type,
    position: { ...position },
    collected: false,
    lifetime: 15,         // 15 seconds before despawn
    bobOffset: Math.random() * Math.PI * 2,
  };
}

export function collectPowerUp(powerUp: PowerUpData): PowerUpData {
  return { ...powerUp, collected: true };
}

export function tickPowerUpLifetime(powerUp: PowerUpData, dt: number): PowerUpData {
  return { ...powerUp, lifetime: powerUp.lifetime - dt };
}

export function isPowerUpExpired(powerUp: PowerUpData): boolean {
  return powerUp.lifetime <= 0 || powerUp.collected;
}

export function getPowerUpConfig(type: PowerUpType) {
  return GAME_CONFIG.powerUps[type];
}

export function resetPowerUpIdCounter(): void {
  powerUpId = 0;
}
