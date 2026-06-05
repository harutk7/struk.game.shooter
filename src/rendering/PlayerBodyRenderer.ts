/**
 * First-person player body — head, torso, arms, hands, legs.
 *
 * The body is parented to the camera so the player always sees their own
 * torso/arms in the lower portion of the view (classic CS-style FPV).
 * The actual eye is the camera; the head bobs are applied by the caller
 * to the camera's position so the world view sways correctly.
 *
 * Animation is purely procedural (no asset files):
 *   - idle: slow breathing
 *   - walking: arm/leg swing + head bob
 *   - crouching: torso/head lowered, knees bent
 *   - firing: arm recoil kick (set externally via addRecoil)
 *   - weapon switch: weapon drops down, swap, rises
 *   - weapon reload: magazine pulls out, then re-inserts
 */

import * as THREE from 'three';
import { GAME_CONFIG } from '../core/GameConfig';
import type { WeaponType } from '../models/Weapon';
import { buildWeaponModel, disposeWeaponModel } from './WeaponModels';
import { getRecoilProfile } from '../assets/weaponProfiles';

const DEG2RAD = Math.PI / 180;
/** ±metres of viewmodel position jitter at full shake intensity. */
const SHAKE_AMPLITUDE = 0.002;
/** Duration of the per-shot viewmodel shake, in seconds. */
const SHAKE_DURATION = 0.1;
/** Scales a profile's vertical kick (deg) into the weapon-group local +z back-rotation. */
const WEAPON_KICK_SCALE = 1.0;

/** Material palette — kept simple and "tactical" looking. */
const COLORS = {
  skin: 0xd9b48a,
  handSkin: 0xc68a5a, // warmer, more realistic flesh tone for the hands (T6)
  shirt: 0x3a4a3a,
  pants: 0x232a23,
  boots: 0x1a1a1a,
  gloves: 0x2a2a2a,
  glove: 0x1c1c1c, // dark tactical glove overlay (T6)
  helmet: 0x2c342c,
  webbing: 0x4a3a2a,
};

/** Skin material for hand parts — PBR so it picks up the HDRI (T4/T6). */
function handSkinMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color: COLORS.handSkin, roughness: 0.6, metalness: 0.0 });
}

/** Dark glove material overlaid on the back of the hand + wrist (T6). */
function gloveMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color: COLORS.glove, roughness: 0.9, metalness: 0.0 });
}

/** Resting curl applied to fingers when idle (~30°, negative = curl toward palm). */
const FINGER_BASE_CURL = -0.52;

/** State machine for the visible weapon animation. */
type WeaponAnimState = 'idle' | 'reloading' | 'switchingDown' | 'switchingUp';

/** Per-weapon anchor offsets so different weapons sit naturally in the hand. */
const WEAPON_ANCHOR: Record<WeaponType, { x: number; y: number; z: number; rotX: number }> = {
  PISTOL:  { x: 0,    y: 0,    z: 0,    rotX: 0 },
  RIFLE:   { x: 0,    y: 0,    z: 0,    rotX: 0 },
  SHOTGUN: { x: 0,    y: 0,    z: 0,    rotX: 0 },
  SNIPER:  { x: 0,    y: 0,    z: 0,    rotX: 0 },
};

export interface BodyTickParams {
  /** seconds since last frame */
  dt: number;
  /** is the player pressing any movement key */
  isMoving: boolean;
  /** is the player crouched */
  isCrouching: boolean;
  /** is the player sprinting (faster bob/sway) */
  isSprinting: boolean;
  /** cumulative walk distance (used to phase limb swing) */
  walkPhase: number;
  /** current camera pitch (radians) — drives subtle wrist follow (T6) */
  cameraPitch?: number;
  /** current camera yaw (radians) — drives subtle wrist follow (T6) */
  cameraYaw?: number;
}

/** A finger's two animated segments + metadata for procedural curl. */
interface FingerRig {
  /** Proximal segment group (knuckle pivot). */
  prox: THREE.Group;
  /** Distal segment group (mid-knuckle pivot), null for the thumb. */
  dist: THREE.Group | null;
  /** True for the trigger finger (straightens on recoil). */
  isIndex: boolean;
  /** Resting curl for this digit. */
  baseCurl: number;
}

