/**
 * WeaponSFX — per-weapon gunfire SFX + hit-marker "ding" (T14 / workstream-B).
 *
 * Thin layer on top of the T13 {@link AudioManager}. It owns:
 *  - the mapping from a game {@link WeaponType} to its set of SFX variants,
 *  - a non-repeating random picker so firing the same gun doesn't play the
 *    identical sample twice in a row (repetition fatigue), and
 *  - the hit-marker ding, played louder on headshots than body shots.
 *
 * Adapting the spec to the real repo:
 *  - The task spec named weapons `pistol | ak | mp5 | m4`, but the actual game
 *    roster (src/models/Weapon.ts) is `PISTOL | RIFLE | SHOTGUN | SNIPER`, so
 *    `playGunshot` takes the real {@link WeaponType}. RIFLE is the automatic
 *    "AK/M4-style" assault rifle.
 *  - SFX ship as procedurally-generated CC0 **WAV** files (no OGG encoder in
 *    CI — same precedent as T13's placeholders). See scripts/gen_weapon_sounds.mjs
 *    and CREDITS.md.
 *
 * Stays 2D for now — true positional audio (PannerNode) is a later polish task,
 * matching the OUT OF SCOPE note in the task.
 */

import { getAudioManager } from './AudioManager';
import type { PlayOptions } from './AudioManager';
import type { WeaponType } from '../models/Weapon';

/** Minimal surface of the AudioManager that WeaponSFX needs (injectable for tests). */
export interface SfxSink {
  loadSound(name: string, url: string): Promise<AudioBuffer>;
  play(name: string, opts?: PlayOptions): AudioBufferSourceNode | null;
}

export type HitKind = 'headshot' | 'body';

/** Sound-bank names for each weapon's variants (keys into the AudioManager). */
const WEAPON_VARIANTS: Record<WeaponType, readonly string[]> = {
  PISTOL: ['pistol_1', 'pistol_2'],
  RIFLE: ['rifle_1', 'rifle_2'],
  SHOTGUN: ['shotgun_1', 'shotgun_2'],
  SNIPER: ['sniper_1', 'sniper_2'],
};

const HITMARKER = 'hitmarker';

/** Per-play gunshot gain. Big guns sit a touch louder. */
const GUNSHOT_VOLUME: Record<WeaponType, number> = {
  PISTOL: 0.8,
  RIFLE: 0.85,
  SHOTGUN: 1.0,
  SNIPER: 1.0,
};

const HITMARKER_BODY_VOLUME = 0.6;
const HITMARKER_HEADSHOT_VOLUME = 1.0;

export interface WeaponSFXOptions {
  /** Audio sink to route through. Defaults to the shared AudioManager singleton. */
  manager?: SfxSink;
  /** RNG in [0,1). Injectable for deterministic tests. Defaults to Math.random. */
  rng?: () => number;
  /** Base URL for asset paths (Vite `BASE_URL`). Defaults to '/'. */
  baseUrl?: string;
}

export class WeaponSFX {
  private readonly manager: SfxSink;
  private readonly rng: () => number;
  private readonly baseUrl: string;
  /** Last variant index played per weapon, to avoid immediate repeats. */
  private readonly lastIndex = new Map<WeaponType, number>();

  constructor(opts: WeaponSFXOptions = {}) {
    this.manager = opts.manager ?? getAudioManager();
    this.rng = opts.rng ?? Math.random;
    this.baseUrl = opts.baseUrl ?? '/';
  }

  /**
   * Load every weapon variant + the hit-marker into the AudioManager. Per-file
   * failures are swallowed so a single missing asset never rejects the whole
   * preload (the game degrades to silence for that sound). Resolves once all
   * loads have settled.
   */
  async loadAll(baseOverride?: string): Promise<void> {
    const base = baseOverride ?? this.baseUrl;
    const jobs: Promise<unknown>[] = [];
    for (const variants of Object.values(WEAPON_VARIANTS)) {
      for (const name of variants) {
        jobs.push(
          this.manager.loadSound(name, `${base}sounds/weapons/${name}.wav`).catch(() => {}),
        );
      }
    }
    jobs.push(this.manager.loadSound(HITMARKER, `${base}sounds/hitmarker.wav`).catch(() => {}));
    await Promise.all(jobs);
  }

  /**
   * Play a gunshot for the given weapon, randomly choosing one of its variants
   * (never the same one twice in a row when more than one exists). No-ops
   * gracefully for unknown weapon types — never throws.
   */
  playGunshot(weaponType: WeaponType): void {
    const variants = WEAPON_VARIANTS[weaponType];
    if (!variants || variants.length === 0) return;
    const idx = this.pickIndex(weaponType, variants.length);
    this.manager.play(variants[idx], { category: 'sfx', volume: GUNSHOT_VOLUME[weaponType] ?? 0.85 });
  }

  /** Play the hit-marker ding. Headshots are louder than body shots. */
  playHitMarker(kind: HitKind): void {
    const volume = kind === 'headshot' ? HITMARKER_HEADSHOT_VOLUME : HITMARKER_BODY_VOLUME;
    this.manager.play(HITMARKER, { category: 'sfx', volume });
  }

  /** Choose a variant index, avoiding an immediate repeat when possible. */
  private pickIndex(weaponType: WeaponType, count: number): number {
    if (count <= 1) return 0;
    let idx = Math.floor(this.rng() * count);
    if (idx >= count) idx = count - 1; // guard rng() === 1
    if (idx < 0) idx = 0;
    if (idx === this.lastIndex.get(weaponType)) {
      idx = (idx + 1) % count; // bump off the last-played variant
    }
    this.lastIndex.set(weaponType, idx);
    return idx;
  }
}

let singleton: WeaponSFX | null = null;

/** Shared process-wide WeaponSFX used by the game. */
export function getWeaponSFX(): WeaponSFX {
  if (!singleton) singleton = new WeaponSFX();
  return singleton;
}

/** Reset the singleton — test-only helper. */
export function __resetWeaponSFXForTests(): void {
  singleton = null;
}
