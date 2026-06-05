import { describe, it, expect } from 'vitest';
import { AudioManager, getAudioManager, __resetAudioManagerForTests } from '../audio/AudioManager';

/**
 * Minimal fake Web Audio graph so the AudioManager can be exercised under
 * Node/vitest, which has no real `AudioContext`.
 */
class FakeGainNode {
  gain = { value: 1 };
  connected: any[] = [];
  connect(dest: any): void { this.connected.push(dest); }
}

class FakeBufferSource {
  buffer: any = null;
  loop = false;
  started = false;
  connected: any[] = [];
  connect(dest: any): void { this.connected.push(dest); }
  start(): void { this.started = true; }
  stop(): void { /* noop */ }
}

class FakeAudioContext {
  state: 'running' | 'suspended' = 'running';
  destination = { id: 'destination' };
  createGain(): FakeGainNode { return new FakeGainNode(); }
  createBufferSource(): FakeBufferSource { return new FakeBufferSource(); }
  async decodeAudioData(_data: ArrayBuffer): Promise<any> {
    return { duration: 0.1, _fake: true };
  }
  async resume(): Promise<void> { this.state = 'running'; }
  async suspend(): Promise<void> { this.state = 'suspended'; }
}

function makeManager(overrides: Partial<{
  fetcher: (url: string) => Promise<{ arrayBuffer(): Promise<ArrayBuffer> }>;
}> = {}) {
  const ctx = new FakeAudioContext();
  const manager = new AudioManager({
    contextFactory: () => ctx as unknown as AudioContext,
    fetcher:
      overrides.fetcher ??
      (async () => ({ arrayBuffer: async () => new ArrayBuffer(8) })),
  });
  return { manager, ctx };
}

describe('AudioManager', () => {
  it('exposes the required public API', () => {
    const { manager } = makeManager();
    expect(typeof manager.play).toBe('function');
    expect(typeof manager.loadSound).toBe('function');
    expect(typeof manager.setMasterVolume).toBe('function');
    expect(typeof manager.setSfxVolume).toBe('function');
    expect(typeof manager.setAmbientVolume).toBe('function');
    expect(typeof manager.pause).toBe('function');
    expect(typeof manager.resume).toBe('function');
  });

  it('creates the gain graph lazily on init()', () => {
    const { manager } = makeManager();
    expect(manager.isInitialized).toBe(false);
    manager.init();
    expect(manager.isInitialized).toBe(true);
    expect(manager.context).not.toBeNull();
  });

  it('setMasterVolume(0) mutes the masterGain node', () => {
    const { manager } = makeManager();
    manager.init();
    manager.setMasterVolume(0);
    // The master gain node's value should reflect the mute.
    const master = (manager as any).masterGain as { gain: { value: number } };
    expect(master.gain.value).toBe(0);
    expect(manager.getMasterVolume()).toBe(0);
  });

  it('remembers volume set before init() and applies it on init()', () => {
    const { manager } = makeManager();
    manager.setMasterVolume(0.25);
    manager.init();
    const master = (manager as any).masterGain as { gain: { value: number } };
    expect(master.gain.value).toBe(0.25);
  });

  it('clamps volume into [0,1] and treats NaN as 0', () => {
    const { manager } = makeManager();
    manager.init();
    manager.setMasterVolume(5);
    expect(manager.getMasterVolume()).toBe(1);
    manager.setMasterVolume(-2);
    expect(manager.getMasterVolume()).toBe(0);
    manager.setMasterVolume(Number.NaN);
    expect(manager.getMasterVolume()).toBe(0);
  });

  it('loading an unknown sound returns a rejected promise (does not crash)', async () => {
    const { manager } = makeManager({
      fetcher: async (url: string) => {
        throw new Error(`HTTP 404 for ${url}`);
      },
    });
    await expect(manager.loadSound('missing', '/nope.wav')).rejects.toThrow();
    // The manager must still be usable afterwards.
    expect(manager.hasSound('missing')).toBe(false);
  });

  it('loads, caches and plays a sound through the sfx category', async () => {
    const { manager, ctx } = makeManager();
    const buf = await manager.loadSound('ping', '/ping.wav');
    expect(buf).toBeTruthy();
    expect(manager.hasSound('ping')).toBe(true);

    const source = manager.play('ping', { category: 'sfx' }) as unknown as FakeBufferSource;
    expect(source).not.toBeNull();
    expect(source.started).toBe(true);
    expect(source.buffer).toBe(buf);
    // Source should route into the sfx gain, which routes into master.
    const sfxGain = (manager as any).sfxGain as FakeGainNode;
    expect(source.connected).toContain(sfxGain);
    expect(ctx.state).toBe('running');
  });

  it('play() no-ops gracefully when the sound is not loaded', () => {
    const { manager } = makeManager();
    manager.init();
    expect(manager.play('does-not-exist')).toBeNull();
  });

  it('dedupes concurrent loads of the same name', async () => {
    let calls = 0;
    const { manager } = makeManager({
      fetcher: async () => {
        calls++;
        return { arrayBuffer: async () => new ArrayBuffer(8) };
      },
    });
    const [a, b] = await Promise.all([
      manager.loadSound('x', '/x.wav'),
      manager.loadSound('x', '/x.wav'),
    ]);
    expect(a).toBe(b);
    expect(calls).toBe(1);
  });

  it('getAudioManager() returns a stable singleton', () => {
    __resetAudioManagerForTests();
    const a = getAudioManager();
    const b = getAudioManager();
    expect(a).toBe(b);
    __resetAudioManagerForTests();
  });
});
