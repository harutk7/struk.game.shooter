/**
 * All game events flowing through the EventBus.
 * Every system communicates exclusively through these typed events.
 */

import type { EnemyType, EnemyState } from '../models/Enemy';
import type { WeaponType } from '../models/Weapon';
import type { PowerUpType } from '../models/PowerUp';

export interface GameEvents {
  /* ── Game lifecycle ── */
  gameStarted: {};
  gamePaused: {};
  gameResumed: {};
  gameOver: { finalScore: number; wave: number; kills: number };

  /* ── Player ── */
  playerDamaged: { amount: number; currentHealth: number; maxHealth: number };
  playerHealed: { amount: number; currentHealth: number };
  playerDied: {};
  playerRespawned: {};
  playerMoved: { position: { x: number; y: number; z: number } };

  /* ── Weapons ── */
  weaponFired: { weaponType: WeaponType; ammo: number; reserve: number };
  weaponReloadStart: { weaponType: WeaponType };
  weaponReloadEnd: { weaponType: WeaponType; ammo: number; reserve: number };
  weaponSwitched: { from: WeaponType | null; to: WeaponType };
  ammoChanged: { weaponType: WeaponType; ammo: number; reserve: number };
  ammoDepleted: { weaponType: WeaponType };
  /** Trigger pulled on an empty magazine (no fire, no ammo change). */
  weaponEmptyClick: { weaponType: WeaponType };

  /* ── Enemies ── */
  enemySpawned: { id: string; type: EnemyType; position: { x: number; y: number; z: number } };
  enemyDamaged: { id: string; amount: number; currentHealth: number; maxHealth: number };
  enemyKilled: { id: string; type: EnemyType; points: number; position: { x: number; y: number; z: number } };
  enemyStateChanged: { id: string; state: EnemyState };
  enemyAttack: { id: string; damage: number };

  /* ── Waves ── */
  waveStarted: { wave: number; enemiesRemaining: number };
  waveCompleted: { wave: number };
  waveBreakStarted: { nextWave: number; duration: number };
  waveBreakEnded: { wave: number };

  /* ── Scoring ── */
  scoreChanged: { score: number; delta: number; combo: number };
  comboExpired: { maxCombo: number };

  /* ── Power-ups ── */
  powerUpSpawned: { id: string; type: PowerUpType; position: { x: number; y: number; z: number } };
  powerUpCollected: { id: string; type: PowerUpType };
  powerUpExpired: { type: PowerUpType };

  /* ── Effects (rendering-only) ── */
  screenShake: { intensity: number; duration: number };
  damageFlash: {};
  impactEffect: { position: { x: number; y: number; z: number }; normal?: { x: number; y: number; z: number } };
  bulletTrail: { from: { x: number; y: number; z: number }; to: { x: number; y: number; z: number }; hit: boolean };
}
