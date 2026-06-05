/**
 * FootstepSFX — player + bot footsteps and the ambient soundscape (T15 /
 * workstream-B). Thin layer on top of the T13 {@link AudioManager}.
 *
 * Responsibilities:
 *  - Surface-aware footstep pools ('concrete' | 'dirt'), with a random,
 *    non-repeating picker and a per-step playbackRate jitter so consecutive
 *    steps never sound identical (repetition fatigue).
 *  - Rate-limited player footsteps (one step every ~0.35s) so a held movement
 *    key can't machine-gun footstep spam.
 *  - 3D-positional bot footsteps via a {@link PannerNode}, rate-limited
 *    per-bot, so you can hear which direction a bot is running from.
 *  - A low ambient bed that loops and fades in over 2s when the match starts.
 *
 * Design notes (kept deliberately self-contained to avoid editing T13's
 * AudioManager, per the task's out-of-scope rule):
 *  - Decoded buffers are loaded *through* the AudioManager (so its cache is
 *    shared and the loader/dedupe logic is reused) but also mirrored locally so
 *    we can build our own positional / fading graphs from them.
 *  - Player footsteps route through `AudioManager.play()` and therefore respect
 *    the sfx + master volume sliders.
 *  - Bot footsteps (PannerNode) and the ambient bed (fade gain) need graph
 *    nodes the AudioManager keeps private, so they connect straight to the
 *    context destination. "Basic PannerNode is fine" per the spec.
 *
 * SFX ship as procedurally-generated CC0 **WAV** files (no OGG encoder in CI —
 * same precedent as T13/T14). See scripts/gen_footstep_sounds.mjs and CREDITS.md.
 */

import { getAudioManager } from './AudioManager';
import type { PlayOptions } from './AudioManager';

export type Surface = 'concrete' | 'dirt';

/** A 3D position for positional audio — array or object form both accepted. */
export type Vec3 = [number, number, number] | { x: number; y: number; z: number };

/**
 * Minimal surface of the AudioManager that FootstepSFX needs (injectable for
 * tests). AudioManager satisfies this structurally.
 */
export interface FootstepBackend {
  loadSound(name: string, url: string): Promise<AudioBuffer>;
  play(name: string, opts?: PlayOptions): AudioBufferSourceNode | null;
  init(): AudioContext;
  readonly context: AudioContext | null;
}

/** Sound-bank names for each surface (keys into the loaded-buffer cache). */
const SURFACE_VARIANTS: Record<Surface, readonly string[]> = {
  concrete: ['concrete_1', 'concrete_2', 'concrete_3', 'concrete_4'],
  dirt: ['dirt_1', 'dirt_2', 'dirt_3', 'dirt_4'],
};

/** Ambient bed variants — the first that loads is used as the loop. */
const AMBIENT_VARIANTS = ['ambient_hum', 'ambient_wind'] as const;

/** Minimum gap between successive player footsteps (ms). ~0.35s stride. */
export const PLAYER_STEP_INTERVAL_MS = 350;
/** Minimum gap between successive footsteps for a single bot (ms). */
export const BOT_STEP_INTERVAL_MS = 350;

const PLAYER_STEP_VOLUME = 0.5;
const BOT_STEP_VOLUME = 0.45;
const AMBIENT_VOLUME = 0.25;
const AMBIENT_FADE_SECONDS = 2;

/** Width of the random playbackRate jitter window centred on 1.0 (= 0.6x). */
const PLAYBACK_RATE_JITTER = 0.6;

export interface FootstepSFXOptions {
  /** Audio backend to route through. Defaults to the shared AudioManager singleton. */
  manager?: FootstepBackend;
  /** RNG in [0,1). Injectable for deterministic tests. Defaults to Math.random. */
  rng?: () => number;
  /** Monotonic clock in ms. Injectable for tests. Defaults to performance.now. */
  clock?: () => number;
  /** Base URL for asset paths (Vite `BASE_URL`). Defaults to '/'. */
  baseUrl?: string;
}

