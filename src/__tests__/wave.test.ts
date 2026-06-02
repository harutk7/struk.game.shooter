import { describe, it, expect } from 'vitest';
import { createWaveState, shouldSpawnEnemy, registerSpawn, registerKill, chooseEnemyType, advanceToNextWave } from '../models/WaveManager';

describe('WaveManager', () => {
  it('starts at wave 1', () => {
    const w = createWaveState();
    expect(w.waveNumber).toBe(1);
    expect(w.phase).toBe('spawning');
  });

  it('should spawn when conditions met', () => {
    const w = createWaveState();
    expect(shouldSpawnEnemy(w, 0)).toBe(true);
  });

  it('should not spawn when max enemies reached', () => {
    const w = createWaveState();
    expect(shouldSpawnEnemy(w, 12)).toBe(false);
  });

  it('registers spawn', () => {
    const w = createWaveState();
    const s = registerSpawn(w);
    expect(s.enemiesSpawned).toBe(1);
    expect(s.enemiesRemaining).toBe(4);
  });

  it('registers kill', () => {
    const w = createWaveState();
    const k = registerKill(w);
    expect(k.enemiesRemaining).toBe(4);
  });

  it('advances to next wave', () => {
    const w = createWaveState();
    const n = advanceToNextWave(w);
    expect(n.waveNumber).toBe(2);
    expect(n.totalEnemiesThisWave).toBe(7);
  });

  it('chooses enemy types based on wave', () => {
    for (let i = 0; i < 20; i++) {
      expect(chooseEnemyType(1)).toBe('GRUNT');
    }
    const types = new Set<string>();
    for (let i = 0; i < 50; i++) types.add(chooseEnemyType(5));
    expect(types.has('TANK')).toBe(true);
  });
});
