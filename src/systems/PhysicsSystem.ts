/**
 * Physics system — handles player movement, gravity, arena clamping,
 * and AABB collision with obstacles.
 */

import { GAME_CONFIG } from '../core/GameConfig';
import type { PlayerState } from '../models/Player';
import type { EnemyData } from '../models/Enemy';
import type { InputSnapshot } from './InputSystem';
import { getSpeedMultiplier } from '../models/Player';

export interface AABBCollider {
  minX: number; minZ: number;
  maxX: number; maxZ: number;
}

export class PhysicsSystem {
  private colliders: AABBCollider[] = [];
  private arenaHalfWidth: number;
  private arenaHalfDepth: number;

  constructor() {
    this.arenaHalfWidth = GAME_CONFIG.arena.width / 2 - 1;
    this.arenaHalfDepth = GAME_CONFIG.arena.depth / 2 - 1;
  }

  setColliders(colliders: AABBCollider[]): void {
    this.colliders = colliders;
  }

  /** Update player physics. cameraYaw is the camera's yaw angle for camera-relative movement. */
  updatePlayer(player: PlayerState, input: InputSnapshot, dt: number, cameraYaw: number): PlayerState {
    if (!player.isAlive) return player;

    let pos = { ...player.position };
    let vel = { ...player.velocity };
    let grounded = player.isGrounded;

    // ── Horizontal movement (camera-relative) ──
    const speedMult = getSpeedMultiplier(player);
    const baseSpeed = GAME_CONFIG.player.moveSpeed * speedMult;
    const speed = input.sprint ? baseSpeed * GAME_CONFIG.player.sprintMultiplier : baseSpeed;

    // Rotate input by camera yaw so W = forward relative to camera
    // Three.js: at yaw=0, camera looks down -Z; at yaw=PI/2, camera looks down +X
    const sinY = Math.sin(cameraYaw);
    const cosY = Math.cos(cameraYaw);
    const worldX = input.moveX * cosY + input.moveY * sinY;
    const worldZ = input.moveX * sinY - input.moveY * cosY;

    const moveX = worldX * speed * dt;
    const moveZ = worldZ * speed * dt;

    // Try X movement
    const newX = pos.x + moveX;
    if (!this.collidesWithWorld(newX, pos.z, 0.4)) {
      pos.x = newX;
    }

    // Try Z movement
    const newZ = pos.z + moveZ;
    if (!this.collidesWithWorld(pos.x, newZ, 0.4)) {
      pos.z = newZ;
    }

    // ── Gravity ──
    if (!grounded) {
      vel.y -= GAME_CONFIG.player.gravity * dt;
    }

    // ── Jump ──
    if (input.jump && grounded) {
      vel.y = GAME_CONFIG.player.jumpForce;
      grounded = false;
    }

    // ── Vertical movement ──
    pos.y += vel.y * dt;

    // Ground clamp
    const groundLevel = GAME_CONFIG.player.height;
    if (pos.y <= groundLevel) {
      pos.y = groundLevel;
      vel.y = 0;
      grounded = true;
    }

    // ── Arena clamp ──
    pos.x = Math.max(-this.arenaHalfWidth, Math.min(this.arenaHalfWidth, pos.x));
    pos.z = Math.max(-this.arenaHalfDepth, Math.min(this.arenaHalfDepth, pos.z));

    return {
      ...player,
      position: pos,
      velocity: vel,
      isGrounded: grounded,
    };
  }

  /** Update enemy physics (movement toward target, simple avoidance). */
  updateEnemy(
    enemy: EnemyData,
    targetPos: { x: number; y: number; z: number },
    dt: number,
  ): EnemyData {
    if (enemy.state === 'dead') return enemy;

    const dx = targetPos.x - enemy.position.x;
    const dz = targetPos.z - enemy.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    let pos = { ...enemy.position };

    if (dist > 0.01) {
      const nx = dx / dist;
      const nz = dz / dist;
      const speed = enemy.speed * dt;

      const newX = pos.x + nx * speed;
      const newZ = pos.z + nz * speed;

      if (!this.collidesWithWorld(newX, pos.z, enemy.size.width / 2)) {
        pos.x = newX;
      }
      if (!this.collidesWithWorld(pos.x, newZ, enemy.size.width / 2)) {
        pos.z = newZ;
      }

      // Arena clamp
      pos.x = Math.max(-this.arenaHalfWidth, Math.min(this.arenaHalfWidth, pos.x));
      pos.z = Math.max(-this.arenaHalfDepth, Math.min(this.arenaHalfDepth, pos.z));
    }

    return { ...enemy, position: pos };
  }

  /** Check if a point (with radius) collides with any world obstacle. */
  collidesWithWorld(x: number, z: number, radius: number): boolean {
    // Arena boundary
    if (
      x - radius < -this.arenaHalfWidth || x + radius > this.arenaHalfWidth ||
      z - radius < -this.arenaHalfDepth || z + radius > this.arenaHalfDepth
    ) {
      return true;
    }

    // Obstacles
    for (const col of this.colliders) {
      if (
        x + radius > col.minX && x - radius < col.maxX &&
        z + radius > col.minZ && z - radius < col.maxZ
      ) {
        return true;
      }
    }

    return false;
  }

  /** Get a random spawn position outside the arena center. */
  getSpawnPosition(minDistFromPlayer: number, playerPos: { x: number; z: number }): { x: number; y: number; z: number } {
    const spawnDist = GAME_CONFIG.waves.spawnDistance;
    const margin = GAME_CONFIG.waves.spawnMargin;

    for (let attempt = 0; attempt < 20; attempt++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = spawnDist + Math.random() * 5;
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;

      // Clamp to arena
      const cx = Math.max(-this.arenaHalfWidth + margin, Math.min(this.arenaHalfWidth - margin, x));
      const cz = Math.max(-this.arenaHalfDepth + margin, Math.min(this.arenaHalfDepth - margin, z));

      // Check distance from player
      const pdx = cx - playerPos.x;
      const pdz = cz - playerPos.z;
      if (Math.sqrt(pdx * pdx + pdz * pdz) >= minDistFromPlayer) {
        return { x: cx, y: 0, z: cz };
      }
    }

    // Fallback
    return { x: spawnDist, y: 0, z: 0 };
  }

  /** Simple distance check between two points. */
  static distance(
    a: { x: number; y: number; z: number },
    b: { x: number; y: number; z: number },
  ): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dz = a.z - b.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  /** Distance ignoring Y. */
  static horizontalDistance(
    a: { x: number; z: number },
    b: { x: number; z: number },
  ): number {
    const dx = a.x - b.x;
    const dz = a.z - b.z;
    return Math.sqrt(dx * dx + dz * dz);
  }
}
