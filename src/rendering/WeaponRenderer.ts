/**
 * Weapon renderer — muzzle flash, bullet trails, impact effects.
 * Uses object pooling for all transient effects.
 */

import * as THREE from 'three';
import { ObjectPool } from './ObjectPool';

interface TrailData {
  line: THREE.Line;
  material: THREE.LineBasicMaterial;
  createdAt: number;
  lifetime: number;
}

interface ImpactData {
  sphere: THREE.Mesh;
  ring: THREE.Mesh;
  ringMaterial: THREE.MeshBasicMaterial;
  sphereMaterial: THREE.MeshBasicMaterial;
  createdAt: number;
  lifetime: number;
}

interface BloodData {
  group: THREE.Group;
  sprites: THREE.Sprite[];
  velocities: Array<{ x: number; y: number; z: number }>;
  createdAt: number;
  lifetime: number;
}

export class WeaponRenderer {
  private scene: THREE.Scene;
  private camera: THREE.Camera;
  private muzzleFlash: THREE.PointLight;
  private muzzleFlashSprite: THREE.Sprite;
  private flashTextureReady = false;

  /** Camera-parented viewmodel group. All materials have fog:false. */
  public readonly weaponGroup: THREE.Group;

  private trailPool: ObjectPool<TrailData>;
  private impactPool: ObjectPool<ImpactData>;
  private bloodPool: ObjectPool<BloodData>;

  private activeTrails: TrailData[] = [];
  private activeImpacts: ImpactData[] = [];
  private activeBlood: BloodData[] = [];

  // Cached for the blood animation delta-time
  private lastTickDt = 0;
  private _lastTickTime: number | null = null;

