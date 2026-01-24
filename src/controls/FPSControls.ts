import * as THREE from 'three';

export class FPSControls {
  private camera: THREE.Camera;
  private domElement: HTMLElement;
  
  private euler: THREE.Euler;
  private PI_2 = Math.PI / 2;
  
  private mouseSensitivity: number = 0.002;
  
  private isLocked: boolean = false;
  
  private minPolarAngle: number = 0;
  private maxPolarAngle: number = Math.PI;

  public onLock: (() => void) | null = null;
  public onUnlock: (() => void) | null = null;

  constructor(camera: THREE.Camera, domElement: HTMLElement) {
    this.camera = camera;
    this.domElement = domElement;
    this.euler = new THREE.Euler(0, 0, 0, 'YXZ');
    
    this.init();
  }

  private init(): void {
    document.addEventListener('pointerlockchange', this.onPointerLockChange.bind(this));
    document.addEventListener('pointerlockerror', this.onPointerLockError.bind(this));
    
    document.addEventListener('mousemove', this.onMouseMove.bind(this));
    
    this.domElement.addEventListener('click', this.lock.bind(this));
  }

  private onPointerLockChange(): void {
    if (document.pointerLockElement === this.domElement) {
      this.isLocked = true;
      if (this.onLock) this.onLock();
    } else {
      this.isLocked = false;
      if (this.onUnlock) this.onUnlock();
    }
  }

  private onPointerLockError(): void {
    console.error('Pointer lock error occurred');
  }

  private onMouseMove(event: MouseEvent): void {
    if (!this.isLocked) return;

    const movementX = event.movementX || 0;
    const movementY = event.movementY || 0;

    this.euler.setFromQuaternion(this.camera.quaternion);

    this.euler.y -= movementX * this.mouseSensitivity;
    this.euler.x -= movementY * this.mouseSensitivity;

    this.euler.x = Math.max(
      this.PI_2 - this.maxPolarAngle,
      Math.min(this.PI_2 - this.minPolarAngle, this.euler.x)
    );

    this.camera.quaternion.setFromEuler(this.euler);
  }

  public lock(): void {
    this.domElement.requestPointerLock();
  }

  public unlock(): void {
    document.exitPointerLock();
  }

  public getIsLocked(): boolean {
    return this.isLocked;
  }

  public setSensitivity(sensitivity: number): void {
    this.mouseSensitivity = sensitivity;
  }

  public getSensitivity(): number {
    return this.mouseSensitivity;
  }

  public getDirection(): THREE.Vector3 {
    const direction = new THREE.Vector3(0, 0, -1);
    return direction.applyQuaternion(this.camera.quaternion);
  }

  public getForwardDirection(): THREE.Vector3 {
    const direction = new THREE.Vector3();
    this.camera.getWorldDirection(direction);
    direction.y = 0;
    direction.normalize();
    return direction;
  }

  public getRightDirection(): THREE.Vector3 {
    const forward = this.getForwardDirection();
    return new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
  }

  public dispose(): void {
    document.removeEventListener('pointerlockchange', this.onPointerLockChange.bind(this));
    document.removeEventListener('pointerlockerror', this.onPointerLockError.bind(this));
    document.removeEventListener('mousemove', this.onMouseMove.bind(this));
    this.domElement.removeEventListener('click', this.lock.bind(this));
  }
}
