/**
 * BotVoice — short 3D-positional vocal callouts for AI bots (T19).
 *
 * Bots were silent cubes; this makes them feel like players by playing a short
 * grunt/shout on key combat events:
 *   - `spotted` — the bot just locked onto the player (engage state begins)
 *   - `reload`  — the bot started a reload
 *   - `death`   — the bot just died
 *   - `kill`    — the bot just got a confirmed kill
 *
 * Each clip is played through a `PannerNode` positioned at the bot's world
 * position, routed into the shared {@link AudioManager} `sfx` bus (so it obeys
 * the volume sliders). The AudioContext *listener* is moved to the player's
 * position every frame (see {@link BotVoice.updateListener}) so a callout
 * genuinely comes from the bot's direction.
 *
 * Rate-limiting: a single bot may not emit more than one voice line every
 * {@link BotVoiceOptions.minIntervalMs} (default 4000ms), so a bot that is
 * e.g. reloading repeatedly under fire doesn't machine-gun callouts.
 *
 * The class is dependency-injectable (`audio`, `now`, `rng`) so it can be unit
 * tested under Node/vitest with a fake AudioContext. Production code uses the
 * shared {@link getBotVoice} singleton.
 */

import { AudioManager, getAudioManager } from './AudioManager';

export type BotVoiceCategory = 'spotted' | 'reload' | 'death' | 'kill';

export interface BotVoiceClip {
  /** Cache key used with {@link AudioManager.loadSound} / `getBuffer`. */
  name: string;
  /** Path under `public/sounds/` (no leading slash), used for preloading. */
  file: string;
  /** Which event category this clip belongs to. */
  category: BotVoiceCategory;
}

/**
 * The shipped clip manifest. These are small procedurally-generated CC0 WAV
 * placeholders (see `scripts/gen_bot_voice_sounds.mjs` and CREDITS.md). The
 * distribution favours the events the player hears most (spotted/death).
 */
export const BOT_VOICE_CLIPS: BotVoiceClip[] = [
  { name: 'botvoice_spotted_1', file: 'bot_voice/spotted_1.wav', category: 'spotted' },
  { name: 'botvoice_spotted_2', file: 'bot_voice/spotted_2.wav', category: 'spotted' },
  { name: 'botvoice_spotted_3', file: 'bot_voice/spotted_3.wav', category: 'spotted' },
  { name: 'botvoice_reload_1', file: 'bot_voice/reload_1.wav', category: 'reload' },
  { name: 'botvoice_reload_2', file: 'bot_voice/reload_2.wav', category: 'reload' },
  { name: 'botvoice_death_1', file: 'bot_voice/death_1.wav', category: 'death' },
  { name: 'botvoice_death_2', file: 'bot_voice/death_2.wav', category: 'death' },
  { name: 'botvoice_death_3', file: 'bot_voice/death_3.wav', category: 'death' },
  { name: 'botvoice_kill_1', file: 'bot_voice/kill_1.wav', category: 'kill' },
  { name: 'botvoice_kill_2', file: 'bot_voice/kill_2.wav', category: 'kill' },
];

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface BotVoiceOptions {
  /** AudioManager to play through. Defaults to the shared singleton. */
  audio?: AudioManager;
  /** Millisecond clock (injected in tests). Defaults to performance.now. */
  now?: () => number;
  /** RNG in [0,1) for clip selection (injected in tests). Defaults to Math.random. */
  rng?: () => number;
  /** Minimum gap between voice lines from the *same* bot. Default 4000ms. */
  minIntervalMs?: number;
  /** PannerNode reference distance in metres. Default 5. */
  refDistance?: number;
  /** Clip manifest. Defaults to {@link BOT_VOICE_CLIPS}. */
  clips?: BotVoiceClip[];
}

function defaultNow(): number {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : 0;
}

export class BotVoice {
  private readonly audio: AudioManager;
  private readonly now: () => number;
  private readonly rng: () => number;
  private readonly minIntervalMs: number;
  private readonly refDistance: number;
  private readonly clipsByCategory: Map<BotVoiceCategory, BotVoiceClip[]>;
  private readonly allClips: BotVoiceClip[];

  /** Last time (ms) each bot was allowed to speak — for rate-limiting. */
  private readonly lastPlayByBot = new Map<string, number>();

