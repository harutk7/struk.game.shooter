/**
 * Bot renderer — composes a procedural humanoid `BotBody` (head, torso, arms,
 * legs; see BotBodyRenderer.ts) under a position/yaw root, and layers on the
 * non-body presentation: a held weapon, a billboard health bar, a name sprite
 * and a hit-flash. All geometry is procedurally generated (no asset files).
 *
 * The body itself owns the walk / idle / death animation; this class only
 * feeds it per-frame state (movement, cumulative distance) and drives the
 * death-animation clock.
 */

import * as THREE from 'three';
import type { BotData } from '../models/Bot';
import { buildWeaponModel, disposeWeaponModel } from './WeaponModels';
import { BotBody } from './BotBodyRenderer';

interface BotMesh {
  root: THREE.Group;
  body: BotBody;
  weapon: THREE.Group;
  bodyMat: THREE.MeshStandardMaterial;
  nameSprite?: THREE.Sprite;
  hpBg: THREE.Mesh;
  hpFill: THREE.Mesh;
  hpGroup: THREE.Group;
  flashTimer: number;
  /** Set once the bot dies; holds the last frame time so we can derive dt. */
  death?: { lastNow: number };
  /** Cumulative distance travelled (m) — drives the body's walk phase. */
  distanceTraveled: number;
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

    // Procedural humanoid body (per-bot team colour).
    const body = new BotBody({ color: bot.color });
    root.add(body.group);

    // Weapon in the right hand.
    const weapon = buildWeaponModel(bot.weapon);
    weapon.scale.setScalar(0.85); // smaller than the player FPV weapon
    weapon.position.set(0, -0.06, 0.12);
    weapon.rotation.set(0, Math.PI, 0);
    body.rightHand.add(weapon);

    // Health bar (billboarded toward the camera in sync()).
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

    // Name sprite (cheap: textured plane with bot name baked onto canvas).
    const sprite = this.createNameSprite(bot.name, bot.color);
    sprite.position.y = 1.3;
    root.add(sprite);

    this.scene.add(root);

    this.meshes.set(bot.id, {
      root, body, weapon,
      bodyMat: body.material, nameSprite: sprite, hpBg, hpFill, hpGroup,
      flashTimer: 0, distanceTraveled: Math.random() * 4,
    });
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
    if (m.death) return; // ragdoll handles itself

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

    // Drive the body's walk/idle animation. Phase is distance-based, so we
    // accumulate distance from speed only while actually moving.
    const speed = Math.hypot(bot.velocity.x, bot.velocity.z);
    const isMoving = speed > 0.5;
    if (isMoving) m.distanceTraveled += speed * dt;
    m.body.tick({ dt, isMoving, distanceTraveled: m.distanceTraveled });

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

  /** Start the death ragdoll (forward lean + buckle, then fade). */
  startDeathAnimation(botId: string): void {
    const m = this.meshes.get(botId);
    if (!m) return;
    if (m.death) return;
    m.body.setAlive(false);
    m.death = { lastNow: performance.now() };
    m.hpGroup.visible = false;
  }

  /** Tick death animations. Returns bot IDs whose animation finished. */
  tickDeathAnimations(now: number): string[] {
    const done: string[] = [];
    for (const [id, m] of this.meshes) {
      if (!m.death) continue;
      // Derive dt from frame timing, clamped so a long pause can't snap it.
      const dt = Math.max(0, Math.min(0.1, (now - m.death.lastNow) / 1000));
      m.death.lastNow = now;
      m.body.tick({ dt, isMoving: false, distanceTraveled: m.distanceTraveled });
      m.hpGroup.visible = false;
      if (m.body.isDeathComplete()) done.push(id);
    }
    return done;
  }

  /** Remove a bot's mesh. */
  removeMesh(botId: string): void {
    const m = this.meshes.get(botId);
    if (!m) return;
    this.scene.remove(m.root);
    this.scene.remove(m.hpGroup);
    m.body.dispose();
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
