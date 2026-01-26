import * as THREE from 'three';
import { WeaponConfig, WeaponState, WEAPONS } from './WeaponTypes';

export interface HitResult {
  hit: boolean;
  point?: THREE.Vector3;
  normal?: THREE.Vector3;
  distance?: number;
  object?: THREE.Object3D;
}

export class Weapon {
  private config: WeaponConfig;
  private state: WeaponState;
  private camera: THREE.Camera;
  private scene: THREE.Scene;
  private raycaster: THREE.Raycaster;
  
  private muzzleFlash: THREE.PointLight | null = null;
  
  public onFire: ((hitResult: HitResult) => void) | null = null;
  public onReloadStart: (() => void) | null = null;
  public onReloadEnd: (() => void) | null = null;
  public onAmmoChange: ((current: number, reserve: number) => void) | null = null;

  constructor(camera: THREE.Camera, scene: THREE.Scene, weaponType: string = 'PISTOL') {
    this.camera = camera;
    this.scene = scene;
    this.config = WEAPONS[weaponType] || WEAPONS.PISTOL;
    this.raycaster = new THREE.Raycaster();
    
    this.state = {
      currentAmmo: this.config.magazineSize,
      reserveAmmo: this.config.magazineSize * 3,
      isReloading: false,
      canFire: true,
      lastFireTime: 0,
    };

    this.setupMuzzleFlash();
  }

  private setupMuzzleFlash(): void {
    this.muzzleFlash = new THREE.PointLight(0xffaa00, 3, 10);
    this.muzzleFlash.visible = false;
    this.scene.add(this.muzzleFlash);
  }

  public fire(): HitResult {
    const now = performance.now();
    const timeSinceLastFire = (now - this.state.lastFireTime) / 1000;
    const fireInterval = 1 / this.config.fireRate;

    if (!this.state.canFire || this.state.isReloading) {
      return { hit: false };
    }

    if (timeSinceLastFire < fireInterval) {
      return { hit: false };
    }

    if (this.state.currentAmmo <= 0) {
      this.reload();
      return { hit: false };
    }

    this.state.lastFireTime = now;
    this.state.currentAmmo--;

    if (this.onAmmoChange) {
      this.onAmmoChange(this.state.currentAmmo, this.state.reserveAmmo);
    }

    const hitResult = this.performRaycast();

    this.showMuzzleFlash();

    this.createBulletTrail(hitResult);

    if (this.onFire) {
      this.onFire(hitResult);
    }

    if (!this.config.automatic) {
      this.state.canFire = false;
    }

    return hitResult;
  }

  public releaseTrigger(): void {
    this.state.canFire = true;
  }

  private performRaycast(): HitResult {
    const direction = new THREE.Vector3();
    this.camera.getWorldDirection(direction);

    if (this.config.spread > 0) {
      const spreadRad = THREE.MathUtils.degToRad(this.config.spread);
      direction.x += (Math.random() - 0.5) * spreadRad;
      direction.y += (Math.random() - 0.5) * spreadRad;
      direction.normalize();
    }

    this.raycaster.set(this.camera.position, direction);
    this.raycaster.far = this.config.range;

    const intersects = this.raycaster.intersectObjects(
      this.scene.children.filter(obj => obj.type === 'Mesh'),
      true
    );

    if (intersects.length > 0) {
      const hit = intersects[0];
      return {
        hit: true,
        point: hit.point,
        normal: (hit as any).face?.normal,
        distance: hit.distance,
        object: hit.object,
      };
    }

    return { hit: false };
  }

  private showMuzzleFlash(): void {
    if (!this.muzzleFlash) return;

    const flashPosition = new THREE.Vector3();
    this.camera.getWorldDirection(flashPosition);
    flashPosition.multiplyScalar(0.5);
    flashPosition.add(this.camera.position);
    flashPosition.y -= 0.1;

    this.muzzleFlash.position.copy(flashPosition);
    this.muzzleFlash.visible = true;

    setTimeout(() => {
      if (this.muzzleFlash) {
        this.muzzleFlash.visible = false;
      }
    }, 50);
  }

