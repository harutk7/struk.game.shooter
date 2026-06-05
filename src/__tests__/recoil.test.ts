/**
 * T11 — Per-weapon recoil profiles (camera + viewmodel + spring).
 *
 * Verifies the recoil profiles are distinct and that PlayerBodyRenderer drives
 * a spring-damped, accumulating weapon-group kick.
 */

import { describe, it, expect } from 'vitest';
import { weaponProfiles, getRecoilProfile } from '../assets/weaponProfiles';
import { PlayerBodyRenderer } from '../rendering/PlayerBodyRenderer';

describe('weaponProfiles', () => {
  it('the AK kicks higher than the pistol', () => {
    expect(weaponProfiles.ak.verticalKick).toBeGreaterThan(weaponProfiles.pistol.verticalKick);
  });

  it('the MP5 recovers faster than the AK', () => {
    expect(weaponProfiles.mp5.recoveryMs).toBeLessThan(weaponProfiles.ak.recoveryMs);
  });

  it('defines the four spec archetypes plus the in-game weapon types', () => {
    for (const key of ['pistol', 'ak', 'mp5', 'm4', 'shotgun', 'sniper']) {
      expect(weaponProfiles[key]).toBeTruthy();
    }
  });

  it('the AK has a right→right→left horizontal pattern', () => {
    expect(weaponProfiles.ak.horizontalPattern).toEqual([1, 1, -1]);
  });

  it('resolves both archetype keys and in-game weapon types, with a fallback', () => {
    expect(getRecoilProfile('ak')).toBe(weaponProfiles.ak);
    expect(getRecoilProfile('RIFLE')).toBe(weaponProfiles.ak); // RIFLE → ak archetype
    expect(getRecoilProfile('PISTOL')).toBe(weaponProfiles.pistol);
    expect(getRecoilProfile('nonsense')).toBe(weaponProfiles.pistol); // fallback
  });
});

describe('PlayerBodyRenderer.addRecoil', () => {
  it('accumulates a visible weapon-group back-rotation under sustained AK fire', () => {
    const body = new PlayerBodyRenderer();
    for (let i = 0; i < 5; i++) body.addRecoil('ak', 1.0, 0);
    expect(body.getWeaponGroup().rotation.z).toBeGreaterThan(0.05);
    body.dispose();
  });

  it('the AK climbs more than the pistol over an identical burst', () => {
    const ak = new PlayerBodyRenderer();
    const pistol = new PlayerBodyRenderer();
    for (let i = 0; i < 5; i++) {
      ak.addRecoil('ak', 1.0, 0);
      pistol.addRecoil('pistol', 1.0, 0);
    }
    expect(ak.getWeaponGroup().rotation.z).toBeGreaterThan(pistol.getWeaponGroup().rotation.z);
    ak.dispose();
    pistol.dispose();
  });

  it('springs the recoil back down over time (recovery is not instant)', () => {
    const body = new PlayerBodyRenderer();
    for (let i = 0; i < 5; i++) body.addRecoil('ak', 1.0, 0);
    const peak = body.getWeaponGroup().rotation.z;
    // One frame should NOT fully reset it (damped, not instant)...
    body.tick({ dt: 1 / 60, isMoving: false, isCrouching: false, isSprinting: false, walkPhase: 0 });
    const afterOneFrame = body.getWeaponGroup().rotation.z;
    expect(afterOneFrame).toBeLessThan(peak);
    expect(afterOneFrame).toBeGreaterThan(0);
    // ...but over a full second it settles back toward rest.
    for (let i = 0; i < 60; i++) {
      body.tick({ dt: 1 / 60, isMoving: false, isCrouching: false, isSprinting: false, walkPhase: 0 });
    }
    expect(body.getWeaponGroup().rotation.z).toBeLessThan(peak * 0.2);
    body.dispose();
  });

  it('exposes a spring-damped camera recoil offset that kicks the view up', () => {
    const body = new PlayerBodyRenderer();
    expect(body.getCameraRecoil().pitch).toBe(0);
    body.addRecoil('ak', 1.0, 0);
    expect(body.getCameraRecoil().pitch).toBeGreaterThan(0);
    body.dispose();
  });
});
