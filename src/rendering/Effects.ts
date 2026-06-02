/**
 * Visual effects — screen shake, damage flash, power-up rendering.
 * All effects use proper lifecycle management.
 */

import * as THREE from 'three';
import type { PowerUpData } from '../models/PowerUp';

export class Effects {
  private scene: THREE.Scene;
  private camera: THREE.Camera;

  // Screen shake
  private shakeIntensity = 0;
  private shakeDuration = 0;
  private shakeTimer = 0;
  private originalCameraPos = new THREE.Vector3();

  // Power-up meshes
  private powerUpMeshes = new Map<string, THREE.Mesh>();

  // Damage flash
  private damageOverlay: HTMLDivElement | null = null;
  private damageTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(scene: THREE.Scene, camera: THREE.Camera) {
    this.scene = scene;
    this.camera = camera;
  }

  /* ── Screen shake ── */

  triggerShake(intensity: number, duration: number): void {
    this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
    this.shakeDuration = duration;
    this.shakeTimer = 0;
    this.originalCameraPos.copy(this.camera.position);
  }

  tickShake(dt: number): void {
    if (this.shakeTimer >= this.shakeDuration) {
      if (this.shakeIntensity > 0) {
        this.camera.position.copy(this.originalCameraPos);
        this.shakeIntensity = 0;
      }
      return;
    }

    this.shakeTimer += dt;
    const progress = this.shakeTimer / this.shakeDuration;
    const currentIntensity = this.shakeIntensity * (1 - progress);

    this.camera.position.x = this.originalCameraPos.x + (Math.random() - 0.5) * currentIntensity * 2;
    this.camera.position.y = this.originalCameraPos.y + (Math.random() - 0.5) * currentIntensity * 2;
    this.camera.position.z = this.originalCameraPos.z + (Math.random() - 0.5) * currentIntensity * 0.5;
  }

  /* ── Damage flash ── */

  flashDamage(): void {
    if (this.damageTimeout) {
      clearTimeout(this.damageTimeout);
    }

    if (!this.damageOverlay) {
      this.damageOverlay = document.createElement('div');
      Object.assign(this.damageOverlay.style, {
        position: 'fixed',
        top: '0',
        left: '0',
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(255, 0, 0, 0.25)',
        pointerEvents: 'none',
        zIndex: '998',
        transition: 'opacity 0.1s',
      });
      document.body.appendChild(this.damageOverlay);
    }

    this.damageOverlay.style.opacity = '1';
    this.damageTimeout = setTimeout(() => {
      if (this.damageOverlay) {
        this.damageOverlay.style.opacity = '0';
      }
    }, 100);
  }

  /* ── Power-up rendering ── */

  createPowerUpMesh(powerUp: PowerUpData): void {
    if (this.powerUpMeshes.has(powerUp.id)) return;

    const geo = new THREE.OctahedronGeometry(0.3, 0);
    const colors: Record<string, number> = {
      healthPack: 0xff4444,
      ammoPack: 0xffaa00,
      speedBoost: 0x44aaff,
      damageBoost: 0xff44ff,
    };
    const mat = new THREE.MeshStandardMaterial({
      color: colors[powerUp.type] ?? 0xffffff,
      emissive: colors[powerUp.type] ?? 0xffffff,
      emissiveIntensity: 0.5,
      roughness: 0.3,
      metalness: 0.5,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(powerUp.position.x, powerUp.position.y, powerUp.position.z);
    mesh.userData.powerUpId = powerUp.id;
    mesh.userData.type = 'powerUp';
    mesh.castShadow = true;
    this.scene.add(mesh);
    this.powerUpMeshes.set(powerUp.id, mesh);
  }

  syncPowerUp(powerUp: PowerUpData, time: number): void {
    const mesh = this.powerUpMeshes.get(powerUp.id);
    if (!mesh) return;

    // Bob up and down
    mesh.position.y = powerUp.position.y + Math.sin(time * 3 + powerUp.bobOffset) * 0.15;
    mesh.rotation.y += 0.02;
    mesh.rotation.x += 0.01;

    // Flash when about to expire
    if (powerUp.lifetime < 3) {
      const mat = mesh.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 0.5 + Math.sin(time * 10) * 0.5;
    }
  }

  removePowerUpMesh(id: string): void {
    const mesh = this.powerUpMeshes.get(id);
    if (!mesh) return;

    this.scene.remove(mesh);
    mesh.geometry?.dispose();
    (mesh.material as THREE.Material).dispose();
    this.powerUpMeshes.delete(id);
  }

  clearPowerUps(): void {
    for (const id of this.powerUpMeshes.keys()) {
      this.removePowerUpMesh(id);
    }
  }

  /* ── Cleanup ── */

  dispose(): void {
    if (this.damageTimeout) clearTimeout(this.damageTimeout);
    if (this.damageOverlay && document.body.contains(this.damageOverlay)) {
      document.body.removeChild(this.damageOverlay);
    }
    this.clearPowerUps();
  }
}
