/**
 * Procedural humanoid bot body (T18).
 *
 * Builds a single self-contained, asset-free humanoid that is chunkier than
 * the first-person `PlayerBodyRenderer` to read as a vest-wearing soldier:
 *   - head   : small box (0.22m) + helmet with an accent visor stripe
 *   - torso  : 0.5m tall x 0.4m wide chest with a darker tactical "vest" overlay
 *   - arms   : 0.6m each, split into a shoulder (upper) + elbow (forearm) + hand
 *   - legs   : 0.8m each, split into a thigh + calf + boot
 *
 * The six articulated limb groups are NAMED (`head`, `torso`, `leftArm`,
 * `rightArm`, `leftLeg`, `rightLeg`) so callers/tests can resolve them via
 * `group.getObjectByName(...)`.
 *
 * Animation is fully procedural (no skeletal assets):
 *   - walk : legs swing on a sine wave, arms counter-swing, torso bobs. The
 *            phase is driven by the bot's cumulative `distanceTraveled` so the
 *            cadence scales with actual speed (≈1.5 Hz at the nominal walk
 *            speed of 3 m/s — see WALK_FREQUENCY_HZ / NOMINAL_WALK_SPEED).
 *   - idle : subtle breathing — torso.scale.y oscillates 0.98 → 1.02 at 0.3 Hz.
 *   - death: on setAlive(false) a 600ms ragdoll plays (torso leans forward 70°,
 *            legs buckle) and the whole body then fades out over the next 400ms.
 *
 * This module owns ONLY the body mesh + its animation. Health bars, name
 * sprites, hit-flash and the held weapon live in `BotRenderer`, which composes
 * a BotBody and parents it under a position/yaw root.
 */

import * as THREE from 'three';

/** Nominal bot walk speed (m/s) — keep in sync with GAME_CONFIG.bots.*.walkSpeed. */
const NOMINAL_WALK_SPEED = 3.0;
/** Target leg cadence at the nominal walk speed. */
const WALK_FREQUENCY_HZ = 1.5;
/**
 * Distance covered per full leg cycle (metres). Derived so that at the nominal
 * walk speed the cadence is exactly WALK_FREQUENCY_HZ:
 *   freq = speed / stride  ⇒  stride = speed / freq = 3.0 / 1.5 = 2.0 m.
 * Phase therefore advances by 2π every STRIDE_LENGTH metres travelled, which
 * makes the swing depend on speed (distance), not raw wall-clock time.
 */
const STRIDE_LENGTH = NOMINAL_WALK_SPEED / WALK_FREQUENCY_HZ;
const WALK_PHASE_PER_METRE = (Math.PI * 2) / STRIDE_LENGTH;

/** Idle breathing frequency (Hz) and amplitude (fraction of torso height). */
const BREATHE_FREQUENCY_HZ = 0.3;
const BREATHE_AMPLITUDE = 0.02; // 1.0 ± 0.02 → 0.98 .. 1.02

/** Death timing (milliseconds). */
const DEATH_RAGDOLL_MS = 600; // torso lean + leg buckle
const DEATH_FADE_MS = 400;    // body fades out
const DEATH_TOTAL_MS = DEATH_RAGDOLL_MS + DEATH_FADE_MS;
/** Forward lean at the end of the ragdoll (70° in radians). */
const DEATH_LEAN_RAD = (70 * Math.PI) / 180;
/** How far the knees buckle (radians) at the end of the ragdoll. */
const DEATH_BUCKLE_RAD = (60 * Math.PI) / 180;

export interface BotBodyOptions {
  /** Per-team / per-bot identifying colour (applied to fatigues). */
  color: number;
  /** Optional bright accent (helmet visor stripe + vest patch). Defaults to a
   *  derived high-vis tint of the team colour. */
  accent?: number;
}

export interface BotBodyTickParams {
  /** Seconds since the previous frame. */
  dt: number;
  /** Is the bot currently moving (drives walk vs idle blend). */
  isMoving: boolean;
  /** Cumulative distance the bot has travelled (metres) — drives walk phase. */
  distanceTraveled: number;
}