  constructor(opts: BotVoiceOptions = {}) {
    this.audio = opts.audio ?? getAudioManager();
    this.now = opts.now ?? defaultNow;
    this.rng = opts.rng ?? Math.random;
    this.minIntervalMs = opts.minIntervalMs ?? 4000;
    this.refDistance = opts.refDistance ?? 5;
    this.allClips = opts.clips ?? BOT_VOICE_CLIPS;

    this.clipsByCategory = new Map();
    for (const clip of this.allClips) {
      const list = this.clipsByCategory.get(clip.category) ?? [];
      list.push(clip);
      this.clipsByCategory.set(clip.category, list);
    }
  }

  /**
   * Preload every voice clip through the shared AudioManager. Fire-and-forget;
   * individual failures are swallowed so a missing file never breaks the game.
   * @param baseUrl Vite `import.meta.env.BASE_URL` (or '/').
   */
  async preload(baseUrl = '/'): Promise<void> {
    const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
    await Promise.all(
      this.allClips.map((c) =>
        this.audio.loadSound(c.name, `${base}sounds/${c.file}`).catch(() => null),
      ),
    );
  }

  /**
   * Move the AudioContext listener to the player's position (call once per
   * frame). Handles both the modern AudioParam listener API and the legacy
   * `setPosition`/`setOrientation` methods. No-ops if audio isn't initialized.
   */
  updateListener(position: Vec3, forward?: { x: number; y: number; z: number }): void {
    const ctx = this.audio.context;
    if (!ctx) return;
    const listener = ctx.listener as AudioListener & {
      setPosition?: (x: number, y: number, z: number) => void;
      setOrientation?: (
        fx: number, fy: number, fz: number, ux: number, uy: number, uz: number,
      ) => void;
    };
    if (!listener) return;

    if (listener.positionX) {
      listener.positionX.value = position.x;
      listener.positionY.value = position.y;
      listener.positionZ.value = position.z;
    } else if (typeof listener.setPosition === 'function') {
      listener.setPosition(position.x, position.y, position.z);
    }

    if (forward) {
      if (listener.forwardX) {
        listener.forwardX.value = forward.x;
        listener.forwardY.value = forward.y;
        listener.forwardZ.value = forward.z;
        listener.upX.value = 0;
        listener.upY.value = 1;
        listener.upZ.value = 0;
      } else if (typeof listener.setOrientation === 'function') {
        listener.setOrientation(forward.x, forward.y, forward.z, 0, 1, 0);
      }
    }
  }

  /**
   * Play a random clip from `category` at `position` as a 3D-positional SFX.
   *
   * Returns the created PannerNode (handy for tests / debugging), or null if
   * the call was rate-limited, the category has no clips, the clip isn't
   * loaded yet, or the audio graph isn't initialized. The rate-limit clock is
   * only advanced when a sound actually starts, so a clip that hasn't finished
   * loading doesn't "use up" the bot's slot.
   */
  playBotVoice(botId: string, category: BotVoiceCategory, position: Vec3): PannerNode | null {
    const now = this.now();
    const last = this.lastPlayByBot.get(botId);
    if (last !== undefined && now - last < this.minIntervalMs) return null;

    const clips = this.clipsByCategory.get(category);
    if (!clips || clips.length === 0) return null;

    const ctx = this.audio.context;
    const dest = this.audio.sfxInput;
    if (!ctx || !dest) return null;

    const clip = clips[Math.floor(this.rng() * clips.length) % clips.length];
    const buffer = this.audio.getBuffer(clip.name);
    if (!buffer) return null;

    const panner = ctx.createPanner();
    panner.panningModel = 'HRTF';
    panner.distanceModel = 'inverse';
    panner.refDistance = this.refDistance;
    panner.maxDistance = 100;
    panner.rolloffFactor = 1;
    this.setPannerPosition(panner, position);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(panner);
    panner.connect(dest);
    source.start();

    this.lastPlayByBot.set(botId, now);
    return panner;
  }

  /** Reset rate-limit bookkeeping (e.g. on a new match). */
  reset(): void {
    this.lastPlayByBot.clear();
  }

  private setPannerPosition(panner: PannerNode, position: Vec3): void {
    const p = panner as PannerNode & {
      setPosition?: (x: number, y: number, z: number) => void;
    };
    if (panner.positionX) {
      panner.positionX.value = position.x;
      panner.positionY.value = position.y;
      panner.positionZ.value = position.z;
    } else if (typeof p.setPosition === 'function') {
      p.setPosition(position.x, position.y, position.z);
    }
  }
}

let singleton: BotVoice | null = null;

/** Shared process-wide BotVoice bound to the shared AudioManager. */
export function getBotVoice(): BotVoice {
  if (!singleton) singleton = new BotVoice();
  return singleton;
}

/** Reset the singleton — test-only helper. */
export function __resetBotVoiceForTests(): void {
  singleton = null;
}
