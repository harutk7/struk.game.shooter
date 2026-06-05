import { describe, it, expect } from 'vitest';
import {
  FootstepSFX,
  getFootstepSFX,
  __resetFootstepSFXForTests,
  PLAYER_STEP_INTERVAL_MS,
} from '../audio/FootstepSFX';
import type { FootstepBackend } from '../audio/FootstepSFX';

/**
 * Minimal fake Web Audio graph so FootstepSFX can be exercised under
 * Node/vitest, which has no real `AudioContext`.
 */
class FakeAudioParam {
  value = 0;
  events: Array<[string, number, number]> = [];
  setValueAtTime(v: number, t: number): this {
    this.value = v;
    this.events.push(['set', v, t]);
    return this;
  }
  linearRampToValueAtTime(v: number, t: number): this {
    this.events.push(['ramp', v, t]);
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
  gains: FakeGain[] = [];
  createBufferSource(): FakeBufferSource {
    const s = new FakeBufferSource();
    this.sources.push(s);
    return s;
  }
  createPanner(): FakePanner {
    return new FakePanner();
  }
  createGain(): FakeGain {
    const g = new FakeGain();
    this.gains.push(g);
    return g;
  }
}

/** A fake AudioManager backend that records play() calls. */
function makeBackend() {
  const ctx = new FakeAudioContext();
  const played: Array<{ name: string; opts: any }> = [];
  const lastSources: FakeBufferSource[] = [];
  const backend: FootstepBackend = {
    async loadSound(_name: string, _url: string) {
      // Return a distinct fake AudioBuffer per sound.
      return { duration: 0.15, _name } as unknown as AudioBuffer;
    },
    play(name: string, opts?: any) {
      played.push({ name, opts });
      const src = new FakeBufferSource();
      lastSources.push(src);
      return src as unknown as AudioBufferSourceNode;
    },
    init() {
      return ctx as unknown as AudioContext;
    },
    get context() {
      return ctx as unknown as AudioContext;
    },
  };
  return { backend, ctx, played, lastSources };
}

describe('FootstepSFX', () => {
  it('rate-limits player footsteps (10 calls in 100ms => 1 SFX)', () => {
    const { backend, played } = makeBackend();
    let t = 0;
    const sfx = new FootstepSFX({ manager: backend, clock: () => t, rng: () => 0.0 });
    // Ten rapid calls, all within a 100ms window (t advances 10ms each).
    for (let i = 0; i < 10; i++) {
      sfx.playPlayerFootstep('concrete');
      t += 10;
    }
    expect(played.length).toBe(1);
    expect(played[0].name.startsWith('concrete_')).toBe(true);
  });

  it('plays another player footstep once the stride interval has elapsed', () => {
    const { backend, played } = makeBackend();
    let t = 0;
    const sfx = new FootstepSFX({ manager: backend, clock: () => t, rng: () => 0.0 });
    sfx.playPlayerFootstep('concrete');
    t += PLAYER_STEP_INTERVAL_MS + 1;
    sfx.playPlayerFootstep('concrete');
    expect(played.length).toBe(2);
  });

  it('applies a playbackRate jitter to player footsteps', () => {
    const { backend, lastSources } = makeBackend();
    const sfx = new FootstepSFX({ manager: backend, clock: () => 0, rng: () => 1.0 });
    sfx.playPlayerFootstep('concrete');
    // rng()===1 => 1 + (1-0.5)*0.6 = 1.3 (top of the jitter window).
    expect(lastSources[0].playbackRate.value).toBeCloseTo(1.3, 5);
  });

  it('routes player footsteps through the sfx category', () => {
    const { backend, played } = makeBackend();
    const sfx = new FootstepSFX({ manager: backend, clock: () => 0 });
    sfx.playPlayerFootstep('dirt');
    expect(played[0].opts.category).toBe('sfx');
    expect(played[0].name.startsWith('dirt_')).toBe(true);
  });

  it('creates a 3D-panned PannerNode with the position set for bot footsteps', async () => {
    const { backend, ctx } = makeBackend();
    const sfx = new FootstepSFX({ manager: backend, clock: () => 0, rng: () => 0 });
    await sfx.loadAll('/');
    const panner = sfx.playBotFootstep('bot-1', [10, 0, 0]);
    expect(panner).not.toBeNull();
    expect((panner as any).positionX.value).toBe(10);
    expect((panner as any).positionY.value).toBe(0);
    expect((panner as any).positionZ.value).toBe(0);
    // The source should ultimately reach the context destination.
    expect((panner as any).connected.length).toBeGreaterThan(0);
    void ctx;
  });

  it('rate-limits bot footsteps per bot id', async () => {
    const { backend } = makeBackend();
    let t = 0;
    const sfx = new FootstepSFX({ manager: backend, clock: () => t, rng: () => 0 });
    await sfx.loadAll('/');
    expect(sfx.playBotFootstep('bot-1', [1, 0, 0])).not.toBeNull();
    expect(sfx.playBotFootstep('bot-1', [1, 0, 0])).toBeNull(); // same window => suppressed
    // A different bot is tracked independently.
    expect(sfx.playBotFootstep('bot-2', [1, 0, 0])).not.toBeNull();
    t += 400;
    expect(sfx.playBotFootstep('bot-1', [1, 0, 0])).not.toBeNull(); // window elapsed
  });

  it('no-ops bot footsteps gracefully when no buffer is loaded', () => {
    const { backend } = makeBackend();
    const sfx = new FootstepSFX({ manager: backend, clock: () => 0 });
    // loadAll never called -> no buffers mirrored.
    expect(sfx.playBotFootstep('bot-1', [10, 0, 0])).toBeNull();
  });

  it('starts the ambient bed looping and fades it in over 2s', async () => {
    const { backend, ctx } = makeBackend();
    (ctx as any).currentTime = 5;
    const sfx = new FootstepSFX({ manager: backend, clock: () => 0 });
    await sfx.startAmbient();

    // A looping buffer source must have been created and started.
    const loopSource = ctx.sources.find((s) => s.loop);
    expect(loopSource).toBeDefined();
    expect(loopSource!.started).toBe(true);

    // Its gain must ramp from 0 (at currentTime) up to the low ambient volume
    // 2 seconds later — the 2s fade-in.
    const fadeGain = ctx.gains.find((g) => g.gain.events.some((e) => e[0] === 'ramp'));
    expect(fadeGain).toBeDefined();
    const setEvent = fadeGain!.gain.events.find((e) => e[0] === 'set');
    const rampEvent = fadeGain!.gain.events.find((e) => e[0] === 'ramp');
    expect(setEvent).toEqual(['set', 0, 5]); // start silent at currentTime=5
    expect(rampEvent![1]).toBeGreaterThan(0); // ramps up to a positive volume
    expect(rampEvent![2]).toBe(7); // currentTime(5) + 2s fade

    // A second start is a no-op (no second looping source created).
    await sfx.startAmbient();
    expect(ctx.sources.filter((s) => s.loop).length).toBe(1);
  });

  it('getFootstepSFX() returns a stable singleton', () => {
    __resetFootstepSFXForTests();
    const a = getFootstepSFX();
    const b = getFootstepSFX();
    expect(a).toBe(b);
    __resetFootstepSFXForTests();
  });
});