  constructor(scene: THREE.Scene, camera: THREE.Camera) {
    this.scene = scene;
    this.camera = camera;

    // Weapon viewmodel — attached to camera, materials opt out of scene fog
    this.weaponGroup = this.createWeaponGroup();
    this.camera.add(this.weaponGroup);

    // Muzzle flash light
    this.muzzleFlash = new THREE.PointLight(0xffaa00, 3, 10);
    this.muzzleFlash.visible = false;
    this.scene.add(this.muzzleFlash);

    // Muzzle flash sprite — texture is lazy so the constructor has no DOM dependency
    const spriteMat = new THREE.SpriteMaterial({
      map: null,
      color: 0xffaa00,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.muzzleFlashSprite = new THREE.Sprite(spriteMat);
    this.muzzleFlashSprite.scale.set(0.5, 0.5, 1);
    this.muzzleFlashSprite.visible = false;
    // Sprite.raycast requires raycaster.camera to be set; exclude from weapon raycasts
    (this.muzzleFlashSprite as any).raycast = () => {};
    this.scene.add(this.muzzleFlashSprite);

    // Trail pool
    this.trailPool = new ObjectPool<TrailData>(
      () => this.createTrailData(),
      (t) => this.resetTrail(t),
      30,
    );

    // Impact pool
    this.impactPool = new ObjectPool<ImpactData>(
      () => this.createImpactData(),
      (i) => this.resetImpact(i),
      20,
    );

    // Blood pool
    this.bloodPool = new ObjectPool<BloodData>(
      () => this.createBloodData(),
      (b) => this.resetBlood(b),
      12,
    );
  }

  private createWeaponGroup(): THREE.Group {
    const group = new THREE.Group();
    const bodyGeo = new THREE.BoxGeometry(0.07, 0.055, 0.38);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x2a2a2a, roughness: 0.5, metalness: 0.65, fog: false,
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.name = 'weaponBody';
    body.position.set(0.18, -0.16, -0.32);
    group.add(body);

    const gripGeo = new THREE.BoxGeometry(0.045, 0.10, 0.07);
    const gripMat = new THREE.MeshStandardMaterial({
      color: 0x111111, roughness: 0.9, fog: false,
    });
    const grip = new THREE.Mesh(gripGeo, gripMat);
    grip.name = 'weaponGrip';
    grip.position.set(0.0, -0.065, 0.04);
    body.add(grip);

    return group;
  }

  private createFlashTexture(): THREE.Texture {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255,255,200,1)');
    gradient.addColorStop(0.2, 'rgba(255,200,50,0.8)');
    gradient.addColorStop(0.5, 'rgba(255,100,0,0.3)');
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(canvas);
  }

  private createTrailData(): TrailData {
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(), new THREE.Vector3(),
    ]);
    const mat = new THREE.LineBasicMaterial({
      color: 0xffff00,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
    });
    const line = new THREE.Line(geo, mat);
    line.visible = false;
    this.scene.add(line);
    return { line, material: mat, createdAt: 0, lifetime: 0.15 };
  }

  private resetTrail(t: TrailData): void {
    t.line.visible = false;
    t.material.opacity = 0.6;
  }

  private createImpactData(): ImpactData {
    const sphereGeo = new THREE.SphereGeometry(0.08, 8, 8);
    const sphereMat = new THREE.MeshBasicMaterial({
      color: 0xff4400,
      transparent: true,
      opacity: 1,
      depthWrite: false,
    });
    const sphere = new THREE.Mesh(sphereGeo, sphereMat);
    sphere.visible = false;
    this.scene.add(sphere);

    const ringGeo = new THREE.RingGeometry(0.05, 0.15, 16);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xff6600,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.visible = false;
    this.scene.add(ring);

    return { sphere, ring, ringMaterial: ringMat, sphereMaterial: sphereMat, createdAt: 0, lifetime: 0.3 };
  }

  private resetImpact(i: ImpactData): void {
    i.sphere.visible = false;
    i.ring.visible = false;
    i.sphereMaterial.opacity = 1;
    i.ringMaterial.opacity = 0.8;
    i.ring.scale.set(1, 1, 1);
  }

  /** Create a small puff of red sprite particles for a hit on flesh. */
  private createBloodData(): BloodData {
    const group = new THREE.Group();
    const sprites: THREE.Sprite[] = [];
    const velocities: Array<{ x: number; y: number; z: number }> = [];
    const N = 6;
    for (let i = 0; i < N; i++) {
      const mat = new THREE.SpriteMaterial({
        color: 0xaa1010,
        transparent: true,
        opacity: 1,
        depthWrite: false,
      });
      const s = new THREE.Sprite(mat);
      s.scale.set(0.10, 0.10, 1);
      s.visible = false;
      (s as any).raycast = () => {};
      group.add(s);
      sprites.push(s);
      velocities.push({ x: 0, y: 0, z: 0 });
    }
    this.scene.add(group);
    return { group, sprites, velocities, createdAt: 0, lifetime: 0.6 };
  }

  private resetBlood(b: BloodData): void {
    b.group.visible = false;
    for (const s of b.sprites) {
      s.visible = false;
      (s.material as THREE.SpriteMaterial).opacity = 1;
    }
  }

  /** Spawn a blood splatter at `point`, flung outward by `normal`. */
  createBlood(point: THREE.Vector3, normal?: THREE.Vector3): void {
    const b = this.bloodPool.acquire();
    b.group.position.copy(point);
    b.group.visible = true;
    for (let i = 0; i < b.sprites.length; i++) {
      const s = b.sprites[i];
      s.visible = true;
      s.position.set(0, 0, 0);
      // Random outward velocity, biased along the normal
      const nx = normal?.x ?? 0;
      const ny = normal?.y ?? 0;
      const nz = normal?.z ?? 0;
      const jx = (Math.random() - 0.5) * 1.5;
      const jy = Math.random() * 1.0;
      const jz = (Math.random() - 0.5) * 1.5;
      b.velocities[i] = {
        x: nx * 2 + jx,
        y: ny * 2 + jy,
        z: nz * 2 + jz,
      };
    }
    b.createdAt = performance.now();
    this.activeBlood.push(b);
  }

  /** Show muzzle flash at camera position. */
  showMuzzleFlash(): void {
    if (!this.flashTextureReady) {
      this.muzzleFlashSprite.material.map = this.createFlashTexture();
      this.flashTextureReady = true;
    }

    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    const pos = this.camera.position.clone().add(dir.multiplyScalar(0.5));
    pos.y -= 0.1;

    this.muzzleFlash.position.copy(pos);
    this.muzzleFlash.visible = true;
    this.muzzleFlashSprite.position.copy(pos);
    this.muzzleFlashSprite.visible = true;

    setTimeout(() => {
      this.muzzleFlash.visible = false;
      this.muzzleFlashSprite.visible = false;
    }, 50);
  }

  /** Create a bullet trail from origin to target. */
  createTrail(from: THREE.Vector3, to: THREE.Vector3, hit: boolean): void {
    const trail = this.trailPool.acquire();
    const geo = trail.line.geometry as THREE.BufferGeometry;
    geo.setFromPoints([from, to]);
    trail.line.visible = true;
    trail.material.opacity = 0.6;
    trail.material.color.setHex(hit ? 0xffaa00 : 0xffff00);
    trail.createdAt = performance.now();
    this.activeTrails.push(trail);
  }

  /** Create impact effect at a point. */
  createImpact(point: THREE.Vector3, normal?: THREE.Vector3): void {
    const impact = this.impactPool.acquire();
    impact.sphere.position.copy(point);
    impact.sphere.visible = true;
    impact.sphereMaterial.opacity = 1;

    impact.ring.position.copy(point);
    if (normal) {
      impact.ring.lookAt(point.clone().add(normal));
    } else {
      impact.ring.lookAt(this.camera.position);
    }
    impact.ring.visible = true;
    impact.ringMaterial.opacity = 0.8;
    impact.ring.scale.set(1, 1, 1);
    impact.createdAt = performance.now();
    this.activeImpacts.push(impact);
  }

  /** Tick animations. Call every frame. */
  tick(now: number): void {
    // Fade trails
    for (let i = this.activeTrails.length - 1; i >= 0; i--) {
      const t = this.activeTrails[i];
      const age = (now - t.createdAt) / 1000;
      const progress = age / t.lifetime;

      if (progress >= 1) {
        this.activeTrails.splice(i, 1);
        this.trailPool.release(t);
      } else {
        t.material.opacity = 0.6 * (1 - progress);
      }
    }

    // Animate impacts
    for (let i = this.activeImpacts.length - 1; i >= 0; i--) {
      const imp = this.activeImpacts[i];
      const age = (now - imp.createdAt) / 1000;
      const progress = age / imp.lifetime;

      if (progress >= 1) {
        this.activeImpacts.splice(i, 1);
        this.impactPool.release(imp);
      } else {
        const scale = 1 + progress * 3;
        imp.ring.scale.set(scale, scale, scale);
        imp.ringMaterial.opacity = 0.8 * (1 - progress);
        imp.sphereMaterial.opacity = 1 - progress;
      }
    }

    // Animate blood splatter
    this.lastTickDt = (now - (this._lastTickTime ?? now)) / 1000;
    this._lastTickTime = now;
    const useDt = Math.min(this.lastTickDt, 0.05);
    for (let i = this.activeBlood.length - 1; i >= 0; i--) {
      const b = this.activeBlood[i];
      const age = (now - b.createdAt) / 1000;
      const progress = age / b.lifetime;
      if (progress >= 1) {
        this.activeBlood.splice(i, 1);
        this.bloodPool.release(b);
        continue;
      }
      for (let j = 0; j < b.sprites.length; j++) {
        const s = b.sprites[j];
        const v = b.velocities[j];
        s.position.x += v.x * useDt;
        s.position.y += v.y * useDt - 3 * useDt * progress; // mild gravity
        s.position.z += v.z * useDt;
        const mat = s.material as THREE.SpriteMaterial;
        mat.opacity = 1 - progress;
        const sc = 0.10 * (1 - progress * 0.4);
        s.scale.set(sc, sc, 1);
      }
    }
  }

  dispose(): void {
    this.camera.remove(this.weaponGroup);

    this.scene.remove(this.muzzleFlash);
    this.scene.remove(this.muzzleFlashSprite);
    this.muzzleFlashSprite.material.dispose();

    for (const t of this.activeTrails) {
      this.scene.remove(t.line);
      t.line.geometry.dispose();
      t.material.dispose();
    }
    for (const i of this.activeImpacts) {
      this.scene.remove(i.sphere);
      this.scene.remove(i.ring);
      i.sphere.geometry.dispose();
      i.sphereMaterial.dispose();
      i.ring.geometry.dispose();
      i.ringMaterial.dispose();
    }
    for (const b of this.activeBlood) {
      this.scene.remove(b.group);
      for (const s of b.sprites) {
        (s.material as THREE.SpriteMaterial).dispose();
      }
    }
    this.trailPool.clear();
    this.impactPool.clear();
    this.bloodPool.clear();
  }
}
