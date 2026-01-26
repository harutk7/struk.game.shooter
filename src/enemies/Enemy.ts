import * as THREE from 'three';
import { EnemyConfig, ENEMY_TYPES } from './EnemyTypes';

export type EnemyState = 'idle' | 'chasing' | 'attacking' | 'dead';

export class Enemy {
  private mesh: THREE.Mesh;
  private config: EnemyConfig;
  private health: number;
  private state: EnemyState = 'idle';
  private position: THREE.Vector3;
  private velocity: THREE.Vector3;
  private lastAttackTime: number = 0;
  private scene: THREE.Scene;
  private id: string;
  
  private target: THREE.Vector3 | null = null;
  
  public onDeath: ((enemy: Enemy) => void) | null = null;
  public onAttack: ((damage: number) => void) | null = null;

  private healthBarContainer: THREE.Group;
  private healthBarFill: THREE.Mesh;

  constructor(scene: THREE.Scene, position: THREE.Vector3, type: string = 'GRUNT') {
    this.scene = scene;
    this.config = ENEMY_TYPES[type] || ENEMY_TYPES.GRUNT;
    this.health = this.config.health;
    this.position = position.clone();
    this.velocity = new THREE.Vector3();
    this.id = Math.random().toString(36).substring(2, 11);
    
    this.mesh = this.createMesh();
    this.mesh.position.copy(this.position);
    this.mesh.userData.enemy = this;
    this.mesh.userData.type = 'enemy';
    this.mesh.name = `enemy_${this.id}`;
    this.scene.add(this.mesh);
    
    this.healthBarContainer = new THREE.Group();
    this.healthBarFill = this.createHealthBar();
    this.scene.add(this.healthBarContainer);
  }

