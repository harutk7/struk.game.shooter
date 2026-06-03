import { describe, it, expect } from 'vitest';
import {
  createWaveState, tickWave, shouldSpawnEnemy, registerSpawn,
  registerKill, chooseEnemyType, advanceToNextWave, resetWaveState,
} from '../models/WaveManager';

describe('WaveManager', () => {
  /* ── Creation ── */
  it('starts at wave 1', () => {
    const w = createWaveState();
    expect(w.waveNumber).toBe(1);
    expect(w.phase).toBe('spawning');
    expect(w.totalEnemiesThisWave).toBe(5);
    expect(w.enemiesSpawned).toBe(0);
    expect(w.enemiesRemaining).toBe(5);
    expect(w.spawnTimer).toBe(0);
    expect(w.spawnInterval).toBe(3);
  });

  /* ── shouldSpawnEnemy ── */
  it('should spawn when conditions met', () => {
    const w = createWaveState();
    expect(shouldSpawnEnemy(w, 0)).toBe(true);
  });

  it('should not spawn when max enemies alive', () => {
    const w = createWaveState();
    expect(shouldSpawnEnemy(w, 12)).toBe(false);
  });

  it('should not spawn when all spawned', () => {
    const w = { ...createWaveState(), enemiesSpawned: 5, totalEnemiesThisWave: 5 };
    expect(shouldSpawnEnemy(w, 0)).toBe(false);
  });

  it('should not spawn when phase is not spawning', () => {
    const w = { ...createWaveState(), phase: 'fighting' as const };
    expect(shouldSpawnEnemy(w, 0)).toBe(false);
  });

  it('should not spawn when spawnTimer > 0', () => {
    const w = { ...createWaveState(), spawnTimer: 1 };
    expect(shouldSpawnEnemy(w, 0)).toBe(false);
  });

  /* ── registerSpawn ── */
  it('registerSpawn increments counters', () => {
    const w = createWaveState();
    const s = registerSpawn(w);
    expect(s.enemiesSpawned).toBe(1);
    expect(s.enemiesRemaining).toBe(4);
  });

  it('registerSpawn resets spawnTimer', () => {
    const w = { ...createWaveState(), spawnTimer: -0.5 };
    const s = registerSpawn(w);
    expect(s.spawnTimer).toBe(3);
  });

  it('registerSpawn after all spawned', () => {
    const w = { ...createWaveState(), enemiesSpawned: 4, enemiesRemaining: 1 };
    const s = registerSpawn(w);
    expect(s.enemiesSpawned).toBe(5);
    expect(s.enemiesRemaining).toBe(0);
  });

  /* ── registerKill ── */
  it('registerKill decrements remaining', () => {
    const w = createWaveState();
    const k = registerKill(w);
    expect(k.enemiesRemaining).toBe(4);
  });

  it('registerKill does not go below zero', () => {
    const w = { ...createWaveState(), enemiesRemaining: 0 };
    const k = registerKill(w);
    expect(k.enemiesRemaining).toBe(0);
  });

  /* ── advanceToNextWave ── */
  it('advances wave number', () => {
    const w = createWaveState();
    const n = advanceToNextWave(w);
    expect(n.waveNumber).toBe(2);
  });

  it('increases enemy count per wave', () => {
    const w = createWaveState();
    const n = advanceToNextWave(w);
    expect(n.totalEnemiesThisWave).toBe(7);
  });

  it('decreases spawn interval', () => {
    const w = createWaveState();
    const n = advanceToNextWave(w);
    expect(n.spawnInterval).toBeLessThan(3);
  });

  it('caps max enemies per wave', () => {
    let w = createWaveState();
    for (let i = 0; i < 20; i++) {
      w = advanceToNextWave(w);
    }
    expect(w.totalEnemiesThisWave).toBe(25);
  });

  it('caps minimum spawn interval', () => {
    let w = createWaveState();
    for (let i = 0; i < 30; i++) {
      w = advanceToNextWave(w);
    }
    expect(w.spawnInterval).toBe(0.8);
  });

  it('resets phase to spawning on advance', () => {
    const w = { ...createWaveState(), phase: 'fighting' as const };
    const n = advanceToNextWave(w);
    expect(n.phase).toBe('spawning');
  });

  /* ── tickWave ── */
  it('tickWave in spawning phase decrements spawnTimer', () => {
    const w = { ...createWaveState(), spawnTimer: 2 };
    const t = tickWave(w, 1, 0);
    expect(t.spawnTimer).toBe(1);
  });

  it('tickWave transitions to fighting when all spawned', () => {
    const w = { ...createWaveState(), enemiesSpawned: 5, totalEnemiesThisWave: 5, phase: 'spawning' as const };
    const t = tickWave(w, 0.1, 2);
    expect(t.phase).toBe('fighting');
  });

  it('tickWave in fighting phase stays fighting while enemies alive', () => {
    const w = { ...createWaveState(), phase: 'fighting' as const, enemiesSpawned: 5 };
    const t = tickWave(w, 0.1, 2);
    expect(t.phase).toBe('fighting');
  });

  it('tickWave transitions to break when all enemies dead', () => {
    const w = { ...createWaveState(), phase: 'fighting' as const, enemiesSpawned: 5, totalEnemiesThisWave: 5 };
    const t = tickWave(w, 0.1, 0);
    expect(t.phase).toBe('break');
    expect(t.breakTimer).toBe(3);
  });

  it('tickWave in break decrements breakTimer', () => {
    const w = { ...createWaveState(), phase: 'break' as const, breakTimer: 3 };
    const t = tickWave(w, 1, 0);
    expect(t.breakTimer).toBe(2);
  });

  it('tickWave advances to next wave after break', () => {
    const w = { ...createWaveState(), phase: 'break' as const, breakTimer: 0.5 };
    const t = tickWave(w, 1, 0);
    expect(t.waveNumber).toBe(2);
    expect(t.phase).toBe('spawning');
  });

  /* ── chooseEnemyType ── */
  it('wave 1 only spawns GRUNT', () => {
    for (let i = 0; i < 30; i++) {
      expect(chooseEnemyType(1)).toBe('GRUNT');
    }
  });

  it('wave 2 can spawn FAST', () => {
    const types = new Set<string>();
    for (let i = 0; i < 50; i++) types.add(chooseEnemyType(2));
    expect(types.has('FAST')).toBe(true);
  });

  it('wave 3+ can spawn FAST more often', () => {
    let fastCount = 0;
    for (let i = 0; i < 100; i++) {
      if (chooseEnemyType(3) === 'FAST') fastCount++;
    }
    expect(fastCount).toBeGreaterThan(10);
  });

  it('wave 4+ can spawn TANK', () => {
    const types = new Set<string>();
    for (let i = 0; i < 100; i++) types.add(chooseEnemyType(5));
    expect(types.has('TANK')).toBe(true);
  });

  it('always returns a valid type', () => {
    const valid = ['GRUNT', 'FAST', 'TANK'];
    for (let wave = 1; wave <= 20; wave++) {
      for (let i = 0; i < 10; i++) {
        expect(valid).toContain(chooseEnemyType(wave));
      }
    }
  });

  /* ── resetWaveState ── */
  it('resetWaveState returns fresh state', () => {
    let w = createWaveState();
    w = advanceToNextWave(w);
    w = advanceToNextWave(w);
    const r = resetWaveState();
    expect(r.waveNumber).toBe(1);
    expect(r.totalEnemiesThisWave).toBe(5);
  });
});