export class PlayerBodyRenderer {
  /** Root group; parent this to your camera. */
  public readonly root: THREE.Group;
  private readonly head: THREE.Group;
  private readonly torso: THREE.Group;
  private readonly leftArm: THREE.Group;
  private readonly rightArm: THREE.Group;
  private readonly leftLeg: THREE.Group;
  private readonly rightLeg: THREE.Group;
  private readonly weaponAnchor: THREE.Group;
  /** Holds the weapon model; carries spring-damped recoil rotation + shake. */
  private readonly weaponGroup: THREE.Group;

  // Hand rig (T6): wrist groups + per-finger segments for procedural animation
  private leftWrist!: THREE.Group;
  private rightWrist!: THREE.Group;
  private leftWristBaseRot = { x: 0, y: 0 };
  private rightWristBaseRot = { x: 0, y: 0 };
  private readonly fingers: FingerRig[] = [];
  // Smoothed wrist "follow the look" offsets + previous camera angles
  private prevCamYaw = 0;
  private prevCamPitch = 0;
  private wristLookX = 0;
  private wristLookY = 0;

  // Cached base local positions (for blending between idle/walk/crouch)
  private readonly headBaseY: number;
  private readonly torsoBaseY: number;
  private readonly leftArmRest: THREE.Vector3;
  private readonly rightArmRest: THREE.Vector3;
  private readonly leftLegRest: THREE.Vector3;
  private readonly rightLegRest: THREE.Vector3;

  // Smoothed movement state
  private breathPhase = 0;
  private crouchBlend = 0; // 0 = standing, 1 = crouched
  private recoilKick = 0;   // 0..1 decays to 0 (drives the arm/body kick)
  private recoilYaw = 0;    // small random yaw on each shot
  private recoilPitch = 0;  // upward pitch on each shot

  // ── Per-weapon spring-damped recoil accumulators (T11) ───
  // All are in radians, accumulate per shot, and spring back toward 0 over
  // the active profile's recovery time. They DON'T snap back instantly, so
  // sustained automatic fire climbs and then settles during the cooldown.
  private recoilCamPitch = 0;   // camera up-kick (added to caller's pitch)
  private recoilCamYaw = 0;     // camera side-kick (added to caller's yaw)
  private recoilWeaponZ = 0;    // weapon group local +z back-rotation
  private recoilRecoverMs = 150; // recovery time of the last-fired weapon
  private recoilMaxZ = 0.25;     // cap for weapon back-rotation (rad)
  private recoilMaxCamPitch = 0.25; // cap for camera up-kick (rad)
  private recoilShot = 0;        // shot counter (drives horizontal pattern)
  private shakeTimer = 0;        // seconds remaining on the viewmodel shake
  private shakeIntensity = 0;    // 0..1 shake scale from the active profile

  // Weapon rig state
  private currentWeaponType: WeaponType = 'PISTOL';
  private currentWeaponModel: THREE.Group | null = null;
  private weaponAnimState: WeaponAnimState = 'idle';
  private weaponAnimTimer = 0;       // 0..1 progress through current anim
  private pendingSwitchTo: WeaponType | null = null;
  private reloadPhase: 'idle' | 'magOut' | 'magIn' = 'idle';
  private reloadMagOut = 0;          // 0..1 mag removal progress
  private reloadMagIn = 0;           // 0..1 mag insert progress
  private reloadTotalTime = 1.5;     // total reload duration (seconds)

