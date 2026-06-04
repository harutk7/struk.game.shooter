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

/** Material palette — kept simple and "tactical" looking. */
const COLORS = {
  skin: 0xd9b48a,
  shirt: 0x3a4a3a,
  pants: 0x232a23,
  boots: 0x1a1a1a,
  gloves: 0x2a2a2a,
  helmet: 0x2c342c,
  webbing: 0x4a3a2a,
};

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
  private recoilKick = 0;   // 0..1 decays to 0
  private recoilYaw = 0;    // small random yaw on each shot
  private recoilPitch = 0;  // upward pitch on each shot

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
    this.leftArm = this.buildArm();
    this.leftArm.position.set(0.34, 0.15, 0.0);
    this.root.add(this.leftArm);
    this.leftArmRest = this.leftArm.position.clone();

    // ── Right arm (weapon arm) ───────────────────────────────
    this.rightArm = this.buildArm();
    this.rightArm.position.set(-0.34, 0.15, 0.0);
    this.root.add(this.rightArm);
    this.rightArmRest = this.rightArm.position.clone();

    // Weapon anchor: attached to the right forearm, weapons parent to this
    this.weaponAnchor = new THREE.Group();
    this.weaponAnchor.position.set(0, -0.22, 0.05);
    this.rightArm.add(this.weaponAnchor);

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
      this.weaponAnchor.remove(this.currentWeaponModel);
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
    this.weaponAnchor.add(model);
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
   * Magnitude is in arbitrary units; the body normalizes it.
   */
  addRecoil(magnitude: number, randomYaw: number): void {
    this.recoilKick = Math.min(1.0, this.recoilKick + magnitude);
    this.recoilYaw = (Math.random() - 0.5) * randomYaw;
    this.recoilPitch = (0.3 + Math.random() * 0.3) * magnitude;
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

    // Recoil decay
    this.recoilKick = Math.max(0, this.recoilKick - dt * 6);

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
  private buildArm(): THREE.Group {
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
    // Glove on the hand
    const hand = new THREE.Mesh(
      new THREE.BoxGeometry(0.11, 0.08, 0.11),
      new THREE.MeshStandardMaterial({ color: COLORS.gloves, roughness: 0.8 }),
    );
    hand.position.y = -0.30;
    hand.castShadow = true;
    forearm.add(hand);
    arm.add(forearm);
    arm.userData.forearm = forearm;
    return arm;
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
