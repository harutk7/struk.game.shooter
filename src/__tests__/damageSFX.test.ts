import { describe, it, expect } from 'vitest';
import {
  DamageSFX,
  getDamageSFX,
  __resetDamageSFXForTests,
  PLAYER_PAIN_INTERVAL_MS,
  IMPACT_INTERVAL_MS,
} from '../audio/DamageSFX';
import type { DamageBackend } from '../audio/DamageSFX';

/**
 * Minimal fake Web Audio graph so DamageSFX can be exercised under Node/vitest,
 * which has no real `AudioContext`. (Mirrors footstepSFX.test.ts.)
 */
class FakeAudioParam {
  value = 0;
  setValueAtTime(v: number): this {
    this.value = v;
    return this;
  }
  linearRampToValueAtTime(v: number): this {
    this.value = v;
    return this;
  }
}

class FakeBufferSource {
  buffer: any = null;
  loop = false;
  started = false;
  playbackRate = new FakeAudioParam();
  connected: any[] = [];
  connect(dest: any): void {
    this.connected.push(dest);
  }
  start(): void {
    this.started = true;
  }
  stop(): void {
    /* noop */
  }
}

class FakePanner {
  panningModel = '';
  distanceModel = '';
  refDistance = 0;
  maxDistance = 0;
  rolloffFactor = 0;
  positionX = new FakeAudioParam();
  positionY = new FakeAudioParam();
  positionZ = new FakeAudioParam();
  connected: any[] = [];
  connect(dest: any): void {
    this.connected.push(dest);
  }
}

class FakeGain {
  gain = new FakeAudioParam();
  connected: any[] = [];
  connect(dest: any): void {
    this.connected.push(dest);
  }
}

class FakeAudioContext {
  currentTime = 0;
  destination = { id: 'destination' };
  state: 'running' | 'suspended' = 'running';
  sources: FakeBufferSource[] = [];
  panners: FakePanner[] = [];
  createBufferSource(): FakeBufferSource {
    const s = new FakeBufferSource();
    this.sources.push(s);
    return s;
  }
  createPanner(): FakePanner {
    const p = new FakePanner();
    this.panners.push(p);
    return p;
  }
  createGain(): FakeGain {
    return new FakeGain();
  }
}

/** A fake AudioManager backend that records play() calls and serves named buffers. */
function makeBackend() {
  const ctx = new FakeAudioContext();
  const played: Array<{ name: string; opts: any }> = [];
  const backend: DamageBackend = {
    async loadSound(name: string, _url: string) {
      // Distinct fake AudioBuffer per sound, tagged with its name.
      return { duration: 0.3, _name: name } as unknown as AudioBuffer;
    },
    play(name: string, opts?: any) {
      played.push({ name, opts });
      return new FakeBufferSource() as unknown as AudioBufferSourceNode;
    },
    init() {
      return ctx as unknown as AudioContext;
    },
    get context() {
      return ctx as unknown as AudioContext;
    },
  };
  return { backend, ctx, played };
}