  constructor() {
    this.root = new THREE.Group();
    this.root.name = 'PlayerBody';
    this.root.visible = false; // hidden until camera-mounted (avoid world-space pop)

    // ── Torso (chest + stomach) ──────────────────────────────
    this.torso = new THREE.Group();
    const chest = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.45, 0.28),
      new THREE.MeshStandardMaterial({ color: COLORS.shirt, roughness: 0.9 }),
    );
    chest.position.y = 0.22;
    chest.castShadow = true;
    this.torso.add(chest);

    const stomach = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.25, 0.26),
      new THREE.MeshStandardMaterial({ color: COLORS.shirt, roughness: 0.9 }),
    );
    stomach.position.y = -0.05;
    stomach.castShadow = true;
    this.torso.add(stomach);

    // Tactical webbing across chest
    const webbing = new THREE.Mesh(
      new THREE.BoxGeometry(0.56, 0.18, 0.3),
      new THREE.MeshStandardMaterial({ color: COLORS.webbing, roughness: 1.0 }),
    );
    webbing.position.set(0, 0.18, 0);
    this.torso.add(webbing);

    this.torso.position.set(0, -0.4, 0.05);
    this.root.add(this.torso);
    this.torsoBaseY = this.torso.position.y;

    // ── Head + helmet ───────────────────────────────────────
    this.head = new THREE.Group();
    const headMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.24, 0.22),
      new THREE.MeshStandardMaterial({ color: COLORS.skin, roughness: 0.7 }),
    );
    headMesh.castShadow = true;
    this.head.add(headMesh);

    // Helmet sits on top of the head
    const helmet = new THREE.Mesh(
      new THREE.BoxGeometry(0.26, 0.12, 0.26),
      new THREE.MeshStandardMaterial({ color: COLORS.helmet, roughness: 0.6 }),
    );
    helmet.position.y = 0.14;
    helmet.castShadow = true;
    this.head.add(helmet);

    // Goggles — a thin band around the helmet front
    const goggles = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.05, 0.04),
      new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.3, metalness: 0.4 }),
    );
    goggles.position.set(0, 0.04, 0.12);
    this.head.add(goggles);

    this.head.position.set(0, 0.25, 0);
    this.root.add(this.head);
    this.headBaseY = this.head.position.y;

    // ── Left arm (player's left → camera-right when facing -Z) ──
    this.leftArm = this.buildArm('left');
    this.leftArm.position.set(0.34, 0.15, 0.0);
    this.root.add(this.leftArm);
    this.leftArmRest = this.leftArm.position.clone();
    this.leftWrist = this.leftArm.userData.wrist as THREE.Group;
    this.leftWristBaseRot = { x: this.leftWrist.rotation.x, y: this.leftWrist.rotation.y };

    // ── Right arm (weapon arm) ───────────────────────────────
    this.rightArm = this.buildArm('right');
    this.rightArm.position.set(-0.34, 0.15, 0.0);
    this.root.add(this.rightArm);
    this.rightArmRest = this.rightArm.position.clone();
    this.rightWrist = this.rightArm.userData.wrist as THREE.Group;
    this.rightWristBaseRot = { x: this.rightWrist.rotation.x, y: this.rightWrist.rotation.y };

    // Weapon anchor: attached to the right forearm, weapons parent to this.
    // The anchor carries switch/reload/raise motion; the inner weaponGroup
    // carries the spring-damped recoil (back-rotation + shake) so the two
    // never fight each other.
    this.weaponAnchor = new THREE.Group();
    this.weaponAnchor.position.set(0, -0.22, 0.05);
    this.rightArm.add(this.weaponAnchor);

    this.weaponGroup = new THREE.Group();
    this.weaponGroup.name = 'weaponRecoilGroup';
    this.weaponAnchor.add(this.weaponGroup);

    // Build the default weapon (PISTOL) immediately so FPV is never empty
    this.setWeaponModel('PISTOL');

    // ── Legs ─────────────────────────────────────────────────
    this.leftLeg = this.buildLeg();
    this.leftLeg.position.set(0.13, -0.75, 0);
    this.root.add(this.leftLeg);
    this.leftLegRest = this.leftLeg.position.clone();

    this.rightLeg = this.buildLeg();
    this.rightLeg.position.set(-0.13, -0.75, 0);
    this.root.add(this.rightLeg);
    this.rightLegRest = this.rightLeg.position.clone();
  }

  /** Swap the visible weapon model. */
  private setWeaponModel(type: WeaponType): void {
    if (this.currentWeaponModel) {
      this.weaponGroup.remove(this.currentWeaponModel);
      disposeWeaponModel(this.currentWeaponModel);
    }
    // RIFLE and SNIPER get a procedural camo by default (T5 polish).
    const camo: 'none' | 'woodland' | 'desert' | 'urban' =
      type === 'RIFLE' ? 'woodland' :
      type === 'SNIPER' ? 'desert' : 'none';
    const model = buildWeaponModel(type, camo);
    const a = WEAPON_ANCHOR[type];
    model.position.set(a.x, a.y, a.z);
    model.rotation.x = a.rotX;
    this.weaponGroup.add(model);
    this.currentWeaponModel = model;
    this.currentWeaponType = type;
  }

  /** Parent the body to the camera and reveal it. */
  mount(camera: THREE.PerspectiveCamera): void {
    camera.add(this.root);
    this.root.visible = true;
    this.root.position.set(0, 0, 0);
  }

  /**
   * Begin a weapon-switch animation. The visible weapon will drop,
   * swap, then rise. Call from the game when weaponSwitched event fires.
   */
  public switchWeaponTo(type: WeaponType): void {
    if (type === this.currentWeaponType) return;
    if (this.weaponAnimState !== 'idle') {
      // Queue the switch; will apply on next 'idle' state
      this.pendingSwitchTo = type;
      return;
    }
    this.weaponAnimState = 'switchingDown';
    this.weaponAnimTimer = 0;
    this.pendingSwitchTo = type;
  }

  /**
   * Begin the reload animation. Total duration comes from the config.
   * Calls weaponReloadComplete() when done — caller should re-arm ammo.
   */
  public beginReload(reloadTime: number): void {
    if (this.weaponAnimState !== 'idle') return;
    this.weaponAnimState = 'reloading';
    this.reloadPhase = 'magOut';
    this.reloadMagOut = 0;
    this.reloadMagIn = 0;
    this.reloadTotalTime = reloadTime;
  }

  /**
   * True while the body is animating a switch or reload (i.e. the player
   * shouldn't be allowed to fire/switch during this time).
   */
  public isWeaponAnimating(): boolean {
    return this.weaponAnimState !== 'idle';
  }

  /** Detach + dispose */
  dispose(): void {
    if (this.root.parent) this.root.parent.remove(this.root);
    this.root.traverse((o: THREE.Object3D) => {
      const m = o as THREE.Mesh;
      if ((m as any).geometry) (m as any).geometry.dispose();
      const mat = (m.material as THREE.Material | THREE.Material[] | undefined);
      if (Array.isArray(mat)) mat.forEach((mm) => mm.dispose());
      else if (mat) mat.dispose();
    });
  }

  /**
   * Drive recoil animation when the player fires.
   *
   * @param weaponKey  archetype key (`'ak'`) or in-game weapon type (`'RIFLE'`);
   *                   selects the per-weapon recoil profile.
   * @param magnitude  shot strength multiplier (1.0 = a full kick).
   * @param randomYaw  extra random body-twist amount (legacy body feel).
   *
   * Each call ACCUMULATES onto the camera, weapon-group and shake springs
   * (capped per profile) and advances the horizontal recoil pattern. The
   * springs are released over the profile's `recoveryMs` in {@link tick}, so
   * sustained fire climbs and recovery is damped rather than instant.
   */
  addRecoil(weaponKey: string, magnitude: number, randomYaw: number): void {
    const profile = getRecoilProfile(weaponKey);

    // Legacy arm/body kick (still drives the visible arm recoil).
    this.recoilKick = Math.min(1.0, this.recoilKick + magnitude);
    this.recoilYaw = (Math.random() - 0.5) * randomYaw;
    this.recoilPitch = (0.3 + Math.random() * 0.3) * magnitude;

    // ── Camera + weapon-group spring targets ──
    const vertical = profile.verticalKick * DEG2RAD * magnitude;
    const sign = profile.horizontalPattern.length
      ? profile.horizontalPattern[this.recoilShot % profile.horizontalPattern.length]
      : 1;
    const horizontal = profile.horizontalKick * DEG2RAD * magnitude * sign;

    this.recoilMaxZ = profile.maxAccumulationDeg * DEG2RAD * WEAPON_KICK_SCALE;
    this.recoilMaxCamPitch = profile.maxAccumulationDeg * DEG2RAD;

    this.recoilCamPitch = Math.min(this.recoilMaxCamPitch, this.recoilCamPitch + vertical);
    this.recoilCamYaw = Math.max(
      -this.recoilMaxCamPitch,
      Math.min(this.recoilMaxCamPitch, this.recoilCamYaw + horizontal),
    );
    this.recoilWeaponZ = Math.min(
      this.recoilMaxZ,
      this.recoilWeaponZ + vertical * WEAPON_KICK_SCALE,
    );

    this.recoilRecoverMs = profile.recoveryMs;

    // Viewmodel shake — random position jitter that decays over SHAKE_DURATION.
    this.shakeTimer = SHAKE_DURATION;
    this.shakeIntensity = profile.shake;

    this.recoilShot++;

    // Apply the weapon back-rotation immediately so the kick is visible even
    // before the next tick (and so unit tests can observe it synchronously).
    this.weaponGroup.rotation.z = this.recoilWeaponZ;
  }

  /** The group carrying the spring-damped weapon recoil (back-rotation + shake). */
  getWeaponGroup(): THREE.Group {
    return this.weaponGroup;
  }

  /**
   * Current spring-damped camera recoil offset (radians). The caller should
   * ADD these to the look pitch/yaw when composing the camera orientation.
   * `pitch` is positive = view kicks up.
   */
  getCameraRecoil(): { pitch: number; yaw: number } {
    return { pitch: this.recoilCamPitch, yaw: this.recoilCamYaw };
  }

  /**
   * Anchor for weapon meshes (T2 parents actual weapons here).
   * Hidden placeholder so the FPV is not empty in T1.
   */
  getWeaponAnchor(): THREE.Object3D {
    // Hide the placeholder simple cube; real weapons will replace it.
    return this.weaponAnchor;
  }

  /**
   * Tick body animation. Call once per frame.
   * Returns the head-bob Y offset that the caller should ADD to the camera
   * (so the world view sways with walking) and the lateral sway X.
   */
  tick(params: BodyTickParams): { bobY: number; bobX: number } {
    const { dt, isMoving, isCrouching, isSprinting, walkPhase } = params;
    const cfg = GAME_CONFIG.fpv;

    // Smooth crouch transition
    const target = isCrouching ? 1 : 0;
    this.crouchBlend += (target - this.crouchBlend) * Math.min(1, dt * 8);

    // Breathing (subtle vertical chest motion)
    this.breathPhase += dt * (isMoving ? 4.0 : 1.6);
    const breath = Math.sin(this.breathPhase) * 0.004;

    // Limb swing amplitude
    const speedFactor = isMoving ? (isSprinting ? 1.4 : 1.0) : 0.0;
    const swing = Math.sin(walkPhase) * 0.6 * speedFactor;

    // Recoil decay (legacy arm/body kick)
    this.recoilKick = Math.max(0, this.recoilKick - dt * 6);

    // ── Spring-damped recovery of the per-weapon recoil accumulators ──
    // Lerp every accumulator toward rest with a time constant equal to the
    // active weapon's recoveryMs, so a snappy MP5 settles far faster than an
    // AK. This is the "spring back" half of the kick — never instant.
    const tau = Math.max(0.001, this.recoilRecoverMs / 1000);
    const recover = Math.min(1, dt / tau);
    this.recoilCamPitch += -this.recoilCamPitch * recover;
    this.recoilCamYaw += -this.recoilCamYaw * recover;
    this.recoilWeaponZ += -this.recoilWeaponZ * recover;

    // Viewmodel shake: random jitter for SHAKE_DURATION, decaying linearly.
    let shakeX = 0;
    let shakeY = 0;
    if (this.shakeTimer > 0) {
      this.shakeTimer = Math.max(0, this.shakeTimer - dt);
      const decay = this.shakeTimer / SHAKE_DURATION; // 1 → 0
      const amp = SHAKE_AMPLITUDE * this.shakeIntensity * decay;
      shakeX = (Math.random() - 0.5) * 2 * amp;
      shakeY = (Math.random() - 0.5) * 2 * amp;
    }
    this.weaponGroup.rotation.z = this.recoilWeaponZ;
    this.weaponGroup.position.set(shakeX, shakeY, 0);

    // ── Legs ─────────────────────────────────────────────
    const legLift = isMoving ? Math.sin(walkPhase) * 0.25 * speedFactor : 0;
    this.leftLeg.rotation.x = swing;
    this.rightLeg.rotation.x = -swing;
    this.leftLeg.position.y = this.leftLegRest.y + Math.max(0, legLift);
    this.rightLeg.position.y = this.rightLegRest.y + Math.max(0, -legLift);

    // ── Arms (opposite phase to legs) ─────────────────────
    this.leftArm.rotation.x = -swing * 0.5;
    this.rightArm.rotation.x = swing * 0.5;
    this.leftArm.position.y = this.leftArmRest.y + (isMoving ? 0 : 0);
    this.rightArm.position.y = this.rightArmRest.y + (isMoving ? 0 : 0);

    // ── Crouch: lower torso & head, bend legs forward ─────
    const crouchDrop = this.crouchBlend * 0.45;
    this.torso.position.y = this.torsoBaseY - crouchDrop;
    this.head.position.y = this.headBaseY - crouchDrop;

    // Slight torso lean forward when crouching
    this.torso.rotation.x = this.crouchBlend * 0.35;

    // Legs bend forward when crouching
    this.leftLeg.rotation.x = swing + this.crouchBlend * 0.8;
    this.rightLeg.rotation.x = -swing + this.crouchBlend * 0.8;

    // ── Idle breathing on torso ──────────────────────────
    this.torso.position.y += breath;
    this.head.position.y += breath * 0.5;

    // ── Weapon switch / reload / recoil animation ─────────
    const anim = GAME_CONFIG.weaponAnim;
    let switchY = 0;       // Y offset applied to weaponAnchor (down = negative)
    let switchRotX = 0;    // Tilt the weapon forward
    let magY = 0;          // Magazine Y offset (down = negative)
    let rightArmRotXOverride: number | null = null;

    if (this.weaponAnimState === 'switchingDown') {
      this.weaponAnimTimer += dt / anim.switchDownTime;
      const t = Math.min(1, this.weaponAnimTimer);
      const e = 1 - Math.pow(1 - t, 2); // ease-out
      switchY = -anim.switchDropDistance * e;
      switchRotX = 0.6 * e;
      if (t >= 1) {
        if (this.pendingSwitchTo && this.pendingSwitchTo !== this.currentWeaponType) {
          this.setWeaponModel(this.pendingSwitchTo);
        }
        this.pendingSwitchTo = null;
        this.weaponAnimState = 'switchingUp';
        this.weaponAnimTimer = 0;
      }
    } else if (this.weaponAnimState === 'switchingUp') {
      this.weaponAnimTimer += dt / anim.switchUpTime;
      const t = Math.min(1, this.weaponAnimTimer);
      const e = 1 - Math.pow(1 - t, 2);
      switchY = -anim.switchDropDistance * (1 - e);
      switchRotX = 0.6 * (1 - e);
      if (t >= 1) {
        this.weaponAnimState = 'idle';
        this.weaponAnimTimer = 0;
      }
    } else if (this.weaponAnimState === 'reloading') {
      // Two-phase reload: mag out (first 45%), mag in (next 55%)
      const magOutDuration = this.reloadTotalTime * 0.45;
      const magInDuration  = this.reloadTotalTime * 0.55;
      if (this.reloadPhase === 'magOut') {
        this.reloadMagOut += dt / magOutDuration;
        const t = Math.min(1, this.reloadMagOut);
        const e = 1 - Math.pow(1 - t, 2);
        magY = -0.07 * e;             // magazine drops out
        rightArmRotXOverride = -0.3 * e;  // arm tilts the weapon down
        if (t >= 1) {
          this.reloadPhase = 'magIn';
          this.reloadMagIn = 0;
        }
      } else if (this.reloadPhase === 'magIn') {
        this.reloadMagIn += dt / magInDuration;
        const t = Math.min(1, this.reloadMagIn);
        const e = Math.pow(t, 2);
        magY = -0.07 * (1 - e);
        rightArmRotXOverride = -0.3 * (1 - e);
        if (t >= 1) {
          this.weaponAnimState = 'idle';
          this.reloadPhase = 'idle';
          this.reloadMagOut = 0;
          this.reloadMagIn = 0;
        }
      }
    } else {
      // Apply pending switch if one was queued during a busy anim
      if (this.pendingSwitchTo && this.pendingSwitchTo !== this.currentWeaponType) {
        this.weaponAnimState = 'switchingDown';
        this.weaponAnimTimer = 0;
      }
    }

    // ── Recoil: right arm kicks back + up, body twists slightly ─
    const armKickBack = this.recoilKick * 0.45;
    const armKickUp = this.recoilKick * 0.18;
    const recoilX = swing * 0.5 + armKickBack;
    this.rightArm.rotation.x = rightArmRotXOverride !== null ? rightArmRotXOverride : recoilX;
    this.rightArm.rotation.z = -this.recoilKick * 0.08;
    this.weaponAnchor.position.y = -0.22 + armKickUp + switchY;
    this.weaponAnchor.rotation.x = switchRotX;
    this.torso.rotation.y = this.recoilYaw * this.recoilKick * 0.3;
    this.torso.rotation.x = this.crouchBlend * 0.35 - this.recoilPitch * this.recoilKick * 0.25;

    // Apply magazine animation: find the 'magazine' child of the current weapon
    if (this.currentWeaponModel) {
      const mag = this.currentWeaponModel.getObjectByName('magazine');
      if (mag) {
        mag.position.y += magY;
      }
    }

    // ── Finger curl (T6) ─────────────────────────────────
    // Fingers rest slightly curled around the grip. During reload they open
    // (mag out) then close (mag in); the trigger finger straightens on recoil.
    let reloadOpen = 0;
    if (this.weaponAnimState === 'reloading') {
      reloadOpen = this.reloadPhase === 'magOut'
        ? Math.min(1, this.reloadMagOut)
        : Math.max(0, 1 - this.reloadMagIn);
    }
    for (const f of this.fingers) {
      let curl = f.baseCurl * (1 - reloadOpen);
      if (f.isIndex) curl *= 1 - 0.85 * this.recoilKick; // trigger finger snaps straight on the shot
      f.prox.rotation.x = curl;
      if (f.dist) f.dist.rotation.x = curl * 0.8;
    }

    // ── Wrist follows the look (T6) ──────────────────────
    // Tie a small wrist rotation to the *rate of change* of camera pitch/yaw
    // so the hands lag the look a touch — alive, not slavish. Returns to rest
    // as soon as the look settles (rate → 0).
    const camYaw = params.cameraYaw ?? 0;
    const camPitch = params.cameraPitch ?? 0;
    const yawRate = (camYaw - this.prevCamYaw) / Math.max(dt, 1e-3);
    const pitchRate = (camPitch - this.prevCamPitch) / Math.max(dt, 1e-3);
    this.prevCamYaw = camYaw;
    this.prevCamPitch = camPitch;
    const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
    const targetWy = clamp(-yawRate * 0.02, -0.15, 0.15);
    const targetWx = clamp(pitchRate * 0.02, -0.12, 0.12);
    const k = Math.min(1, dt * 8);
    this.wristLookY += (targetWy - this.wristLookY) * k;
    this.wristLookX += (targetWx - this.wristLookX) * k;
    if (this.leftWrist) {
      this.leftWrist.rotation.x = this.leftWristBaseRot.x + this.wristLookX;
      this.leftWrist.rotation.y = this.leftWristBaseRot.y + this.wristLookY;
    }
    if (this.rightWrist) {
      this.rightWrist.rotation.x = this.rightWristBaseRot.x + this.wristLookX;
      this.rightWrist.rotation.y = this.rightWristBaseRot.y + this.wristLookY;
    }

    // ── Head bob (return value — applied to camera) ──────
    const bobY = isMoving
      ? Math.abs(Math.sin(walkPhase * 2)) * cfg.bobAmplitude * speedFactor
      : 0;
    const bobX = isMoving
      ? Math.cos(walkPhase) * cfg.bobAmplitude * 0.4 * speedFactor
      : 0;

    // Lateral sway
    this.torso.position.x = (isMoving ? Math.cos(walkPhase) * cfg.walkSway * speedFactor : 0);
    this.leftArm.position.x = this.leftArmRest.x + (isMoving ? Math.cos(walkPhase) * 0.03 : 0);
    this.rightArm.position.x = this.rightArmRest.x + (isMoving ? -Math.cos(walkPhase) * 0.03 : 0);

    return { bobY, bobX };
  }

  // ────────────────────────────────────────────────────────
  private buildArm(side: 'left' | 'right'): THREE.Group {
    const arm = new THREE.Group();
    // Upper arm
    const upper = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.28, 0.12),
      new THREE.MeshStandardMaterial({ color: COLORS.shirt, roughness: 0.9 }),
    );
    upper.position.y = -0.14;
    upper.castShadow = true;
    arm.add(upper);
    // Forearm (children for recoil)
    const forearm = new THREE.Group();
    forearm.position.y = -0.28;
    const lower = new THREE.Mesh(
      new THREE.BoxGeometry(0.10, 0.26, 0.10),
      new THREE.MeshStandardMaterial({ color: COLORS.skin, roughness: 0.7 }),
    );
    lower.position.y = -0.13;
    lower.castShadow = true;
    forearm.add(lower);

    // ── Procedural hand on a wrist group (T6) ──────────────
    const wrist = this.buildHand(side);
    if (side === 'right') {
      // Lift the wrist up to the weapon grip anchor so the right hand
      // wraps the grip (anchor sits at arm-local (0,-0.22,0.05); forearm
      // origin is at (0,-0.28,0)). No gap between palm and grip.
      wrist.position.set(0, 0.06, 0.05);
      wrist.rotation.set(0.12, 0, 0);
    } else {
      // Support hand: rests forward at the end of the forearm (ready pose;
      // reaches the rifle handguard once T7 lands).
      wrist.position.set(0, -0.24, 0.02);
      wrist.rotation.set(0.22, 0, 0);
    }
    forearm.add(wrist);

    arm.add(forearm);
    arm.userData.forearm = forearm;
    arm.userData.wrist = wrist;
    return arm;
  }

  /**
   * Build a small procedural hand: palm + 4 two-segment fingers + thumb,
   * plus a dark glove overlay on the back of the hand and the wrist cuff.
   * Returns the wrist group (parent this to the forearm). Finger segments
   * are registered in `this.fingers` for procedural curl in tick().
   */
  private buildHand(side: 'left' | 'right'): THREE.Group {
    const wrist = new THREE.Group();
    wrist.name = 'wrist';

    // Palm — fingers extend toward -Z (forward).
    const palm = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.03, 0.085), handSkinMaterial());
    palm.name = 'palm';
    palm.position.set(0, -0.015, -0.01);
    palm.castShadow = true;
    wrist.add(palm);

    // Glove overlay: back of the hand …
    const gloveBack = new THREE.Mesh(new THREE.BoxGeometry(0.088, 0.012, 0.10), gloveMaterial());
    gloveBack.name = 'glove';
    gloveBack.position.set(0, 0.005, 0.0);
    gloveBack.castShadow = true;
    wrist.add(gloveBack);
    // … extended to the wrist as a cuff.
    const cuff = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.05, 0.045), gloveMaterial());
    cuff.name = 'glove_cuff';
    cuff.position.set(0, -0.005, 0.055);
    cuff.castShadow = true;
    wrist.add(cuff);

    // Four fingers across the front edge of the palm. Index sits toward the
    // thumb side so it can reach a trigger.
    const names = ['index', 'middle', 'ring', 'pinky'];
    const xs = side === 'right'
      ? [0.028, 0.0095, -0.0095, -0.028]
      : [-0.028, -0.0095, 0.0095, 0.028];
    for (let i = 0; i < 4; i++) {
      wrist.add(this.buildFinger(names[i], xs[i]));
    }

    // Thumb — angled in from the side of the palm (single segment).
    const thumb = new THREE.Group();
    thumb.name = 'thumb';
    const thumbX = side === 'right' ? 0.05 : -0.05;
    thumb.position.set(thumbX, -0.01, -0.005);
    thumb.rotation.set(0, side === 'right' ? -0.5 : 0.5, side === 'right' ? 0.5 : -0.5);
    const thumbMesh = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.016, 0.04), handSkinMaterial());
    thumbMesh.position.z = -0.02;
    thumbMesh.castShadow = true;
    thumb.add(thumbMesh);
    wrist.add(thumb);
    this.fingers.push({ prox: thumb, dist: null, isIndex: false, baseCurl: FINGER_BASE_CURL * 0.5 });

    return wrist;
  }

  /** Build one two-segment finger; registers both segments for curl. */
  private buildFinger(name: string, x: number): THREE.Group {
    const segLen = 0.034;
    const width = 0.016;
    // Proximal segment — pivots at the knuckle on the front edge of the palm.
    const prox = new THREE.Group();
    prox.name = `${name}_proximal`;
    prox.position.set(x, -0.012, -0.045);
    const proxMesh = new THREE.Mesh(new THREE.BoxGeometry(width, width, segLen), handSkinMaterial());
    proxMesh.position.z = -segLen / 2;
    proxMesh.castShadow = true;
    prox.add(proxMesh);
    // Distal segment — child of proximal so it follows + adds its own curl.
    const dist = new THREE.Group();
    dist.name = `${name}_distal`;
    dist.position.z = -segLen;
    const distLen = segLen * 0.85;
    const distMesh = new THREE.Mesh(new THREE.BoxGeometry(width * 0.9, width * 0.9, distLen), handSkinMaterial());
    distMesh.position.z = -distLen / 2;
    distMesh.castShadow = true;
    dist.add(distMesh);
    prox.add(dist);
    this.fingers.push({ prox, dist, isIndex: name === 'index', baseCurl: FINGER_BASE_CURL });
    return prox;
  }

  private buildLeg(): THREE.Group {
    const leg = new THREE.Group();
    // Thigh
    const thigh = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.36, 0.18),
      new THREE.MeshStandardMaterial({ color: COLORS.pants, roughness: 0.9 }),
    );
    thigh.position.y = -0.18;
    thigh.castShadow = true;
    leg.add(thigh);
    // Shin
    const shin = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.34, 0.16),
      new THREE.MeshStandardMaterial({ color: COLORS.pants, roughness: 0.9 }),
    );
    shin.position.y = -0.52;
    shin.castShadow = true;
    leg.add(shin);
    // Boot
    const boot = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.10, 0.24),
      new THREE.MeshStandardMaterial({ color: COLORS.boots, roughness: 0.7 }),
    );
    boot.position.set(0, -0.72, 0.04);
    boot.castShadow = true;
    leg.add(boot);
    return leg;
  }
}

// (PIVOT_PLACEHOLDER removed in T2 — see WeaponModels for actual weapon geometry)
