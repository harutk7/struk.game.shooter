/**
 * Per-weapon recoil profiles (T11 — realism-v2).
 *
 * Each profile describes how a weapon "kicks" when fired. The renderer
 * (`PlayerBodyRenderer.addRecoil`) reads a profile and drives three coupled
 * effects, all spring-damped back to rest over `recoveryMs`:
 *   1. camera kick   — the view rotates up (`verticalKick`) and sideways
 *                       (`horizontalKick`, signed by `horizontalPattern`)
 *   2. viewmodel kick — the weapon group rotates back (local +z) by an amount
 *                       proportional to `verticalKick`
 *   3. viewmodel shake — a tiny random position jitter scaled by `shake`
 *
 * For automatic weapons the per-shot kicks ACCUMULATE during sustained fire
 * (capped at `maxAccumulationDeg`) and decay during the cooldown, so holding
 * the trigger on the AK visibly climbs while the pistol barely moves.
 *
 * NOTE on weapon identity: the game currently ships four weapon *types*
 * (PISTOL / RIFLE / SHOTGUN / SNIPER — see `src/models/Weapon.ts`). The spec
 * for this task is written against archetype names (pistol / ak / mp5 / m4).
 * We keep the archetype profiles as the canonical, named source of truth and
 * map the in-game weapon types onto them via `WEAPON_TYPE_TO_PROFILE`. The
 * `mp5` and `m4` archetypes are not yet wired to an in-game weapon type but
 * exist so future SMG/carbine weapons (and the acceptance tests) can use them.
 */

import type { WeaponType } from '../models/Weapon';

export interface RecoilProfile {
  /** Upward camera + weapon kick per shot, in degrees. */
  verticalKick: number;
  /** Sideways camera kick magnitude per shot, in degrees. */
  horizontalKick: number;
  /**
   * Sign pattern applied to the horizontal kick on successive shots while
   * firing (e.g. `[1, 1, -1]` = right, right, left). Indexed by shot count
   * and wrapped, so a sustained burst traces a repeatable pattern.
   */
  horizontalPattern: number[];
  /** Viewmodel position-shake intensity, 0..1 (scales a fixed ±0.002m jitter). */
  shake: number;
  /** Spring recovery time back to rest, in milliseconds. Lower = snappier. */
  recoveryMs: number;
  /**
   * Cap on accumulated vertical kick during sustained fire, in degrees.
   * Prevents the muzzle from climbing past the top of the screen.
   */
  maxAccumulationDeg: number;
}

/**
 * Canonical archetype profiles. Tuned so that, fired on full-auto:
 *   ak    — climbs hard with a right-right-left horizontal weave
 *   m4    — climbs moderately, very controllable horizontally
 *   mp5   — low, snappy, extremely controllable
 *   pistol— a single sharp tap that recovers almost instantly
 */
export const weaponProfiles: Record<string, RecoilProfile> = {
  pistol: {
    verticalKick: 0.5,
    horizontalKick: 0.2,
    horizontalPattern: [1, -1],
    shake: 0.25,
    recoveryMs: 150,
    maxAccumulationDeg: 4,
  },
  ak: {
    verticalKick: 1.2,
    horizontalKick: 0.5,
    // 3-round burst: right, right, then left — the classic AK weave.
    horizontalPattern: [1, 1, -1],
    shake: 1.0,
    recoveryMs: 400,
    maxAccumulationDeg: 14,
  },
  mp5: {
    verticalKick: 0.45,
    horizontalKick: 0.15,
    horizontalPattern: [1, -1],
    shake: 0.3,
    recoveryMs: 120,
    maxAccumulationDeg: 5,
  },
  m4: {
    verticalKick: 0.8,
    horizontalKick: 0.1,
    horizontalPattern: [1, -1, 1],
    shake: 0.4,
    recoveryMs: 200,
    maxAccumulationDeg: 8,
  },

  // ── In-game weapon types that have no dedicated archetype above get their
  //    own profiles (shotgun = heavy thump, sniper = big single kick). ──
  shotgun: {
    verticalKick: 1.6,
    horizontalKick: 0.4,
    horizontalPattern: [1, -1],
    shake: 1.0,
    recoveryMs: 350,
    maxAccumulationDeg: 10,
  },
  sniper: {
    verticalKick: 2.2,
    horizontalKick: 0.15,
    horizontalPattern: [1, -1],
    shake: 0.9,
    recoveryMs: 450,
    maxAccumulationDeg: 6,
  },
};

/** Maps the four in-game weapon types onto a recoil archetype. */
export const WEAPON_TYPE_TO_PROFILE: Record<WeaponType, string> = {
  PISTOL: 'pistol',
  RIFLE: 'ak', // the in-game rifle is full-auto and climbs like an AK
  SHOTGUN: 'shotgun',
  SNIPER: 'sniper',
};

/** Fallback used whenever a profile key is unknown. */
export const DEFAULT_PROFILE_KEY = 'pistol';

/**
 * Resolve a recoil profile by key. Accepts either an archetype key
 * (`'ak'`) or an in-game weapon type (`'RIFLE'`); always returns a profile.
 */
export function getRecoilProfile(key: string): RecoilProfile {
  const direct = weaponProfiles[key];
  if (direct) return direct;
  const mapped = WEAPON_TYPE_TO_PROFILE[key as WeaponType];
  if (mapped && weaponProfiles[mapped]) return weaponProfiles[mapped];
  return weaponProfiles[DEFAULT_PROFILE_KEY];
}
