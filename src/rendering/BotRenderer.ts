/**
 * Bot renderer — procedural humanoid bodies (head, torso, arms, legs)
 * with a visible weapon. All geometry is procedurally generated (no
 * asset files). The model is used for both:
 *   - live bots: walks toward waypoints, strafes while engaging
 *   - ragdoll   : on death, body tilts and sinks
 */

import * as THREE from 'three';
import type { BotData } from '../models/Bot';
import { buildWeaponModel, disposeWeaponModel } from './WeaponModels';

interface BotMesh {
  root: THREE.Group;
  torso: THREE.Group;
  head: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  weapon: THREE.Group;
  bodyMat: THREE.MeshStandardMaterial;
  nameSprite?: THREE.Sprite;
  hpBg: THREE.Mesh;
  hpFill: THREE.Mesh;
  hpGroup: THREE.Group;
  flashTimer: number;
  deathAnimation?: { startTime: number; duration: number };
  walkPhase: number;
}

export class BotRenderer {
  private scene: THREE.Scene;
  private meshes = new Map<string, BotMesh>();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  /** Create a mesh for a newly spawned bot. */
  createMesh(bot: BotData): void {
    if (this.meshes.has(bot.id)) return;

    const root = new THREE.Group();
    root.name = `bot_${bot.id}`;
    root.userData.botId = bot.id;
    root.userData.type = 'bot';

    // Body material (per-bot color)
    const bodyMat = new THREE.MeshStandardMaterial({ color: bot.color, roughness: 0.8 });
    const pantsMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9 });

    // Torso
    const torso = new THREE.Group();
    const chest = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 0.30), bodyMat);
    chest.position.y = 0.15;
    chest.castShadow = true;
    torso.add(chest);
    const stomach = new THREE.Mesh(new THREE.BoxGeometry(0.50, 0.30, 0.28), bodyMat);
    stomach.position.y = -0.20;
    stomach.castShadow = true;
    torso.add(stomach);
    torso.position.y = 0.5;
    root.add(torso);

    // Head
    const head = new THREE.Group();
    const headMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.24, 0.22),
      new THREE.MeshStandardMaterial({ color: 0xd9b48a, roughness: 0.7 }),
    );
    headMesh.castShadow = true;
    head.add(headMesh);
    const cap = new THREE.Mesh(
      new THREE.BoxGeometry(0.26, 0.10, 0.26),
      new THREE.MeshStandardMaterial({ color: bot.color, roughness: 0.6 }),
    );
    cap.position.y = 0.14;
    head.add(cap);
    // Eyes
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
    const leftEye = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 6), eyeMat);
    leftEye.position.set(-0.07, 0.02, -0.115);
    head.add(leftEye);
    const rightEye = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 6), eyeMat);
    rightEye.position.set(0.07, 0.02, -0.115);
    head.add(rightEye);
    head.position.y = 0.85;
    root.add(head);

    // Arms
    const leftArm = this.buildLimb(bodyMat, 0.60);
    leftArm.position.set(0.34, 0.6, 0);
    root.add(leftArm);
    const rightArm = this.buildLimb(bodyMat, 0.60);
    rightArm.position.set(-0.34, 0.6, 0);
    root.add(rightArm);

    // Legs
    const leftLeg = this.buildLimb(pantsMat, 0.85);
    leftLeg.position.set(0.13, 0.0, 0);
    root.add(leftLeg);
    const rightLeg = this.buildLimb(pantsMat, 0.85);
    rightLeg.position.set(-0.13, 0.0, 0);
    root.add(rightLeg);

    // Weapon in right hand
    const weapon = buildWeaponModel(bot.weapon);
    weapon.scale.setScalar(0.85); // smaller than player FPV weapon
    weapon.position.set(0, -0.32, 0.05);
    weapon.rotation.set(0, Math.PI, 0);
    rightArm.add(weapon);

    // Health bar
    const hpGroup = new THREE.Group();
    const hpBg = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 0.08),
      new THREE.MeshBasicMaterial({ color: 0x333333, side: THREE.DoubleSide, depthTest: false }),
    );
    (hpBg as any).raycast = () => {};
    hpGroup.add(hpBg);
    const hpFill = new THREE.Mesh(
      new THREE.PlaneGeometry(0.98, 0.06),
      new THREE.MeshBasicMaterial({ color: 0x44ff44, side: THREE.DoubleSide, depthTest: false }),
    );
    hpFill.position.z = 0.01;
    (hpFill as any).raycast = () => {};
    hpGroup.add(hpFill);
    this.scene.add(hpGroup);

    // Name sprite (cheap: textured plane with bot name baked onto canvas)
    const sprite = this.createNameSprite(bot.name, bot.color);
    sprite.position.y = 1.3;
    root.add(sprite);

    this.scene.add(root);

    this.meshes.set(bot.id, {
      root, torso, head, leftArm, rightArm, leftLeg, rightLeg, weapon,
      bodyMat, nameSprite: sprite, hpBg, hpFill, hpGroup,
      flashTimer: 0, walkPhase: Math.random() * Math.PI * 2,
    });
  }

  /** Build a single limb (upper + lower segment). Returns a group at the top. */
  private buildLimb(material: THREE.MeshStandardMaterial, totalLength: number): THREE.Group {
    const g = new THREE.Group();
    const half = totalLength / 2;
    const seg = new THREE.Mesh(new THREE.BoxGeometry(0.12, totalLength, 0.12), material);
    seg.position.y = -half;
    seg.castShadow = true;
    g.add(seg);
    return g;
  }

  /** Create a small text sprite with the bot's name. */
  private createNameSprite(name: string, color: number): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(0, 0, 256, 64);
    ctx.font = 'bold 28px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const r = (color >> 16) & 0xff;
    const g = (color >> 8) & 0xff;
    const b = color & 0xff;
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillText(name, 128, 32);
    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(1.4, 0.35, 1);
    (sprite as any).raycast = () => {};
    return sprite;
  }

  /** Sync a bot's mesh to its data (position, yaw, anim phase, hp). */
  sync(bot: BotData, dt: number, cameraPos: THREE.Vector3): void {
    const m = this.meshes.get(bot.id);
    if (!m) return;
    if (m.deathAnimation) return; // ragdoll handles itself

    m.root.position.set(bot.position.x, 0, bot.position.z);
    m.root.rotation.y = -bot.yaw; // yaw is atan2(z,x); -yaw rotates model to face that direction

    // Health bar
    m.hpGroup.position.set(bot.position.x, 1.6, bot.position.z);
    m.hpGroup.lookAt(cameraPos.x, m.hpGroup.position.y, cameraPos.z);
    const pct = Math.max(0, bot.health / bot.maxHealth);
    m.hpFill.scale.x = pct;
    m.hpFill.position.x = -(1 - pct) * 0.49;
    const fillMat = m.hpFill.material as THREE.MeshBasicMaterial;
    if (pct > 0.6) fillMat.color.setHex(0x44ff44);
    else if (pct > 0.3) fillMat.color.setHex(0xffff44);
    else fillMat.color.setHex(0xff4444);
    m.hpGroup.visible = bot.isAlive;

    // Walk animation
    const speed = Math.hypot(bot.velocity.x, bot.velocity.z);
    const isMoving = speed > 0.5;
    m.walkPhase += dt * (isMoving ? speed * 2.2 : 0.0);
    const swing = isMoving ? Math.sin(m.walkPhase) * 0.7 : 0;
    m.leftLeg.rotation.x = swing;
    m.rightLeg.rotation.x = -swing;
    m.leftArm.rotation.x = -swing * 0.5;
    m.rightArm.rotation.x = swing * 0.4;

    // Tilt forward when sprinting
    if (speed > 4) {
      m.torso.rotation.x = 0.15;
    } else {
      m.torso.rotation.x = 0;
    }

    // Hit flash decay
    if (m.flashTimer > 0) {
      m.flashTimer -= dt;
      if (m.flashTimer <= 0) {
        m.bodyMat.emissive.setHex(0x000000);
      }
    }

    // Name sprite visible only if relatively close
    if (m.nameSprite) {
      const d = Math.hypot(bot.position.x - cameraPos.x, bot.position.z - cameraPos.z);
      m.nameSprite.visible = d < 30;
    }
  }

  /** Flash white briefly when bot is hit. */
  flashDamage(botId: string): void {
    const m = this.meshes.get(botId);
    if (!m) return;
    m.bodyMat.emissive.setHex(0xff0000);
    m.bodyMat.emissiveIntensity = 1.0;
    m.flashTimer = 0.08;
  }

  /** Start death ragdoll (tilt + sink). */
  startDeathAnimation(botId: string): void {
    const m = this.meshes.get(botId);
    if (!m) return;
    m.deathAnimation = { startTime: performance.now(), duration: 1500 };
  }

  /** Tick death animations. Returns bot IDs that finished. */
  tickDeathAnimations(now: number): string[] {
    const done: string[] = [];
    for (const [id, m] of this.meshes) {
      const anim = m.deathAnimation;
      if (!anim) continue;
      const t = (now - anim.startTime) / anim.duration;
      if (t >= 1) {
        done.push(id);
        continue;
      }
      // Sink
      m.root.position.y = -0.5 * t;
      // Tilt
      m.root.rotation.z = -1.2 * t;
      m.root.rotation.x = 0.4 * t;
      // Fade body
      m.bodyMat.transparent = true;
      m.bodyMat.opacity = 1 - t;
      // Hide HP bar
      m.hpGroup.visible = false;
    }
    return done;
  }

  /** Remove a bot's mesh. */
  removeMesh(botId: string): void {
    const m = this.meshes.get(botId);
    if (!m) return;
    this.scene.remove(m.root);
    this.scene.remove(m.hpGroup);
    m.root.traverse((o: THREE.Object3D) => {
      const mesh = o as THREE.Mesh;
      if ((mesh as any).geometry) (mesh as any).geometry.dispose();
      const mat = (mesh.material as THREE.Material | THREE.Material[] | undefined);
      if (Array.isArray(mat)) mat.forEach((mm) => mm.dispose());
      else if (mat) mat.dispose();
    });
    disposeWeaponModel(m.weapon);
    if (m.nameSprite) {
      (m.nameSprite.material as THREE.SpriteMaterial).map?.dispose();
      (m.nameSprite.material as THREE.SpriteMaterial).dispose();
    }
    (m.hpBg.material as THREE.Material).dispose();
    m.hpBg.geometry.dispose();
    (m.hpFill.material as THREE.Material).dispose();
    m.hpFill.geometry.dispose();
    this.meshes.delete(botId);
  }

  /** Remove all bot meshes. */
  clear(): void {
    for (const id of [...this.meshes.keys()]) this.removeMesh(id);
  }

  dispose(): void {
    this.clear();
  }
}