describe('DamageSFX', () => {
  it('rate-limits player pain to one grunt per 0.5s (two hits in <0.5s => 1 SFX)', () => {
    const { backend, played } = makeBackend();
    let t = 0;
    const sfx = new DamageSFX({ manager: backend, clock: () => t, rng: () => 0 });
    sfx.playPlayerPain(50);
    t += 100; // still inside the 0.5s window
    sfx.playPlayerPain(50);
    expect(played.length).toBe(1);
    expect(played[0].name.startsWith('pain_')).toBe(true);
  });

  it('plays another pain grunt once the rate-limit window has elapsed', () => {
    const { backend, played } = makeBackend();
    let t = 0;
    const sfx = new DamageSFX({ manager: backend, clock: () => t, rng: () => 0 });
    sfx.playPlayerPain(50);
    t += PLAYER_PAIN_INTERVAL_MS + 1;
    sfx.playPlayerPain(50);
    expect(played.length).toBe(2);
  });

  it('scales pain volume with damage (light hit quieter than heavy hit)', () => {
    const { backend, played } = makeBackend();
    let t = 0;
    const sfx = new DamageSFX({ manager: backend, clock: () => t, rng: () => 0 });
    sfx.playPlayerPain(5); // light
    t += PLAYER_PAIN_INTERVAL_MS + 1;
    sfx.playPlayerPain(50); // heavy (>= HEAVY_DAMAGE => full)
    expect(played[0].opts.volume).toBeLessThan(played[1].opts.volume);
    expect(played[0].opts.volume).toBeCloseTo(0.3 + 0.7 * (5 / 40), 5); // light floor + ramp
    expect(played[1].opts.volume).toBeCloseTo(1.0, 5); // capped at full
    expect(played[0].opts.category).toBe('sfx');
  });

  it('creates a 3D-panned PannerNode at the bot world position for a death scream', async () => {
    const { backend } = makeBackend();
    const sfx = new DamageSFX({ manager: backend, clock: () => 0, rng: () => 0 });
    await sfx.loadAll('/');
    const panner = sfx.playBotDeath('bot-1', [12, 1, -3]);
    expect(panner).not.toBeNull();
    expect((panner as any).positionX.value).toBe(12);
    expect((panner as any).positionY.value).toBe(1);
    expect((panner as any).positionZ.value).toBe(-3);
    // The graph must ultimately reach the context destination.
    expect((panner as any).connected.length).toBeGreaterThan(0);
  });

  it('rate-limits death screams per bot id', async () => {
    const { backend } = makeBackend();
    let t = 0;
    const sfx = new DamageSFX({ manager: backend, clock: () => t, rng: () => 0 });
    await sfx.loadAll('/');
    expect(sfx.playBotDeath('bot-1', [1, 0, 0])).not.toBeNull();
    expect(sfx.playBotDeath('bot-1', [1, 0, 0])).toBeNull(); // same window => suppressed
    expect(sfx.playBotDeath('bot-2', [1, 0, 0])).not.toBeNull(); // other bot independent
  });

  it('plays a different file for a concrete impact than a metal impact', async () => {
    const { backend, ctx } = makeBackend();
    const sfx = new DamageSFX({ manager: backend, clock: () => 0, rng: () => 0 });
    await sfx.loadAll('/');

    expect(sfx.playImpact([0, 1, 0], 'concrete')).not.toBeNull();
    const concreteName = ctx.sources[ctx.sources.length - 1].buffer._name;

    expect(sfx.playImpact([0, 1, 0], 'metal')).not.toBeNull();
    const metalName = ctx.sources[ctx.sources.length - 1].buffer._name;

    expect(concreteName.startsWith('impact_concrete_')).toBe(true);
    expect(metalName.startsWith('impact_metal_')).toBe(true);
    expect(concreteName).not.toBe(metalName);
  });

  it('rate-limits impacts per surface so a pellet spread does not stack thwacks', async () => {
    const { backend } = makeBackend();
    let t = 0;
    const sfx = new DamageSFX({ manager: backend, clock: () => t, rng: () => 0 });
    await sfx.loadAll('/');
    expect(sfx.playImpact([0, 1, 0], 'concrete')).not.toBeNull();
    expect(sfx.playImpact([0, 1, 0], 'concrete')).toBeNull(); // same window => suppressed
    t += IMPACT_INTERVAL_MS + 1;
    expect(sfx.playImpact([0, 1, 0], 'concrete')).not.toBeNull(); // window elapsed
  });

  it('no-ops positional sounds gracefully when no buffer is loaded', () => {
    const { backend } = makeBackend();
    const sfx = new DamageSFX({ manager: backend, clock: () => 0 });
    // loadAll never called -> no buffers mirrored.
    expect(sfx.playBotDeath('bot-1', [1, 0, 0])).toBeNull();
    expect(sfx.playImpact([1, 0, 0], 'metal')).toBeNull();
  });

  it('getDamageSFX() returns a stable singleton', () => {
    __resetDamageSFXForTests();
    const a = getDamageSFX();
    const b = getDamageSFX();
    expect(a).toBe(b);
    __resetDamageSFXForTests();
  });
});
