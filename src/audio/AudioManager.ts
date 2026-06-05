/**
 * AudioManager — singleton WebAudio foundation for all game sound.
 *
 * Responsibilities (T13 / workstream-B foundation):
 *  - Own a single lazily-created `AudioContext` (browser autoplay policy
 *    requires the context to be created/resumed inside a user gesture).
 *  - Provide category gain nodes (`master`, `sfx`, `ambient`) so volume can
 *    be controlled per-category and globally.
 *  - Load and cache decoded `AudioBuffer`s by name.
 *  - Fire-and-forget `play()` with optional per-play volume / category / loop.
 *
 * The class is intentionally dependency-injectable (`contextFactory`,
 * `fetcher`) so it can be unit-tested under Node/vitest where there is no
 * real `AudioContext` or DOM. Production code uses {@link getAudioManager}.
 *
 * OUT OF SCOPE for T13 (handled by later tasks): per-weapon gunfire (T14),
 * footsteps (T15) and true 3D positional audio via `PannerNode`. The
 * `position3d` play option is accepted for forward-compat but ignored here.
 */

export type SoundCategory = 'sfx' | 'ambient';

export interface PlayOptions {
  /** Per-play linear gain (0..1+). Defaults to 1. */
  volume?: number;
  /** Routing category. Defaults to 'sfx'. */
  category?: SoundCategory;
  /** Loop the source (e.g. ambient beds). Defaults to false. */
  loop?: boolean;
  /**
   * Reserved for future positional audio (T-later, needs PannerNode).
   * Accepted but currently ignored — see class docstring.
   */
  position3d?: { x: number; y: number; z: number };
}

export interface AudioManagerOptions {
  /** Factory for the AudioContext (injected in tests). */
  contextFactory?: () => AudioContext;
  /** Fetch implementation returning something with `arrayBuffer()` (injected in tests). */
  fetcher?: (url: string) => Promise<{ arrayBuffer(): Promise<ArrayBuffer> }>;
}

function defaultContextFactory(): AudioContext {
  const Ctx =
    (globalThis as any).AudioContext || (globalThis as any).webkitAudioContext;
  if (!Ctx) throw new Error('Web Audio API is not available in this environment');
  return new Ctx();
}

const defaultFetcher = (url: string) =>
  fetch(url).then((res) => {
    if (!res.ok) throw new Error(`Failed to fetch sound "${url}": HTTP ${res.status}`);
    return res;
  });

export class AudioManager {
  private readonly contextFactory: () => AudioContext;
  private readonly fetcher: (url: string) => Promise<{ arrayBuffer(): Promise<ArrayBuffer> }>;

  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private ambientGain: GainNode | null = null;

  private readonly buffers = new Map<string, AudioBuffer>();
  private readonly loading = new Map<string, Promise<AudioBuffer>>();

  // Volumes are remembered even before the context exists, then applied on
  // context creation. This lets the volume UI work pre-gesture.
  private volumes = { master: 1, sfx: 1, ambient: 1 };

  constructor(opts: AudioManagerOptions = {}) {
    this.contextFactory = opts.contextFactory ?? defaultContextFactory;
    this.fetcher = opts.fetcher ?? defaultFetcher;
  }

  /** True once the AudioContext (and gain graph) has been created. */
  get isInitialized(): boolean {
    return this.ctx !== null;
  }

  /** The underlying context, or null if not yet created. Mainly for tests. */
  get context(): AudioContext | null {
    return this.ctx;
  }

  /**
   * Lazily create the AudioContext and category gain graph. Must be called
   * from within a user gesture for audio to actually be allowed to play.
   * Safe to call repeatedly — only the first call creates anything.
   */
  init(): AudioContext {
    if (this.ctx) return this.ctx;

    const ctx = this.contextFactory();
    this.ctx = ctx;

    // master -> destination
    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = this.volumes.master;
    this.masterGain.connect(ctx.destination);

    // sfx -> master
    this.sfxGain = ctx.createGain();
    this.sfxGain.gain.value = this.volumes.sfx;
    this.sfxGain.connect(this.masterGain);

    // ambient -> master
    this.ambientGain = ctx.createGain();
    this.ambientGain.gain.value = this.volumes.ambient;
    this.ambientGain.connect(this.masterGain);

    return ctx;
  }

  /**
   * Fetch + decode a sound and cache it under `name`. Returns the decoded
   * buffer. Concurrent loads of the same name share one promise. A failed
   * fetch/decode rejects (it never throws synchronously / crashes the caller).
   */
  loadSound(name: string, url: string): Promise<AudioBuffer> {
    const cached = this.buffers.get(name);
    if (cached) return Promise.resolve(cached);

    const inFlight = this.loading.get(name);
    if (inFlight) return inFlight;

    const promise = (async () => {
      const ctx = this.init();
      const res = await this.fetcher(url);
      const data = await res.arrayBuffer();
      const buffer = await ctx.decodeAudioData(data);
      this.buffers.set(name, buffer);
      return buffer;
    })();

    // Track in-flight so repeat calls dedupe; clear the slot on settle.
    this.loading.set(name, promise);
    promise.finally(() => this.loading.delete(name)).catch(() => {});
    return promise;
  }

  /** Whether a decoded buffer is available for `name`. */
  hasSound(name: string): boolean {
    return this.buffers.has(name);
  }

  /**
   * Play a previously-loaded sound. No-ops gracefully (returns null) if the
   * buffer isn't loaded or the context isn't initialized, so callers in the
   * game loop never need a try/catch.
   */
  play(name: string, opts: PlayOptions = {}): AudioBufferSourceNode | null {
    const buffer = this.buffers.get(name);
    if (!buffer || !this.ctx) return null;

    const category = opts.category ?? 'sfx';
    const categoryGain = category === 'ambient' ? this.ambientGain : this.sfxGain;
    if (!categoryGain) return null;

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = opts.loop ?? false;

    const volume = opts.volume ?? 1;
    if (volume === 1) {
      source.connect(categoryGain);
    } else {
      const playGain = this.ctx.createGain();
      playGain.gain.value = volume;
      source.connect(playGain);
      playGain.connect(categoryGain);
    }

    source.start();
    return source;
  }

  setMasterVolume(v: number): void {
    this.volumes.master = clamp01(v);
    if (this.masterGain) this.masterGain.gain.value = this.volumes.master;
  }

  setSfxVolume(v: number): void {
    this.volumes.sfx = clamp01(v);
    if (this.sfxGain) this.sfxGain.gain.value = this.volumes.sfx;
  }

  setAmbientVolume(v: number): void {
    this.volumes.ambient = clamp01(v);
    if (this.ambientGain) this.ambientGain.gain.value = this.volumes.ambient;
  }

  getMasterVolume(): number {
    return this.volumes.master;
  }

  /** Suspend the context (silences everything, keeps state). */
  async pause(): Promise<void> {
    if (this.ctx && this.ctx.state === 'running') {
      await this.ctx.suspend();
    }
  }

  /**
   * Create the context if needed and resume it. Call this from a user gesture
   * to satisfy the browser autoplay policy.
   */
  async resume(): Promise<void> {
    const ctx = this.init();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
  }
}

function clamp01(v: number): number {
  if (Number.isNaN(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

let singleton: AudioManager | null = null;

/** Shared process-wide AudioManager used by the game. */
export function getAudioManager(): AudioManager {
  if (!singleton) singleton = new AudioManager();
  return singleton;
}

/** Reset the singleton — test-only helper. */
export function __resetAudioManagerForTests(): void {
  singleton = null;
}
