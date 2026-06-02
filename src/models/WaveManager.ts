/**
 * Wave manager — controls enemy spawning waves and difficulty progression.
 */

import { GAME_CONFIG } from '../core/GameConfig';
import type { EnemyType } from './Enemy';

export type WavePhase = 'spawning' | 'fighting' | 'break' | 'complete';

export interface WaveState {
  waveNumber: number;
  phase: WavePhase;
  enemiesRemaining: number;
  enemiesSpawned: number;
  totalEnemiesThisWave: number;
  spawnTimer: number;
  breakTimer: number;
  maxSimultaneous: number;
  spawnInterval: number;
}

export function createWaveState(): WaveState {
  return {
    waveNumber: 1,
    phase: 'spawning',
    enemiesRemaining: GAME_CONFIG.waves.initialEnemiesPerWave,
    enemiesSpawned: 0,
    totalEnemiesThisWave: GAME_CONFIG.waves.initialEnemiesPerWave,
    spawnTimer: 0,
    breakTimer: 0,
    maxSimultaneous: GAME_CONFIG.waves.maxSimultaneousEnemies,
    spawnInterval: GAME_CONFIG.waves.initialSpawnInterval,
  };
}

export function tickWave(wave: WaveState, dt: number, aliveEnemyCount: number): WaveState {
  let next = { ...wave };

  switch (next.phase) {
    case 'spawning': {
      next.spawnTimer -= dt;
      if (next.spawnTimer <= 0 && next.enemiesSpawned < next.totalEnemiesThisWave) {
        next.spawnTimer = next.spawnInterval;
        // Spawning is handled externally — we just track the timer
      }

      // Transition to fighting when all enemies for this wave have been spawned
      if (next.enemiesSpawned >= next.totalEnemiesThisWave) {
        next.phase = 'fighting';
      }
      break;
    }

    case 'fighting': {
      // Check if all enemies are dead
      if (aliveEnemyCount === 0 && next.enemiesSpawned >= next.totalEnemiesThisWave) {
        next.phase = 'break';
        next.breakTimer = GAME_CONFIG.waves.waveBreakDuration;
      }
      break;
    }

    case 'break': {
      next.breakTimer -= dt;
      if (next.breakTimer <= 0) {
        next = advanceToNextWave(next);
      }
      break;
    }

    case 'complete':
      break;
  }

  return next;
}

export function advanceToNextWave(wave: WaveState): WaveState {
  const nextWave = wave.waveNumber + 1;
  const totalEnemies = Math.min(
    GAME_CONFIG.waves.initialEnemiesPerWave + (nextWave - 1) * GAME_CONFIG.waves.enemiesPerWaveGrowth,
    GAME_CONFIG.waves.maxEnemiesPerWave,
  );
  const spawnInterval = Math.max(
    GAME_CONFIG.waves.minSpawnInterval,
    GAME_CONFIG.waves.initialSpawnInterval - (nextWave - 1) * GAME_CONFIG.waves.spawnIntervalDecay,
  );

  return {
    waveNumber: nextWave,
    phase: 'spawning',
    enemiesRemaining: totalEnemies,
    enemiesSpawned: 0,
    totalEnemiesThisWave: totalEnemies,
    spawnTimer: 0,
    breakTimer: 0,
    maxSimultaneous: GAME_CONFIG.waves.maxSimultaneousEnemies,
    spawnInterval,
  };
}

export function shouldSpawnEnemy(wave: WaveState, aliveEnemyCount: number): boolean {
  return (
    wave.phase === 'spawning' &&
    wave.enemiesSpawned < wave.totalEnemiesThisWave &&
    aliveEnemyCount < wave.maxSimultaneous &&
    wave.spawnTimer <= 0
  );
}

export function registerSpawn(wave: WaveState): WaveState {
  return {
    ...wave,
    enemiesSpawned: wave.enemiesSpawned + 1,
    enemiesRemaining: wave.enemiesRemaining - 1,
    spawnTimer: wave.spawnInterval,
  };
}

export function registerKill(wave: WaveState): WaveState {
  return {
    ...wave,
    enemiesRemaining: Math.max(0, wave.enemiesRemaining - 1),
  };
}

export function chooseEnemyType(waveNumber: number): EnemyType {
  const rand = Math.random();

  if (waveNumber >= 4 && rand < 0.25) return 'TANK';
  if (waveNumber >= 3 && rand < 0.45) return 'FAST';
  if (waveNumber >= 2 && rand < 0.3) return 'FAST';

  return 'GRUNT';
}

export function resetWaveState(): WaveState {
  return createWaveState();
}
