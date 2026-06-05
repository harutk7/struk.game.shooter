import { describe, it, expect } from 'vitest';
import { WeaponSFX, getWeaponSFX, __resetWeaponSFXForTests, type SfxSink } from '../audio/WeaponSFX';
import { AudioManager } from '../audio/AudioManager';
import type { PlayOptions } from '../audio/AudioManager';

/** Records every play() call so we can assert on chosen sound + volume. */
class RecordingSink implements SfxSink {
  loaded: string[] = [];
  plays: Array<{ name: string; opts?: PlayOptions }> = [];
  async loadSound(name: string): Promise<AudioBuffer> {
    this.loaded.push(name);
    return { duration: 0.1 } as unknown as AudioBuffer;
  }
  play(name: string, opts?: PlayOptions): AudioBufferSourceNode | null {
    this.plays.push({ name, opts });
    return null;
  }
}

/** Minimal fake Web Audio graph (mirrors audioManager.test.ts) for the load path. */
class FakeAudioContext {
  state: 'running' | 'suspended' = 'running';
  destination = { id: 'destination' };
  createGain() {
    return { gain: { value: 1 }, connect() {} };
  }
  createBufferSource() {
    return { buffer: null, loop: false, connect() {}, start() {}, stop() {} };
  }
  async decodeAudioData() {
    return { duration: 0.1, _fake: true } as unknown as AudioBuffer;
  }
  async resume() {}
  async suspend() {}
}

describe('WeaponSFX', () => {
  it('playGunshot() does not throw for any real weapon type', () => {
    const sink = new RecordingSink();
    const sfx = new WeaponSFX({ manager: sink });
    expect(() => sfx.playGunshot('PISTOL')).not.toThrow();
    expect(() => sfx.playGunshot('RIFLE')).not.toThrow();
    expect(() => sfx.playGunshot('SHOTGUN')).not.toThrow();
    expect(() => sfx.playGunshot('SNIPER')).not.toThrow();
    // Each call routed to a play() with a non-empty sound name.
    expect(sink.plays).toHaveLength(4);
    expect(sink.plays.every((p) => p.name.length > 0)).toBe(true);
  });

  it('plays a distinct sound bank per weapon type', () => {
    const sink = new RecordingSink();
    const sfx = new WeaponSFX({ manager: sink });
    sfx.playGunshot('PISTOL');
    sfx.playGunshot('RIFLE');
    sfx.playGunshot('SHOTGUN');
    sfx.playGunshot('SNIPER');
    const prefixes = sink.plays.map((p) => p.name.replace(/_\d+$/, ''));
    expect(new Set(prefixes)).toEqual(new Set(['pistol', 'rifle', 'shotgun', 'sniper']));
  });

  it('varies the variant: 5 shots in a row use 2+ distinct files', () => {
    const sink = new RecordingSink();
    // Deterministic rng that would otherwise return index 0 every time — the
    // non-repeat picker must still produce variety.
    const sfx = new WeaponSFX({ manager: sink, rng: () => 0 });
    for (let i = 0; i < 5; i++) sfx.playGunshot('RIFLE');
    const used = new Set(sink.plays.map((p) => p.name));
    expect(used.size).toBeGreaterThanOrEqual(2);
  });

  it('never repeats the same variant twice in a row', () => {
    const sink = new RecordingSink();
    // rng cycles so a naive picker would repeat; non-repeat guard prevents it.
    const seq = [0, 0, 0.99, 0.99, 0];
    let i = 0;
    const sfx = new WeaponSFX({ manager: sink, rng: () => seq[i++ % seq.length] });
    for (let k = 0; k < 5; k++) sfx.playGunshot('PISTOL');
    for (let k = 1; k < sink.plays.length; k++) {
      expect(sink.plays[k].name).not.toBe(sink.plays[k - 1].name);
    }
  });

  it('playHitMarker(headshot) is louder than playHitMarker(body)', () => {
    const sink = new RecordingSink();
    const sfx = new WeaponSFX({ manager: sink });
    sfx.playHitMarker('headshot');
    sfx.playHitMarker('body');
    const [head, body] = sink.plays;
    expect(head.name).toBe('hitmarker');
    expect(body.name).toBe('hitmarker');
    expect(head.opts?.volume ?? 1).toBeGreaterThan(body.opts?.volume ?? 1);
  });

  it('loadAll() loads every weapon variant + the hit-marker successfully', async () => {
    const ctx = new FakeAudioContext();
    let fetches = 0;
    const manager = new AudioManager({
      contextFactory: () => ctx as unknown as AudioContext,
      fetcher: async () => {
        fetches++;
        return { arrayBuffer: async () => new ArrayBuffer(8) };
      },
    });
    const sfx = new WeaponSFX({ manager });
    await expect(sfx.loadAll('/')).resolves.toBeUndefined();
    // 4 weapons x 2 variants + 1 hit-marker = 9 sounds.
    expect(fetches).toBe(9);
    expect(manager.hasSound('pistol_1')).toBe(true);
    expect(manager.hasSound('sniper_2')).toBe(true);
    expect(manager.hasSound('hitmarker')).toBe(true);
  });

  it('loadAll() resolves even when some assets fail to load', async () => {
    const ctx = new FakeAudioContext();
    const manager = new AudioManager({
      contextFactory: () => ctx as unknown as AudioContext,
      fetcher: async (url: string) => {
        if (url.includes('shotgun')) throw new Error(`404 ${url}`);
        return { arrayBuffer: async () => new ArrayBuffer(8) };
      },
    });
    const sfx = new WeaponSFX({ manager });
    await expect(sfx.loadAll('/')).resolves.toBeUndefined();
    expect(manager.hasSound('shotgun_1')).toBe(false);
    expect(manager.hasSound('pistol_1')).toBe(true);
  });

  it('getWeaponSFX() returns a stable singleton', () => {
    __resetWeaponSFXForTests();
    const a = getWeaponSFX();
    const b = getWeaponSFX();
    expect(a).toBe(b);
    __resetWeaponSFXForTests();
  });
});