export class FootstepSFX {
  private readonly manager: FootstepBackend;
  private readonly rng: () => number;
  private readonly clock: () => number;
  private readonly baseUrl: string;

  /** Local mirror of decoded buffers, for building positional/fading graphs. */
  private readonly buffers = new Map<string, AudioBuffer>();
  /** Last variant index played per surface, to avoid an immediate repeat. */
  private readonly lastIndex = new Map<Surface, number>();
  /** Timestamp (ms) of the last player footstep, for rate limiting. */
  private lastPlayerStepAt = -Infinity;
  /** Timestamp (ms) of the last footstep per bot id, for per-bot rate limiting. */
  private readonly lastBotStepAt = new Map<string, number>();

  private ambientStarted = false;
  private ambientSource: AudioBufferSourceNode | null = null;
  private ambientLoad: Promise<void> | null = null;

  constructor(opts: FootstepSFXOptions = {}) {
    this.manager = opts.manager ?? getAudioManager();
    this.rng = opts.rng ?? Math.random;
    this.clock = opts.clock ?? defaultClock;
    this.baseUrl = opts.baseUrl ?? '/';
  }

  /**
   * Load every footstep variant + the ambient beds into the AudioManager (and
   * mirror the decoded buffers locally). Per-file failures are swallowed so a
   * single missing asset never rejects the whole preload — the game degrades to
   * silence for that sound. Resolves once all loads have settled.
   */
  async loadAll(baseOverride?: string): Promise<void> {
    const base = baseOverride ?? this.baseUrl;
    const jobs: Promise<unknown>[] = [];
    for (const variants of Object.values(SURFACE_VARIANTS)) {
      for (const name of variants) {
        jobs.push(this.loadInto(name, `${base}sounds/footsteps/${name}.wav`));
      }
    }
    jobs.push(this.loadAmbient(base));
    await Promise.all(jobs);
  }

  /**
   * Play a player footstep on the given surface. Rate-limited to one step per
   * {@link PLAYER_STEP_INTERVAL_MS}: calling repeatedly inside that window
   * (e.g. every animation frame while a movement key is held) plays at most one
   * SFX. No-ops gracefully if no buffer is loaded — never throws.
   */
  playPlayerFootstep(surface: Surface): void {
    const now = this.clock();
    if (now - this.lastPlayerStepAt < PLAYER_STEP_INTERVAL_MS) return;
    this.lastPlayerStepAt = now;

    const name = this.pick(surface);
    if (!name) return;
    const source = this.manager.play(name, { category: 'sfx', volume: PLAYER_STEP_VOLUME });
    if (source) source.playbackRate.value = this.jitter();
  }

  /**
   * Play a bot footstep at a world position, panned in 3D so direction is
   * audible. Rate-limited per bot id. Returns the {@link PannerNode} used (or
   * null if audio isn't ready / the buffer is missing) — handy for tests and
   * for callers that want to keep updating the position.
   */
  playBotFootstep(botId: string, position: Vec3, surface: Surface = 'concrete'): PannerNode | null {
    const now = this.clock();
    const last = this.lastBotStepAt.get(botId) ?? -Infinity;
    if (now - last < BOT_STEP_INTERVAL_MS) return null;

    const ctx = this.manager.context ?? this.manager.init();
    if (!ctx) return null;
    const name = this.pick(surface);
    const buffer = name ? this.buffers.get(name) : undefined;
    if (!buffer) return null;

    this.lastBotStepAt.set(botId, now);

    const [x, y, z] = toXYZ(position);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = this.jitter();

    const panner = ctx.createPanner();
    panner.panningModel = 'HRTF';
    panner.distanceModel = 'inverse';
    panner.refDistance = 1;
    panner.maxDistance = 60;
    panner.rolloffFactor = 1;
    setPannerPosition(panner, x, y, z);

    const gain = ctx.createGain();
    gain.gain.value = BOT_STEP_VOLUME;

    source.connect(panner);
    panner.connect(gain);
    gain.connect(ctx.destination);
    source.start();

    return panner;
  }