  private createMesh(): THREE.Mesh {
    const { width, height, depth } = this.config.size;
    
    const geometry = new THREE.BoxGeometry(width, height, depth);
    const material = new THREE.MeshStandardMaterial({ 
      color: this.config.color,
      roughness: 0.7,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    
    const eyeGeometry = new THREE.SphereGeometry(0.1, 8, 8);
    const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
    
    const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    leftEye.position.set(-0.15, height * 0.3, -depth / 2 - 0.05);
    mesh.add(leftEye);
    
    const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    rightEye.position.set(0.15, height * 0.3, -depth / 2 - 0.05);
    mesh.add(rightEye);
    
    return mesh;
  }

  private createHealthBar(): THREE.Mesh {
    const bgGeometry = new THREE.PlaneGeometry(1, 0.1);
    const bgMaterial = new THREE.MeshBasicMaterial({ 
      color: 0x333333,
      side: THREE.DoubleSide,
    });
    const bgMesh = new THREE.Mesh(bgGeometry, bgMaterial);
    this.healthBarContainer.add(bgMesh);
    
    const fillGeometry = new THREE.PlaneGeometry(0.98, 0.08);
    const fillMaterial = new THREE.MeshBasicMaterial({ 
      color: 0x44ff44,
      side: THREE.DoubleSide,
    });
    const fillMesh = new THREE.Mesh(fillGeometry, fillMaterial);
    fillMesh.position.z = 0.01;
    this.healthBarContainer.add(fillMesh);
    
    return fillMesh;
  }

  public update(deltaTime: number, playerPosition: THREE.Vector3): void {
    if (this.state === 'dead') return;

    this.target = playerPosition;
    
    const distanceToPlayer = this.position.distanceTo(playerPosition);
    
    if (distanceToPlayer <= this.config.attackRange) {
      this.state = 'attacking';
      this.attack();
    } else if (distanceToPlayer <= this.config.detectionRange) {
      this.state = 'chasing';
      this.chase(deltaTime, playerPosition);
    } else {
      this.state = 'idle';
      this.idle(deltaTime);
    }
    
    this.mesh.position.copy(this.position);
    this.mesh.position.y = this.config.size.height / 2;
    
    this.healthBarContainer.position.copy(this.position);
    this.healthBarContainer.position.y = this.config.size.height + 0.3;
    
    if (this.target) {
      this.healthBarContainer.lookAt(
        playerPosition.x,
        this.healthBarContainer.position.y,
        playerPosition.z
      );
    }
  }

  private idle(deltaTime: number): void {
    if (Math.random() < 0.01) {
      this.velocity.x = (Math.random() - 0.5) * 0.5;
      this.velocity.z = (Math.random() - 0.5) * 0.5;
    }
    
    this.position.x += this.velocity.x * deltaTime;
    this.position.z += this.velocity.z * deltaTime;
    
    this.velocity.multiplyScalar(0.95);
  }

  private chase(deltaTime: number, playerPosition: THREE.Vector3): void {
    const direction = new THREE.Vector3()
      .subVectors(playerPosition, this.position)
      .normalize();
    
    direction.y = 0;
    direction.normalize();
    
    this.position.x += direction.x * this.config.speed * deltaTime;
    this.position.z += direction.z * this.config.speed * deltaTime;
    
    this.mesh.lookAt(playerPosition.x, this.mesh.position.y, playerPosition.z);
  }

  private attack(): void {
    const now = performance.now() / 1000;
    
    if (now - this.lastAttackTime >= this.config.attackCooldown) {
      this.lastAttackTime = now;
      
      if (this.onAttack) {
        this.onAttack(this.config.damage);
      }
      
      this.mesh.scale.set(1.2, 1.2, 1.2);
      setTimeout(() => {
        if (this.mesh) {
          this.mesh.scale.set(1, 1, 1);
        }
      }, 100);
    }
  }

  public takeDamage(amount: number): boolean {
    if (this.state === 'dead') return false;
    
    this.health -= amount;
    
    const healthPercent = Math.max(0, this.health / this.config.health);
    this.healthBarFill.scale.x = healthPercent;
    this.healthBarFill.position.x = -(1 - healthPercent) * 0.49;
    
    const material = this.healthBarFill.material as THREE.MeshBasicMaterial;
    if (healthPercent > 0.6) {
      material.color.setHex(0x44ff44);
    } else if (healthPercent > 0.3) {
      material.color.setHex(0xffff44);
    } else {
      material.color.setHex(0xff4444);
    }
    
    this.flashDamage();
    
    if (this.health <= 0) {
      this.die();
      return true;
    }
    
    return false;
  }

  private flashDamage(): void {
    const material = this.mesh.material as THREE.MeshStandardMaterial;
    const originalColor = this.config.color;
    
    material.color.setHex(0xffffff);
    material.emissive.setHex(0xff0000);
    
    setTimeout(() => {
      material.color.setHex(originalColor);
      material.emissive.setHex(0x000000);
    }, 100);
  }

  private die(): void {
    this.state = 'dead';
    
    const deathDuration = 500;
    const startTime = performance.now();
    const startY = this.mesh.position.y;
    
    const animateDeath = () => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(elapsed / deathDuration, 1);
      
      this.mesh.position.y = startY * (1 - progress);
      this.mesh.scale.setScalar(1 - progress * 0.5);
      (this.mesh.material as THREE.MeshStandardMaterial).opacity = 1 - progress;
      (this.mesh.material as THREE.MeshStandardMaterial).transparent = true;
      
      if (progress < 1) {
        requestAnimationFrame(animateDeath);
      } else {
        this.dispose();
        if (this.onDeath) {
          this.onDeath(this);
        }
      }
    };
    
    animateDeath();
  }

  public dispose(): void {
    this.scene.remove(this.mesh);
    this.scene.remove(this.healthBarContainer);
    
    if (this.mesh.geometry) this.mesh.geometry.dispose();
    if (this.mesh.material) {
      if (Array.isArray(this.mesh.material)) {
        this.mesh.material.forEach(m => m.dispose());
      } else {
        this.mesh.material.dispose();
      }
    }
  }

  public getId(): string {
    return this.id;
  }

  public getPosition(): THREE.Vector3 {
    return this.position.clone();
  }

  public getMesh(): THREE.Mesh {
    return this.mesh;
  }

  public getHealth(): number {
    return this.health;
  }

  public getMaxHealth(): number {
    return this.config.health;
  }

  public getState(): EnemyState {
    return this.state;
  }

  public getPoints(): number {
    return this.config.points;
  }

  public isDead(): boolean {
    return this.state === 'dead';
  }
}
