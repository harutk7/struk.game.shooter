import * as THREE from 'three';
import { FPSControls } from '../controls/FPSControls';
import { InputManager, KeyState } from '../controls/InputManager';

export interface PlayerConfig {
  moveSpeed: number;
  sprintMultiplier: number;
  jumpForce: number;
  gravity: number;
  height: number;
}

export class Player {
  private camera: THREE.PerspectiveCamera;
  private controls: FPSControls;
  private inputManager: InputManager;
  
  private velocity: THREE.Vector3;
  private position: THREE.Vector3;
  private isGrounded: boolean = true;
  
  private config: PlayerConfig;
  
  private health: number = 100;
  private maxHealth: number = 100;

  constructor(
    camera: THREE.PerspectiveCamera,
    controls: FPSControls,
    inputManager: InputManager,
    config?: Partial<PlayerConfig>
  ) {
    this.camera = camera;
    this.controls = controls;
    this.inputManager = inputManager;
    
    this.velocity = new THREE.Vector3();
    this.position = new THREE.Vector3(0, 1.7, 5);
    
    this.config = {
      moveSpeed: 5,
      sprintMultiplier: 1.5,
      jumpForce: 8,
      gravity: 20,
      height: 1.7,
      ...config,
    };

    this.camera.position.copy(this.position);
  }

  public update(deltaTime: number): void {
    if (!this.controls.getIsLocked()) return;

    const keyState = this.inputManager.getKeyState();
    
    this.handleMovement(keyState, deltaTime);
    this.handleJumpAndGravity(keyState, deltaTime);
    
    this.camera.position.copy(this.position);
  }

  private handleMovement(keyState: KeyState, deltaTime: number): void {
    const forward = this.controls.getForwardDirection();
    const right = this.controls.getRightDirection();
    
    let speed = this.config.moveSpeed;
    if (keyState.sprint && this.isGrounded) {
      speed *= this.config.sprintMultiplier;
    }
    
    const moveDirection = new THREE.Vector3();
    
    if (keyState.forward) {
      moveDirection.add(forward);
    }
    if (keyState.backward) {
      moveDirection.sub(forward);
    }
    
    if (keyState.left) {
      moveDirection.sub(right);
    }
    if (keyState.right) {
      moveDirection.add(right);
    }
    
    if (moveDirection.length() > 0) {
      moveDirection.normalize();
    }
    
    this.position.x += moveDirection.x * speed * deltaTime;
    this.position.z += moveDirection.z * speed * deltaTime;
  }

  private handleJumpAndGravity(keyState: KeyState, deltaTime: number): void {
    if (!this.isGrounded) {
      this.velocity.y -= this.config.gravity * deltaTime;
    }
    
    if (keyState.jump && this.isGrounded) {
      this.velocity.y = this.config.jumpForce;
      this.isGrounded = false;
    }
    
    this.position.y += this.velocity.y * deltaTime;
    
    const groundLevel = this.config.height;
    if (this.position.y < groundLevel) {
      this.position.y = groundLevel;
      this.velocity.y = 0;
      this.isGrounded = true;
    }
  }

  public takeDamage(amount: number): void {
    this.health = Math.max(0, this.health - amount);
    if (this.health <= 0) {
      this.onDeath();
    }
  }

  public heal(amount: number): void {
    this.health = Math.min(this.maxHealth, this.health + amount);
  }

  private onDeath(): void {
    console.log('Player died!');
  }

  public getHealth(): number {
    return this.health;
  }

  public getMaxHealth(): number {
    return this.maxHealth;
  }

  public getPosition(): THREE.Vector3 {
    return this.position.clone();
  }

  public isOnGround(): boolean {
    return this.isGrounded;
  }

  public getVelocity(): THREE.Vector3 {
    return this.velocity.clone();
  }

  public setPosition(x: number, y: number, z: number): void {
    this.position.set(x, y + this.config.height, z);
    this.camera.position.copy(this.position);
  }

  public reset(): void {
    this.health = this.maxHealth;
    this.position.set(0, this.config.height, 5);
    this.velocity.set(0, 0, 0);
    this.isGrounded = true;
    this.camera.position.copy(this.position);
  }
}
