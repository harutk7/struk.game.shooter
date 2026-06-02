/**
 * Pure-data enemy model. No rendering — just state and transitions.
 */

import { GAME_CONFIG } from '../core/GameConfig';

export type EnemyType = 'GRUNT' | 'FAST' | 'TANK';
export type EnemyState = 'idle' | 'chasing' | 'attacking' | 'dead';

export interface EnemyData {
  id: string;
  type: EnemyType;
  health: number;
  maxHealth: number;
  position: { x: number; y: number; z: number };
  velocity: { x: number; y: number; z: number };
  state: EnemyState;
  lastAttackTime: number;
  invincibilityTimer: number;
  points: number;
  damage: number;
  speed: number;
  attackRange: number;
  attackCooldown: number;
  detectionRange: number;
  size: { width: number; height: number; depth: number };
}

let nextId = 0;

export function createEnemy(
  type: EnemyType,
  position: { x: number; y: number; z: number }
): EnemyData {
  const config = GAME_CONFIG.enemies[type];
  const id = `enemy_${++nextId}`;

  return {
    id,
    type,
    health: config.health,
    maxHealth: config.health,
    position: { ...position },
    velocity: { x: 0, y: 0, z: 0 },
    state: 'idle',
    lastAttackTime: 0,
    invincibilityTimer: 0,
    points: config.points,
    damage: config.damage,
    speed: config.speed,
    attackRange: config.attackRange,
    attackCooldown: config.attackCooldown,
    detectionRange: config.detectionRange,
    size: { ...config.size },
  };
}

export function damageEnemy(enemy: EnemyData, amount: number): EnemyData {
  if (enemy.state === 'dead') return enemy;

  const newHealth = Math.max(0, enemy.health - amount);
  return {
    ...enemy,
    health: newHealth,
    state: newHealth <= 0 ? 'dead' : enemy.state,
    invincibilityTimer: 0.05, // brief invincibility to prevent double-hit
  };
}

export function tickEnemyInvincibility(enemy: EnemyData, dt: number): EnemyData {
  if (enemy.invincibilityTimer <= 0) return enemy;
  return {
    ...enemy,
    invincibilityTimer: Math.max(0, enemy.invincibilityTimer - dt),
  };
}

export function setEnemyState(enemy: EnemyData, state: EnemyState): EnemyData {
  if (enemy.state === 'dead') return enemy;
  return { ...enemy, state };
}

export function moveEnemy(
  enemy: EnemyData,
  position: { x: number; y: number; z: number }
): EnemyData {
  return { ...enemy, position: { ...position } };
}

export function isEnemyAlive(enemy: EnemyData): boolean {
  return enemy.state !== 'dead';
}

export function resetEnemyIdCounter(): void {
  nextId = 0;
}