/** Multiply an 0xRRGGBB colour's channels by `f` (clamped) to darken/lighten. */
function scaleColor(hex: number, f: number): number {
  const r = Math.min(255, Math.round(((hex >> 16) & 0xff) * f));
  const g = Math.min(255, Math.round(((hex >> 8) & 0xff) * f));
  const b = Math.min(255, Math.round((hex & 0xff) * f));
  return (r << 16) | (g << 8) | b;
}

export class BotBody {
  /** Root of the body. Parent this under a position/yaw root. */
  public readonly group: THREE.Group;

  // Articulated, named limb groups.
  public readonly head: THREE.Group;
  public readonly torso: THREE.Group;
  public readonly leftArm: THREE.Group;
  public readonly rightArm: THREE.Group;
  public readonly leftLeg: THREE.Group;
  public readonly rightLeg: THREE.Group;
  /** Hand anchor on the right arm — the held weapon parents here. */
  public readonly rightHand: THREE.Group;

  /** Primary body material (fatigues). Exposed for hit-flash + opacity checks. */
  public readonly material: THREE.MeshStandardMaterial;

  // Every fade-able material, so death fades the whole body uniformly.
  private readonly materials: THREE.MeshStandardMaterial[] = [];

  private idlePhase = 0;
  private alive = true;
  private deathElapsedMs = 0;

  constructor(opts: BotBodyOptions) {
    const teamColor = opts.color;
    const accentColor = opts.accent ?? scaleColor(teamColor, 1.6);
    // Desaturated military feel: fatigues use the team colour, the vest/pants
    // are a darker shade of it, gear/boots are near-black.
    const vestColor = scaleColor(teamColor, 0.45);
    const pantsColor = scaleColor(teamColor, 0.35);

    const fatigueMat = this.mat(teamColor, 0.85);
    const vestMat = this.mat(vestColor, 1.0);
    const pantsMat = this.mat(pantsColor, 0.95);
    const bootMat = this.mat(0x1a1a1a, 0.7);
    const helmetMat = this.mat(scaleColor(teamColor, 0.6), 0.6);
    const accentMat = this.mat(accentColor, 0.4);
    const skinMat = this.mat(0xd9b48a, 0.7);
    this.material = fatigueMat;

    this.group = new THREE.Group();
    this.group.name = 'botBody';

    // ── Torso (0.5 tall x 0.4 wide) + darker vest overlay ────────────
    this.torso = new THREE.Group();
    this.torso.name = 'torso';
    const chest = mesh(new THREE.BoxGeometry(0.4, 0.5, 0.26), fatigueMat);
    chest.position.y = 0.1;
    this.torso.add(chest);
    const stomach = mesh(new THREE.BoxGeometry(0.38, 0.22, 0.24), fatigueMat);
    stomach.position.y = -0.2;
    this.torso.add(stomach);
    // Plate-carrier vest sits proud of the chest, slightly wider.
    const vest = mesh(new THREE.BoxGeometry(0.42, 0.34, 0.3), vestMat);
    vest.position.set(0, 0.12, 0.0);
    this.torso.add(vest);
    // Single accent patch on the vest.
    const patch = mesh(new THREE.BoxGeometry(0.1, 0.08, 0.02), accentMat);
    patch.position.set(0.1, 0.2, 0.16);
    this.torso.add(patch);
    this.torso.position.y = 0.5;
    this.group.add(this.torso);

    // ── Head (0.22 box) + helmet + accent visor stripe ───────────────
    this.head = new THREE.Group();
    this.head.name = 'head';
    const headMesh = mesh(new THREE.BoxGeometry(0.22, 0.22, 0.22), skinMat);
    this.head.add(headMesh);
    const helmet = mesh(new THREE.BoxGeometry(0.26, 0.12, 0.26), helmetMat);
    helmet.position.y = 0.13;
    this.head.add(helmet);
    // Accent visor stripe across the helmet front.
    const visor = mesh(new THREE.BoxGeometry(0.24, 0.04, 0.04), accentMat);
    visor.position.set(0, 0.04, 0.12);
    this.head.add(visor);
    this.head.position.y = 0.85;
    this.group.add(this.head);

    // ── Arms (0.6m: shoulder + elbow + hand) ─────────────────────────
    const leftHand = { ref: null as unknown as THREE.Group };
    this.leftArm = this.buildArm(fatigueMat, skinMat, bootMat, leftHand);
    this.leftArm.name = 'leftArm';
    this.leftArm.position.set(0.31, 0.6, 0);
    this.group.add(this.leftArm);

    const rightHand = { ref: null as unknown as THREE.Group };
    this.rightArm = this.buildArm(fatigueMat, skinMat, bootMat, rightHand);
    this.rightArm.name = 'rightArm';
    this.rightArm.position.set(-0.31, 0.6, 0);
    this.group.add(this.rightArm);
    this.rightHand = rightHand.ref;

    // ── Legs (0.8m: thigh + calf + boot) ─────────────────────────────
    this.leftLeg = this.buildLeg(pantsMat, bootMat);
    this.leftLeg.name = 'leftLeg';
    this.leftLeg.position.set(0.13, 0.0, 0);
    this.group.add(this.leftLeg);

    this.rightLeg = this.buildLeg(pantsMat, bootMat);
    this.rightLeg.name = 'rightLeg';
    this.rightLeg.position.set(-0.13, 0.0, 0);
    this.group.add(this.rightLeg);
  }

