/**
 * Pure-data player model. No rendering, no input — just state.
 */

import { GAME_CONFIG } from '../core/GameConfig';
import type { WeaponType } from './Weapon';

export interface PlayerState {
  health: number;
  maxHealth: number;
  position: { x: number; y: number; z: number };
  velocity: { x: number; y: number; z: number };
  isGrounded: boolean;
  isAlive: boolean;
  isInvincible: boolean;
  invincibilityTimer: number;
  currentWeapon: WeaponType;
  ownedWeapons: WeaponType[];
  activePowerUps: ActivePowerUp[];
}

export interface ActivePowerUp {
  type: 'speedBoost' | 'damageBoost';
  multiplier: number;
  remainingTime: number;
}

export function createPlayer(): PlayerState {
  return {
    health: GAME_CONFIG.player.maxHealth,
    maxHealth: GAME_CONFIG.player.maxHealth,
    position: { x: 0, y: GAME_CONFIG.player.height, z: 5 },
    velocity: { x: 0, y: 0, z: 0 },
    isGrounded: true,
    isAlive: true,
    isInvincible: false,
    invincibilityTimer: 0,
    currentWeapon: 'PISTOL',
    ownedWeapons: ['PISTOL'],
    activePowerUps: [],
  };
}

export function damagePlayer(player: PlayerState, amount: number): PlayerState {
  if (!player.isAlive || player.isInvincible) return player;

  const newHealth = Math.max(0, player.health - amount);
  return {
    ...player,
    health: newHealth,
    isAlive: newHealth > 0,
    isInvincible: newHealth > 0,
    invincibilityTimer: newHealth > 0 ? GAME_CONFIG.player.invincibilityDuration : 0,
  };
}

export function healPlayer(player: PlayerState, amount: number): PlayerState {
  if (!player.isAlive) return player;
  return {
    ...player,
    health: Math.min(player.maxHealth, player.health + amount),
  };
}

export function tickInvincibility(player: PlayerState, dt: number): PlayerState {
  if (!player.isInvincible) return player;
  const newTimer = player.invincibilityTimer - dt;
  return {
    ...player,
    invincibilityTimer: newTimer,
    isInvincible: newTimer > 0,
  };
}

export function addWeapon(player: PlayerState, weapon: WeaponType): PlayerState {
  if (player.ownedWeapons.includes(weapon)) return player;
  return {
    ...player,
    ownedWeapons: [...player.ownedWeapons, weapon],
  };
}

export function switchWeapon(player: PlayerState, weapon: WeaponType): PlayerState {
  if (!player.ownedWeapons.includes(weapon)) return player;
  return { ...player, currentWeapon: weapon };
}

export function addPowerUp(
  player: PlayerState,
  type: ActivePowerUp['type'],
  multiplier: number,
  duration: number
): PlayerState {
  // Replace existing power-up of same type
  const filtered = player.activePowerUps.filter(p => p.type !== type);
  return {
    ...player,
    activePowerUps: [...filtered, { type, multiplier, remainingTime: duration }],
  };
}

export function tickPowerUps(player: PlayerState, dt: number): PlayerState {
  const updated = player.activePowerUps
    .map(p => ({ ...p, remainingTime: p.remainingTime - dt }))
    .filter(p => p.remainingTime > 0);

  if (updated.length === player.activePowerUps.length) return player;
  return { ...player, activePowerUps: updated };
}

export function getDamageMultiplier(player: PlayerState): number {
  const boost = player.activePowerUps.find(p => p.type === 'damageBoost');
  return boost?.multiplier ?? 1;
}

export function getSpeedMultiplier(player: PlayerState): number {
  const boost = player.activePowerUps.find(p => p.type === 'speedBoost');
  return boost?.multiplier ?? 1;
}

export function respawnPlayer(player: PlayerState): PlayerState {
  return {
    ...createPlayer(),
    ownedWeapons: player.ownedWeapons,
    currentWeapon: player.currentWeapon,
  };
}
