/**
 * DamageSFX — damage-related sound effects (T16 / workstream-B). Thin layer on
 * top of the T13 {@link AudioManager}, in the same spirit as T15's
 * {@link FootstepSFX}.
 *
 * Responsibilities:
 *  - `playPlayerPain(damage)` — a random male pain grunt when the player takes
 *    a hit. Volume scales with the damage dealt (light tap → quiet, heavy hit →
 *    full), rate-limited to one grunt per 0.5s so a burst of fire can't stack a
 *    wall of grunts. Non-positional (it's the player themselves), so it routes
 *    through `AudioManager.play()` and respects the sfx + master sliders.
 *  - `playBotDeath(botId, position)` — the bot's guttural death scream, played
 *    at the bot's world position with 3D panning so you can hear which direction
 *    the kill came from. Rate-limited per bot id. (Distinct from T19's "got the
 *    kill" voice callout — this is the death sound itself.)
 *  - `playImpact(position, surface)` — the bullet-hits-a-surface thwack, picked
 *    from the matching surface pool ('concrete' | 'metal') and played
 *    3D-positioned. Rate-limited per surface so a shotgun's pellet spread hitting
 *    one wall collapses to a single thwack.
 *
 * Design notes (mirrors FootstepSFX, kept self-contained so T13's AudioManager
 * is not modified, per the task's out-of-scope rule):
 *  - Buffers are loaded *through* the AudioManager (shared cache + dedupe) and
 *    mirrored locally so we can build our own positional graphs from them.
 *  - Positional sounds (bot death, impact) build a PannerNode graph that connects
 *    straight to the context destination, since the AudioManager keeps its gain
 *    nodes private. "Basic PannerNode is fine" per the spec.
 *
 * SFX ship as procedurally-generated CC0 **WAV** files (no OGG encoder in CI —
 * same precedent as T13/T14/T15). See scripts/gen_damage_sounds.mjs and CREDITS.md.
 */

import { getAudioManager } from './AudioManager';
import type { PlayOptions } from './AudioManager';

/** Surfaces a bullet can impact. Wood/dirt are intentionally out of scope (T16). */
export type ImpactSurface = 'concrete' | 'metal';

/** A 3D position for positional audio — array or object form both accepted. */
export type Vec3 = [number, number, number] | { x: number; y: number; z: number };

/**
 * Minimal surface of the AudioManager that DamageSFX needs (injectable for
 * tests). AudioManager satisfies this structurally.
 */
export interface DamageBackend {
  loadSound(name: string, url: string): Promise<AudioBuffer>;
  play(name: string, opts?: PlayOptions): AudioBufferSourceNode | null;
  init(): AudioContext;
  readonly context: AudioContext | null;
}

/** Pain-grunt pool (keys into the loaded-buffer cache). */
const PAIN_VARIANTS = ['pain_1', 'pain_2', 'pain_3'] as const;
/** Bot death-scream pool. */
const DEATH_VARIANTS = ['death_1', 'death_2', 'death_3'] as const;
/** Per-surface impact pools. */
const IMPACT_VARIANTS: Record<ImpactSurface, readonly string[]> = {
  concrete: ['impact_concrete_1', 'impact_concrete_2'],
  metal: ['impact_metal_1', 'impact_metal_2'],
};

/** Minimum gap between successive player pain grunts (ms) — once per 0.5s. */
export const PLAYER_PAIN_INTERVAL_MS = 500;
/** Minimum gap between successive death screams for a single bot (ms). */
export const BOT_DEATH_INTERVAL_MS = 500;
/** Minimum gap between successive impacts on the same surface (ms). */
export const IMPACT_INTERVAL_MS = 60;

/** Damage at/above which the pain grunt plays at full volume. */
const HEAVY_DAMAGE = 40;
/** Volume floor for the lightest hit. */
const PAIN_MIN_VOLUME = 0.3;
/** Volume ceiling for a heavy hit. */
const PAIN_MAX_VOLUME = 1.0;

const DEATH_VOLUME = 0.85;
const IMPACT_VOLUME = 0.6;

export interface DamageSFXOptions {
  /** Audio backend to route through. Defaults to the shared AudioManager singleton. */
  manager?: DamageBackend;
  /** RNG in [0,1). Injectable for deterministic tests. Defaults to Math.random. */
  rng?: () => number;
  /** Monotonic clock in ms. Injectable for tests. Defaults to performance.now. */
  clock?: () => number;
  /** Base URL for asset paths (Vite `BASE_URL`). Defaults to '/'. */
  baseUrl?: string;
}

export class DamageSFX {
  private readonly manager: DamageBackend;
  private readonly rng: () => number;
  private readonly clock: () => number;
  private readonly baseUrl: string;

  /** Local mirror of decoded buffers, for building positional graphs. */
  private readonly buffers = new Map<string, AudioBuffer>();
  /** Last variant index played per pool key, to avoid an immediate repeat. */
  private readonly lastIndex = new Map<string, number>();

  /** Timestamp (ms) of the last player pain grunt, for rate limiting. */
  private lastPainAt = -Infinity;
  /** Timestamp (ms) of the last death scream per bot id. */
  private readonly lastDeathAt = new Map<string, number>();
  /** Timestamp (ms) of the last impact per surface. */
  private readonly lastImpactAt = new Map<ImpactSurface, number>();

  constructor(opts: DamageSFXOptions = {}) {
    this.manager = opts.manager ?? getAudioManager();
    this.rng = opts.rng ?? Math.random;
    this.clock = opts.clock ?? defaultClock;
    this.baseUrl = opts.baseUrl ?? '/';
  }

