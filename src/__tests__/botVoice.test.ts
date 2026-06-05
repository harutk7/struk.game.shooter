import { describe, it, expect } from 'vitest';
import { AudioManager } from '../audio/AudioManager';
import { BotVoice, type BotVoiceClip } from '../audio/BotVoice';

/**
 * Fake Web Audio graph rich enough for BotVoice: gain nodes (for the category
 * bus), buffer sources, PannerNodes (with the modern AudioParam position API),
 * and an AudioListener (also AudioParam-style).
 */
class FakeParam {
  constructor(public value = 0) {}
}

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

class FakePanner {
  panningModel = '';
  distanceModel = '';
  refDistance = 1;
  maxDistance = 0;
  rolloffFactor = 0;
  positionX = new FakeParam();
  positionY = new FakeParam();
  positionZ = new FakeParam();
  connected: any[] = [];
  connect(dest: any): void { this.connected.push(dest); }
}

class FakeListener {
  positionX = new FakeParam();
  positionY = new FakeParam();
  positionZ = new FakeParam();
  forwardX = new FakeParam();
  forwardY = new FakeParam();
  forwardZ = new FakeParam();
  upX = new FakeParam();
  upY = new FakeParam();
  upZ = new FakeParam();
}

class FakeAudioContext {
  state: 'running' | 'suspended' = 'running';
  destination = { id: 'destination' };
  listener = new FakeListener();
  pannersCreated: FakePanner[] = [];
  sourcesCreated: FakeBufferSource[] = [];
  createGain(): FakeGainNode { return new FakeGainNode(); }
  createBufferSource(): FakeBufferSource {
    const s = new FakeBufferSource();
    this.sourcesCreated.push(s);
    return s;
  }
  createPanner(): FakePanner {
    const p = new FakePanner();
    this.pannersCreated.push(p);
    return p;
  }
  async decodeAudioData(_data: ArrayBuffer): Promise<any> {
    return { duration: 0.4, _fake: true };
  }
  async resume(): Promise<void> { this.state = 'running'; }
  async suspend(): Promise<void> { this.state = 'suspended'; }
}

const CLIPS: BotVoiceClip[] = [
  { name: 'k1', file: 'bot_voice/kill_1.wav', category: 'kill' },
  { name: 'k2', file: 'bot_voice/kill_2.wav', category: 'kill' },
  { name: 'd1', file: 'bot_voice/death_1.wav', category: 'death' },
  { name: 's1', file: 'bot_voice/spotted_1.wav', category: 'spotted' },
];

async function makeHarness(now: () => number, rng: () => number = () => 0) {
  const ctx = new FakeAudioContext();
  const audio = new AudioManager({
    contextFactory: () => ctx as unknown as AudioContext,
    fetcher: async () => ({ arrayBuffer: async () => new ArrayBuffer(8) }),
  });
  // Load every clip buffer so playBotVoice has something to play.
  for (const c of CLIPS) {
    await audio.loadSound(c.name, `/${c.file}`);
  }
  const voice = new BotVoice({ audio, now, rng, clips: CLIPS, minIntervalMs: 4000, refDistance: 5 });
  return { ctx, audio, voice };
}

describe('BotVoice', () => {
  it('rate-limits a single bot to one voice line per 4s', async () => {
    let t = 1000;
    const { voice, ctx } = await makeHarness(() => t);

    const pos = { x: 1, y: 2, z: 3 };
    const results = [];
    for (let i = 0; i < 5; i++) {
      results.push(voice.playBotVoice('bot-1', 'kill', pos));
      t += 200; // five calls spread across ~1s
    }

    const played = results.filter((r) => r !== null);
    expect(played.length).toBe(1);
    // Exactly one source actually started.
    expect(ctx.sourcesCreated.filter((s) => s.started).length).toBe(1);
  });

  it('allows the bot to speak again after the interval elapses', async () => {
    let t = 1000;
    const { voice } = await makeHarness(() => t);
    const pos = { x: 0, y: 0, z: 0 };

    expect(voice.playBotVoice('bot-1', 'kill', pos)).not.toBeNull();
    t += 3999;
    expect(voice.playBotVoice('bot-1', 'kill', pos)).toBeNull();
    t += 2; // now > 4000ms since the first
    expect(voice.playBotVoice('bot-1', 'kill', pos)).not.toBeNull();
  });

  it('rate-limits each bot independently', async () => {
    const t = 5000;
    const { voice } = await makeHarness(() => t);
    const pos = { x: 0, y: 0, z: 0 };
    expect(voice.playBotVoice('bot-1', 'kill', pos)).not.toBeNull();
    expect(voice.playBotVoice('bot-2', 'kill', pos)).not.toBeNull();
    // ...but a second line from bot-1 at the same instant is suppressed.
    expect(voice.playBotVoice('bot-1', 'kill', pos)).toBeNull();
  });

  it('positions the PannerNode at the bot world position', async () => {
    const { voice } = await makeHarness(() => 0);
    const pos = { x: 12.5, y: 1.4, z: -7.25 };
    const panner = voice.playBotVoice('bot-9', 'spotted', pos) as unknown as FakePanner;
    expect(panner).not.toBeNull();
    expect(panner.positionX.value).toBe(12.5);
    expect(panner.positionY.value).toBe(1.4);
    expect(panner.positionZ.value).toBe(-7.25);
    expect(panner.refDistance).toBe(5);
  });

  it('updates the AudioContext listener to the player position', async () => {
    const { voice, ctx } = await makeHarness(() => 0);
    voice.updateListener({ x: -3, y: 1.7, z: 9 }, { x: 0, y: 0, z: -1 });
    expect(ctx.listener.positionX.value).toBe(-3);
    expect(ctx.listener.positionY.value).toBe(1.7);
    expect(ctx.listener.positionZ.value).toBe(9);
    expect(ctx.listener.forwardZ.value).toBe(-1);
    expect(ctx.listener.upY.value).toBe(1);
  });

  it('routes the voice into the sfx bus so it obeys volume', async () => {
    const { voice, audio } = await makeHarness(() => 0);
    const panner = voice.playBotVoice('bot-3', 'death', { x: 0, y: 0, z: 0 }) as unknown as FakePanner;
    expect(panner.connected).toContain(audio.sfxInput);
  });

  it('returns null for a category with no clips loaded', async () => {
    const ctx = new FakeAudioContext();
    const audio = new AudioManager({
      contextFactory: () => ctx as unknown as AudioContext,
      fetcher: async () => ({ arrayBuffer: async () => new ArrayBuffer(8) }),
    });
    audio.init(); // graph exists but no buffers loaded
    const voice = new BotVoice({ audio, now: () => 0, clips: CLIPS });
    expect(voice.playBotVoice('bot-1', 'kill', { x: 0, y: 0, z: 0 })).toBeNull();
  });

  it('no-ops updateListener and play before the context exists', () => {
    const audio = new AudioManager({
      contextFactory: () => new FakeAudioContext() as unknown as AudioContext,
      fetcher: async () => ({ arrayBuffer: async () => new ArrayBuffer(8) }),
    });
    const voice = new BotVoice({ audio, now: () => 0, clips: CLIPS });
    // No init() called → context is null; these must not throw.
    expect(() => voice.updateListener({ x: 0, y: 0, z: 0 })).not.toThrow();
    expect(voice.playBotVoice('bot-1', 'kill', { x: 0, y: 0, z: 0 })).toBeNull();
  });
});