  /** Build a tracked MeshStandardMaterial (registered for death-fade). */
  private mat(color: number, roughness: number): THREE.MeshStandardMaterial {
    const m = new THREE.MeshStandardMaterial({ color, roughness });
    this.materials.push(m);
    return m;
  }

  /** Arm = upper (shoulder→elbow) + forearm subgroup (elbow→wrist) + hand. */
  private buildArm(
    sleeveMat: THREE.MeshStandardMaterial,
    skinMat: THREE.MeshStandardMaterial,
    gloveMat: THREE.MeshStandardMaterial,
    handOut: { ref: THREE.Group },
  ): THREE.Group {
    const arm = new THREE.Group();
    const upper = mesh(new THREE.BoxGeometry(0.13, 0.3, 0.13), sleeveMat);
    upper.position.y = -0.15;
    arm.add(upper);
    // Forearm pivots at the elbow for a natural swing.
    const forearm = new THREE.Group();
    forearm.position.y = -0.3;
    const lower = mesh(new THREE.BoxGeometry(0.11, 0.26, 0.11), skinMat);
    lower.position.y = -0.13;
    forearm.add(lower);
    // Hand (simple box — no fingers for bots).
    const hand = new THREE.Group();
    hand.position.y = -0.28;
    const handMesh = mesh(new THREE.BoxGeometry(0.12, 0.1, 0.12), gloveMat);
    hand.add(handMesh);
    forearm.add(hand);
    arm.add(forearm);
    handOut.ref = hand;
    return arm;
  }

  /** Leg = thigh + calf subgroup (knee pivot) + boot. */
  private buildLeg(
    pantsMat: THREE.MeshStandardMaterial,
    bootMat: THREE.MeshStandardMaterial,
  ): THREE.Group {
    const leg = new THREE.Group();
    const thigh = mesh(new THREE.BoxGeometry(0.17, 0.42, 0.18), pantsMat);
    thigh.position.y = -0.21;
    leg.add(thigh);
    // Calf pivots at the knee.
    const calf = new THREE.Group();
    calf.position.y = -0.42;
    const shin = mesh(new THREE.BoxGeometry(0.15, 0.38, 0.16), pantsMat);
    shin.position.y = -0.19;
    calf.add(shin);
    const boot = mesh(new THREE.BoxGeometry(0.16, 0.1, 0.24), bootMat);
    boot.position.set(0, -0.38, 0.04);
    calf.add(boot);
    leg.add(calf);
    return leg;
  }