  /**
   * Start the ambient bed looping at low volume, fading in over 2s. Idempotent
   * — only the first call starts anything. Ensures the ambient buffer is loaded
   * first, so callers can fire it the instant a match begins.
   */
  async startAmbient(): Promise<void> {
    if (this.ambientStarted) return;
    const ctx = this.manager.init();
    if (!ctx) return;
    await this.loadAmbient();
    if (this.ambientStarted) return; // guard against a concurrent start

    const name = AMBIENT_VARIANTS.find((n) => this.buffers.has(n));
    const buffer = name ? this.buffers.get(name) : undefined;
    if (!buffer) return;

    this.ambientStarted = true;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const gain = ctx.createGain();
    const t0 = ctx.currentTime;
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(AMBIENT_VOLUME, t0 + AMBIENT_FADE_SECONDS);

    source.connect(gain);
    gain.connect(ctx.destination);
    source.start();
    this.ambientSource = source;
  }

  /** Stop the ambient bed (e.g. when leaving a match). Safe to call anytime. */
  stopAmbient(): void {
    if (this.ambientSource) {
      try {
        this.ambientSource.stop();
      } catch {
        /* already stopped */
      }
      this.ambientSource = null;
    }
    this.ambientStarted = false;
  }

  /** Load the ambient beds once (deduped). */
  private loadAmbient(base = this.baseUrl): Promise<void> {
    if (!this.ambientLoad) {
      this.ambientLoad = Promise.all(
        AMBIENT_VARIANTS.map((name) => this.loadInto(name, `${base}sounds/ambient/${name}.wav`)),
      ).then(() => undefined);
    }
    return this.ambientLoad;
  }

  /** Load a single sound through the manager and mirror its buffer locally. */
  private async loadInto(name: string, url: string): Promise<void> {
    try {
      const buffer = await this.manager.loadSound(name, url);
      this.buffers.set(name, buffer);
    } catch {
      /* missing asset -> degrade to silence for this sound */
    }
  }

  /** Choose a variant name for a surface, avoiding an immediate repeat. */
  private pick(surface: Surface): string | null {
    const variants = SURFACE_VARIANTS[surface];
    if (!variants || variants.length === 0) return null;
    if (variants.length === 1) return variants[0];
    let idx = Math.floor(this.rng() * variants.length);
    if (idx >= variants.length) idx = variants.length - 1; // guard rng() === 1
    if (idx < 0) idx = 0;
    if (idx === this.lastIndex.get(surface)) {
      idx = (idx + 1) % variants.length; // bump off the last-played variant
    }
    this.lastIndex.set(surface, idx);
    return variants[idx];
  }

  /** A playbackRate centred on 1.0 within a ±(jitter/2) window. */
  private jitter(): number {
    return 1 + (this.rng() - 0.5) * PLAYBACK_RATE_JITTER;
  }
}

/** Default clock: high-res when available, else 0 (tests inject their own). */
function defaultClock(): number {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : 0;
}

function toXYZ(p: Vec3): [number, number, number] {
  return Array.isArray(p) ? p : [p.x, p.y, p.z];
}

/** Set a PannerNode's position, preferring the modern AudioParam API. */
function setPannerPosition(panner: PannerNode, x: number, y: number, z: number): void {
  if (panner.positionX) {
    panner.positionX.value = x;
    panner.positionY.value = y;
    panner.positionZ.value = z;
  } else if (typeof (panner as unknown as { setPosition?: unknown }).setPosition === 'function') {
    (panner as unknown as { setPosition(x: number, y: number, z: number): void }).setPosition(x, y, z);
  }
}

let singleton: FootstepSFX | null = null;

/** Shared process-wide FootstepSFX used by the game. */
export function getFootstepSFX(): FootstepSFX {
  if (!singleton) singleton = new FootstepSFX();
  return singleton;
}

/** Reset the singleton — test-only helper. */
export function __resetFootstepSFXForTests(): void {
  singleton = null;
}