  /**
   * Load every damage SFX variant into the AudioManager (and mirror the decoded
   * buffers locally). Per-file failures are swallowed so a single missing asset
   * never rejects the whole preload — the game degrades to silence for that
   * sound. Resolves once all loads have settled.
   */
  async loadAll(baseOverride?: string): Promise<void> {
    const base = baseOverride ?? this.baseUrl;
    const jobs: Promise<unknown>[] = [];
    for (const name of PAIN_VARIANTS) {
      jobs.push(this.loadInto(name, `${base}sounds/player/${name}.wav`));
    }
    for (const name of DEATH_VARIANTS) {
      jobs.push(this.loadInto(name, `${base}sounds/hit/${name}.wav`));
    }
    for (const variants of Object.values(IMPACT_VARIANTS)) {
      for (const name of variants) {
        jobs.push(this.loadInto(name, `${base}sounds/impact/${name}.wav`));
      }
    }
    await Promise.all(jobs);
  }

  /**
   * Play a player pain grunt. Volume scales with `damage` from
   * {@link PAIN_MIN_VOLUME} (light) up to {@link PAIN_MAX_VOLUME} (a hit of
   * {@link HEAVY_DAMAGE}+). Rate-limited to one grunt per
   * {@link PLAYER_PAIN_INTERVAL_MS}: calling repeatedly inside that window plays
   * at most one SFX. No-ops gracefully if no buffer is loaded — never throws.
   */
  playPlayerPain(damage: number): AudioBufferSourceNode | null {
    const now = this.clock();
    if (now - this.lastPainAt < PLAYER_PAIN_INTERVAL_MS) return null;

    const name = this.pick('pain', PAIN_VARIANTS);
    if (!name) return null;
    this.lastPainAt = now;

    const volume = painVolume(damage);
    return this.manager.play(name, { category: 'sfx', volume });
  }

  /**
   * Play a bot's death scream at its world position, panned in 3D so the kill's
   * direction is audible. Rate-limited per bot id. Returns the {@link PannerNode}
   * used (or null if audio isn't ready / the buffer is missing).
   */
  playBotDeath(botId: string, position: Vec3): PannerNode | null {
    const now = this.clock();
    const last = this.lastDeathAt.get(botId) ?? -Infinity;
    if (now - last < BOT_DEATH_INTERVAL_MS) return null;

    const name = this.pick('death', DEATH_VARIANTS);
    const panner = this.playPositional(name, position, DEATH_VOLUME);
    if (panner) this.lastDeathAt.set(botId, now);
    return panner;
  }

  /**
   * Play a bullet-impact thwack at a world position, picking from the pool that
   * matches `surface` and panning it in 3D. Rate-limited per surface so a single
   * multi-pellet shot hitting one wall doesn't stack thwacks. Returns the
   * {@link PannerNode} used (or null if audio isn't ready / the buffer is missing).
   */
  playImpact(position: Vec3, surface: ImpactSurface): PannerNode | null {
    const variants = IMPACT_VARIANTS[surface];
    if (!variants) return null;

    const now = this.clock();
    const last = this.lastImpactAt.get(surface) ?? -Infinity;
    if (now - last < IMPACT_INTERVAL_MS) return null;

    const name = this.pick(`impact_${surface}`, variants);
    const panner = this.playPositional(name, position, IMPACT_VOLUME);
    if (panner) this.lastImpactAt.set(surface, now);
    return panner;
  }

  /**
   * Build a one-shot 3D-panned graph (source → panner → gain → destination) for
   * `name` at `position`. Shared by bot-death and impact. Returns null if audio
   * isn't ready or the buffer hasn't been mirrored locally.
   */
  private playPositional(name: string | null, position: Vec3, volume: number): PannerNode | null {
    if (!name) return null;
    const ctx = this.manager.context ?? this.manager.init();
    if (!ctx) return null;
    const buffer = this.buffers.get(name);
    if (!buffer) return null;

    const [x, y, z] = toXYZ(position);
    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const panner = ctx.createPanner();
    panner.panningModel = 'HRTF';
    panner.distanceModel = 'inverse';
    panner.refDistance = 1;
    panner.maxDistance = 60;
    panner.rolloffFactor = 1;
    setPannerPosition(panner, x, y, z);

    const gain = ctx.createGain();
    gain.gain.value = volume;

    source.connect(panner);
    panner.connect(gain);
    gain.connect(ctx.destination);
    source.start();

    return panner;
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

  /** Choose a variant name from a pool, avoiding an immediate repeat. */
  private pick(poolKey: string, variants: readonly string[]): string | null {
    if (!variants || variants.length === 0) return null;
    if (variants.length === 1) return variants[0];
    let idx = Math.floor(this.rng() * variants.length);
    if (idx >= variants.length) idx = variants.length - 1; // guard rng() === 1
    if (idx < 0) idx = 0;
    if (idx === this.lastIndex.get(poolKey)) {
      idx = (idx + 1) % variants.length; // bump off the last-played variant
    }
    this.lastIndex.set(poolKey, idx);
    return variants[idx];
  }
}

/** Map damage dealt to a pain-grunt volume in [PAIN_MIN_VOLUME, PAIN_MAX_VOLUME]. */
function painVolume(damage: number): number {
  const d = Number.isFinite(damage) ? Math.max(0, damage) : 0;
  const frac = Math.min(1, d / HEAVY_DAMAGE);
  return PAIN_MIN_VOLUME + (PAIN_MAX_VOLUME - PAIN_MIN_VOLUME) * frac;
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

let singleton: DamageSFX | null = null;

/** Shared process-wide DamageSFX used by the game. */
export function getDamageSFX(): DamageSFX {
  if (!singleton) singleton = new DamageSFX();
  return singleton;
}

/** Reset the singleton — test-only helper. */
export function __resetDamageSFXForTests(): void {
  singleton = null;
}