  private createBulletTrail(hitResult: HitResult): void {
    const startPoint = this.camera.position.clone();
    startPoint.y -= 0.1;

    let endPoint: THREE.Vector3;
    
    if (hitResult.hit && hitResult.point) {
      endPoint = hitResult.point.clone();
      this.createImpactEffect(hitResult);
    } else {
      const direction = new THREE.Vector3();
      this.camera.getWorldDirection(direction);
      endPoint = startPoint.clone().add(direction.multiplyScalar(this.config.range));
    }

    const geometry = new THREE.BufferGeometry().setFromPoints([startPoint, endPoint]);
    const material = new THREE.LineBasicMaterial({ 
      color: 0xffff00,
      transparent: true,
      opacity: 0.6,
    });
    const trail = new THREE.Line(geometry, material);
    this.scene.add(trail);

    let opacity = 0.6;
    const fadeInterval = setInterval(() => {
      opacity -= 0.1;
      (material as THREE.LineBasicMaterial).opacity = opacity;
      if (opacity <= 0) {
        clearInterval(fadeInterval);
        this.scene.remove(trail);
        geometry.dispose();
        material.dispose();
      }
    }, 20);
  }

  private createImpactEffect(hitResult: HitResult): void {
    if (!hitResult.point) return;

    const geometry = new THREE.SphereGeometry(0.1, 8, 8);
    const material = new THREE.MeshBasicMaterial({ 
      color: 0xff4400,
      transparent: true,
      opacity: 1,
    });
    const impact = new THREE.Mesh(geometry, material);
    impact.position.copy(hitResult.point);
    this.scene.add(impact);

    const ringGeometry = new THREE.RingGeometry(0.05, 0.15, 16);
    const ringMaterial = new THREE.MeshBasicMaterial({ 
      color: 0xff6600,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.position.copy(hitResult.point);
    
    ring.lookAt(this.camera.position);
    this.scene.add(ring);

    let scale = 1;
    let opacity = 1;
    const animateInterval = setInterval(() => {
      scale += 0.3;
      opacity -= 0.1;
      
      ring.scale.set(scale, scale, scale);
      ringMaterial.opacity = opacity;
      material.opacity = opacity;
      
      if (opacity <= 0) {
        clearInterval(animateInterval);
        this.scene.remove(impact);
        this.scene.remove(ring);
        geometry.dispose();
        material.dispose();
        ringGeometry.dispose();
        ringMaterial.dispose();
      }
    }, 30);
  }

  public reload(): void {
    if (this.state.isReloading) return;
    if (this.state.currentAmmo === this.config.magazineSize) return;
    if (this.state.reserveAmmo <= 0) return;

    this.state.isReloading = true;
    this.state.canFire = false;

    if (this.onReloadStart) {
      this.onReloadStart();
    }

    setTimeout(() => {
      const needed = this.config.magazineSize - this.state.currentAmmo;
      const toLoad = Math.min(needed, this.state.reserveAmmo);
      
      this.state.currentAmmo += toLoad;
      this.state.reserveAmmo -= toLoad;
      this.state.isReloading = false;
      this.state.canFire = true;

      if (this.onAmmoChange) {
        this.onAmmoChange(this.state.currentAmmo, this.state.reserveAmmo);
      }

      if (this.onReloadEnd) {
        this.onReloadEnd();
      }
    }, this.config.reloadTime * 1000);
  }

  public getConfig(): WeaponConfig {
    return { ...this.config };
  }

  public getState(): WeaponState {
    return { ...this.state };
  }

  public getCurrentAmmo(): number {
    return this.state.currentAmmo;
  }

  public getReserveAmmo(): number {
    return this.state.reserveAmmo;
  }

  public isReloading(): boolean {
    return this.state.isReloading;
  }

  public getDamage(): number {
    return this.config.damage;
  }

  public addAmmo(amount: number): void {
    this.state.reserveAmmo += amount;
    if (this.onAmmoChange) {
      this.onAmmoChange(this.state.currentAmmo, this.state.reserveAmmo);
    }
  }

  public dispose(): void {
    if (this.muzzleFlash) {
      this.scene.remove(this.muzzleFlash);
    }
  }
}