  /** True once the death animation (ragdoll + fade) has fully completed. */
  public isDeathComplete(): boolean {
    return !this.alive && this.deathElapsedMs >= DEATH_TOTAL_MS;
  }

  /**
   * Flip the alive state. Passing `false` starts the death animation from the
   * top; passing `true` (e.g. on respawn) resets the body to a clean pose.
   */
  public setAlive(alive: boolean): void {
    if (alive === this.alive) return;
    this.alive = alive;
    this.deathElapsedMs = 0;
    if (alive) {
      // Respawn: clear ragdoll pose + restore opacity.
      this.group.rotation.x = 0;
      this.torso.rotation.x = 0;
      this.leftLeg.rotation.x = 0;
      this.rightLeg.rotation.x = 0;
      this.leftArm.rotation.x = 0;
      this.rightArm.rotation.x = 0;
      this.group.position.y = 0;
      for (const m of this.materials) {
        m.opacity = 1;
        m.transparent = false;
      }
    } else {
      for (const m of this.materials) m.transparent = true;
    }
  }

  /** Advance the body's animation by one frame. */
  public tick(params: BotBodyTickParams): void {
    if (!this.alive) {
      this.tickDeath(params.dt);
      return;
    }

    // ── Walk: phase driven by distance travelled (so speed matters) ──
    const phase = params.distanceTraveled * WALK_PHASE_PER_METRE;
    const swing = params.isMoving ? Math.sin(phase) * 0.7 : 0;
    this.leftLeg.rotation.x = swing;
    this.rightLeg.rotation.x = -swing;
    this.leftArm.rotation.x = -swing * 0.6; // arms counter-swing the legs
    this.rightArm.rotation.x = swing * 0.6;

    // Torso bobs slightly (twice per stride) while walking.
    const bob = params.isMoving ? Math.abs(Math.sin(phase)) * 0.04 : 0;
    this.group.position.y = bob;

    // ── Idle breathing: torso scale.y 0.98 → 1.02 at 0.3 Hz ──────────
    if (params.isMoving) {
      this.torso.scale.y = 1;
    } else {
      this.idlePhase += params.dt * BREATHE_FREQUENCY_HZ * Math.PI * 2;
      this.torso.scale.y = 1 + Math.sin(this.idlePhase) * BREATHE_AMPLITUDE;
    }
  }

  /** Drive the death ragdoll (0–600ms) then fade-out (600–1000ms). */
  private tickDeath(dt: number): void {
    this.deathElapsedMs += dt * 1000;
    const e = this.deathElapsedMs;

    // Ragdoll: ease-out lean + leg buckle over the first 600ms.
    const t1 = Math.min(1, e / DEATH_RAGDOLL_MS);
    const ease = 1 - Math.pow(1 - t1, 2);
    this.group.rotation.x = DEATH_LEAN_RAD * ease;     // whole body topples forward
    this.torso.rotation.x = 0.3 * ease;                 // torso slumps a touch more
    this.leftLeg.rotation.x = -DEATH_BUCKLE_RAD * ease; // knees give way
    this.rightLeg.rotation.x = -DEATH_BUCKLE_RAD * ease;
    this.torso.scale.y = 1;

    // Fade: opacity 1 → 0 over the final 400ms.
    const t2 = Math.max(0, Math.min(1, (e - DEATH_RAGDOLL_MS) / DEATH_FADE_MS));
    const opacity = 1 - t2;
    for (const m of this.materials) {
      m.transparent = true;
      m.opacity = opacity;
    }
  }

  /** Dispose all geometries + materials owned by the body. */
  public dispose(): void {
    this.group.traverse((o: THREE.Object3D) => {
      const m = o as THREE.Mesh;
      if ((m as any).geometry) (m as any).geometry.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((mm) => mm.dispose());
      else if (mat) mat.dispose();
    });
  }
}

/** Small helper: shadow-casting mesh. */
function mesh(geometry: THREE.BufferGeometry, material: THREE.Material): THREE.Mesh {
  const m = new THREE.Mesh(geometry, material);
  m.castShadow = true;
  return m;
}
