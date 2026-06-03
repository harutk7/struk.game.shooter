/**
 * Enemy renderer — creates and manages Three.js meshes for enemies.
 * Takes EnemyData as input, produces visual output.
 */

import * as THREE from 'three';
import type { EnemyData } from '../models/Enemy';
import { GAME_CONFIG } from '../core/GameConfig';

interface EnemyMesh {
  body: THREE.Mesh;
  healthBarBg: THREE.Mesh;
  healthBarFill: THREE.Mesh;
  healthBarGroup: THREE.Group;
  deathAnimation?: {
    startTime: number;
    duration: number;
    startY: number;
    active: boolean;
  };
}

export class EnemyRenderer {
  private scene: THREE.Scene;
  private meshes = new Map<string, EnemyMesh>();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  /** Create a mesh for a newly spawned enemy. */
  createMesh(enemy: EnemyData): void {
    if (this.meshes.has(enemy.id)) return;

    const config = GAME_CONFIG.enemies[enemy.type];
    const { width, height, depth } = config.size;

    // Body
    const bodyGeo = new THREE.BoxGeometry(width, height, depth);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: config.color,
      roughness: 0.7,
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.castShadow = true;
    body.receiveShadow = true;
    body.name = `enemy_${enemy.id}`;
    body.userData.enemyId = enemy.id;
    body.userData.type = 'enemy';

    // Eyes
    const eyeGeo = new THREE.SphereGeometry(0.1, 8, 8);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.15, height * 0.3, -depth / 2 - 0.05);
    body.add(leftEye);
    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.15, height * 0.3, -depth / 2 - 0.05);
    body.add(rightEye);

    // Health bar
    const hbGroup = new THREE.Group();
    const bgGeo = new THREE.PlaneGeometry(1, 0.1);
    const bgMat = new THREE.MeshBasicMaterial({ color: 0x333333, side: THREE.DoubleSide, depthTest: false });
    const bg = new THREE.Mesh(bgGeo, bgMat);
    (bg as any).raycast = () => {}; // Exclude from weapon raycasts
    hbGroup.add(bg);

    const fillGeo = new THREE.PlaneGeometry(0.98, 0.08);
    const fillMat = new THREE.MeshBasicMaterial({ color: 0x44ff44, side: THREE.DoubleSide, depthTest: false });
    const fill = new THREE.Mesh(fillGeo, fillMat);
    fill.position.z = 0.01;
    (fill as any).raycast = () => {}; // Exclude from weapon raycasts
    hbGroup.add(fill);

    this.scene.add(body);
    this.scene.add(hbGroup);

    this.meshes.set(enemy.id, { body, healthBarBg: bg, healthBarFill: fill, healthBarGroup: hbGroup });
  }

  /** Sync mesh positions/rotations with model data. */
  sync(enemy: EnemyData, cameraPos: THREE.Vector3): void {
    const mesh = this.meshes.get(enemy.id);
    if (!mesh) return;

    const { body, healthBarGroup, healthBarFill } = mesh;
    const config = GAME_CONFIG.enemies[enemy.type];

    // Skip dead enemies (death animation handles them)
    if (mesh.deathAnimation?.active) return;

    body.position.set(enemy.position.x, config.size.height / 2, enemy.position.z);

    // Health bar above enemy
    healthBarGroup.position.set(
      enemy.position.x,
      config.size.height + 0.3,
      enemy.position.z,
    );
    healthBarGroup.lookAt(cameraPos.x, healthBarGroup.position.y, cameraPos.z);

    // Health bar fill
    const healthPercent = Math.max(0, enemy.health / enemy.maxHealth);
    healthBarFill.scale.x = healthPercent;
    healthBarFill.position.x = -(1 - healthPercent) * 0.49;

    const fillMat = healthBarFill.material as THREE.MeshBasicMaterial;
    if (healthPercent > 0.6) fillMat.color.setHex(0x44ff44);
    else if (healthPercent > 0.3) fillMat.color.setHex(0xffff44);
    else fillMat.color.setHex(0xff4444);

    // Face player
    if (enemy.state !== 'idle') {
      body.lookAt(cameraPos.x, body.position.y, cameraPos.z);
    }
  }

  /** Start death animation. Returns true when animation completes. */
  startDeathAnimation(enemy: EnemyData): void {
    const mesh = this.meshes.get(enemy.id);
    if (!mesh) return;

    mesh.deathAnimation = {
      startTime: performance.now(),
      duration: 500,
      startY: mesh.body.position.y,
      active: true,
    };
  }

  /** Tick death animations. Returns IDs of enemies whose animations completed. */
  tickDeathAnimations(now: number): string[] {
    const completed: string[] = [];

    for (const [id, mesh] of this.meshes) {
      const anim = mesh.deathAnimation;
      if (!anim?.active) continue;

      const elapsed = now - anim.startTime;
      const progress = Math.min(elapsed / anim.duration, 1);

      mesh.body.position.y = anim.startY * (1 - progress);
      mesh.body.scale.setScalar(1 - progress * 0.5);

      const mat = mesh.body.material as THREE.MeshStandardMaterial;
      mat.transparent = true;
      mat.opacity = 1 - progress;

      // Hide health bar
      mesh.healthBarGroup.visible = progress < 0.5;

      if (progress >= 1) {
        anim.active = false;
        completed.push(id);
      }
    }

    return completed;
  }

  /** Flash enemy white on damage. */
  flashDamage(enemyId: string): void {
    const mesh = this.meshes.get(enemyId);
    if (!mesh) return;

    const mat = mesh.body.material as THREE.MeshStandardMaterial;
    const originalColor = mat.color.getHex();

    mat.color.setHex(0xffffff);
    mat.emissive.setHex(0xff0000);

    setTimeout(() => {
      mat.color.setHex(originalColor);
      mat.emissive.setHex(0x000000);
    }, 80);
  }

  /** Remove and dispose a single enemy mesh. */
  removeMesh(enemyId: string): void {
    const mesh = this.meshes.get(enemyId);
    if (!mesh) return;

    this.scene.remove(mesh.body);
    this.scene.remove(mesh.healthBarGroup);

    mesh.body.geometry?.dispose();
    (mesh.body.material as THREE.Material).dispose();
    mesh.healthBarBg.geometry?.dispose();
    (mesh.healthBarBg.material as THREE.Material).dispose();
    mesh.healthBarFill.geometry?.dispose();
    (mesh.healthBarFill.material as THREE.Material).dispose();

    this.meshes.delete(enemyId);
  }

  /** Remove all meshes. */
  clear(): void {
    for (const id of this.meshes.keys()) {
      this.removeMesh(id);
    }
  }

  dispose(): void {
    this.clear();
  }
}
