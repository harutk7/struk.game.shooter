/**
 * Weapon renderer — muzzle flash, bullet trails, impact effects.
 * Uses object pooling for all transient effects.
 */

import * as THREE from 'three';
import { ObjectPool } from './ObjectPool';

/**
 * Per-weapon muzzle-flash look. `core`/`mid`/`edge` are CSS rgba stops for the
 * procedural radial-gradient texture (white-hot center → colored edge →
 * transparent). `light` is the point-light tint, `intensity` its peak power,
 * and `size` the world-space radius of the billboard at full bloom.
 */
interface FlashProfile {
  core: string;
  mid: string;
  edge: string;
  light: number;
  intensity: number;
  size: number;
}

/**
 * Flash profiles keyed by weapon. Real game weapons are PISTOL/RIFLE/SHOTGUN/
 * SNIPER (lower-cased here); the ak/mp5/m4 aliases keep the renderer usable with
 * the common real-world weapon names too.
 *   - pistol : cooler blue-white
 *   - ak/rifle: orange-yellow
 *   - mp5/m4/shotgun/sniper: yellow-white
 */
const FLASH_PROFILES: Record<string, FlashProfile> = {
  pistol: { core: 'rgba(240,248,255,1)', mid: 'rgba(160,200,255,0.85)', edge: 'rgba(80,140,255,0.25)', light: 0xcfe0ff, intensity: 4, size: 0.32 },
  ak: { core: 'rgba(255,250,210,1)', mid: 'rgba(255,175,40,0.9)', edge: 'rgba(255,80,0,0.3)', light: 0xffa022, intensity: 6, size: 0.5 },
  rifle: { core: 'rgba(255,250,210,1)', mid: 'rgba(255,175,40,0.9)', edge: 'rgba(255,80,0,0.3)', light: 0xffa022, intensity: 6, size: 0.5 },
  mp5: { core: 'rgba(255,255,235,1)', mid: 'rgba(255,225,120,0.9)', edge: 'rgba(255,150,20,0.3)', light: 0xffdd88, intensity: 5, size: 0.42 },
  m4: { core: 'rgba(255,255,235,1)', mid: 'rgba(255,225,120,0.9)', edge: 'rgba(255,150,20,0.3)', light: 0xffdd88, intensity: 5, size: 0.42 },
  shotgun: { core: 'rgba(255,255,235,1)', mid: 'rgba(255,225,120,0.9)', edge: 'rgba(255,150,20,0.3)', light: 0xffdd88, intensity: 7, size: 0.6 },
  sniper: { core: 'rgba(255,255,235,1)', mid: 'rgba(255,225,120,0.9)', edge: 'rgba(255,150,20,0.3)', light: 0xffdd88, intensity: 6, size: 0.55 },
  default: { core: 'rgba(255,255,230,1)', mid: 'rgba(255,210,90,0.9)', edge: 'rgba(255,140,20,0.3)', light: 0xffaa00, intensity: 5, size: 0.45 },
};

/** Parse a CSS `rgba(r,g,b,a)` / `rgb(r,g,b)` string into [r,g,b,a(0..1)]. */
function parseRgba(s: string): [number, number, number, number] {
  const m = s.match(/rgba?\(([^)]+)\)/);
  if (!m) return [255, 255, 255, 1];
  const parts = m[1].split(',').map((p) => parseFloat(p.trim()));
  return [parts[0] ?? 255, parts[1] ?? 255, parts[2] ?? 255, parts[3] ?? 1];
}

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

/**
 * A flying brass shell casing. The mesh is a tiny brass cylinder; `velocity`
 * (world-space, m/s) is integrated under gravity + drag each frame and `angular`
 * (rad/s per axis) gives it a tumble. `createdAt` (performance.now ms) drives the
 * lifetime so the shell is recycled to the pool ~1.5s after ejection.
 */
interface ShellData {
  mesh: THREE.Mesh;
  velocity: { x: number; y: number; z: number };
  angular: { x: number; y: number; z: number };
  createdAt: number;
}

export class WeaponRenderer {
  private scene: THREE.Scene;
  private camera: THREE.Camera;

  // Muzzle flash: a billboarded textured plane (additive) + a pulsing point light.
  private muzzleFlash: THREE.PointLight;
  private muzzleFlashMesh: THREE.Mesh;
  private muzzleFlashMaterial: THREE.MeshBasicMaterial;
  private flashTextures = new Map<string, THREE.Texture>();

  // Animation state, driven by tick() rather than setTimeout so it fades smoothly.
  private flashStart = 0;
  private flashActive = false;
  private flashBaseSize = 0.45;
  private flashPeakIntensity = 5;
  private static readonly FLASH_MESH_MS = 80;
  private static readonly FLASH_LIGHT_MS = 50;

  /** Camera-parented viewmodel group. All materials have fog:false. */
  public readonly weaponGroup: THREE.Group;

  private trailPool: ObjectPool<TrailData>;
  private impactPool: ObjectPool<ImpactData>;
  private bloodPool: ObjectPool<BloodData>;
  private shellPool: ObjectPool<ShellData>;

  private activeTrails: TrailData[] = [];
  private activeImpacts: ImpactData[] = [];
  private activeBlood: BloodData[] = [];
  private activeShells: ShellData[] = [];

  // Cached for the blood animation delta-time
  private lastTickDt = 0;
  private _lastTickTime: number | null = null;
  // Independent delta-time clock for shell physics.
  private _lastShellTime: number | null = null;

  // Shell-ejection physics tuning.
  private static readonly SHELL_GRAVITY = 9.81; // m/s^2
  private static readonly SHELL_DRAG = 0.1; // fractional velocity bleed per second
  private static readonly SHELL_BOUNCE_DAMPEN = 0.4; // y-velocity kept after a bounce
  private static readonly SHELL_LIFETIME_MS = 1500; // removed ~1.5s after ejection

  /**
   * Optional hook fired when a shell hits the floor and bounces. T15 (audio)
   * wires a brief brass "ping" here; left null until then.
   */
  onShellBounce: (() => void) | null = null;

  constructor(scene: THREE.Scene, camera: THREE.Camera) {
    this.scene = scene;
    this.camera = camera;

    // Weapon viewmodel — attached to camera, materials opt out of scene fog
    this.weaponGroup = this.createWeaponGroup();
    this.camera.add(this.weaponGroup);

    // Muzzle flash light — tint/intensity are set per shot in triggerMuzzleFlash.
    this.muzzleFlash = new THREE.PointLight(0xffaa00, 0, 10);
    this.muzzleFlash.visible = false;
    this.scene.add(this.muzzleFlash);

    // Muzzle flash billboard — a small textured plane with a procedurally
    // generated radial-gradient texture, additively blended so it brightens
    // whatever is behind it. The map is swapped per weapon on each shot.
    this.muzzleFlashMaterial = new THREE.MeshBasicMaterial({
      map: this.getFlashTexture('default'),
      color: 0xffffff,
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.muzzleFlashMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.muzzleFlashMaterial);
    this.muzzleFlashMesh.visible = false;
    // Exclude from weapon raycasts.
    (this.muzzleFlashMesh as any).raycast = () => {};
    this.scene.add(this.muzzleFlashMesh);

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

    // Shell-casing pool — 20 brass shells reused across the match.
    this.shellPool = new ObjectPool<ShellData>(
      () => this.createShellData(),
      (s) => this.resetShell(s),
      20,
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

  /** Resolve a weapon-type string to a known flash-profile key. */
  private resolveFlashKey(weaponType?: string): string {
    if (!weaponType) return 'default';
    const key = weaponType.toLowerCase();
    return key in FLASH_PROFILES ? key : 'default';
  }

  /** Lazily build + cache the radial-gradient texture for a flash profile. */
  private getFlashTexture(key: string): THREE.Texture {
    const cached = this.flashTextures.get(key);
    if (cached) return cached;
    const tex = this.createFlashTexture(FLASH_PROFILES[key] ?? FLASH_PROFILES.default);
    this.flashTextures.set(key, tex);
    return tex;
  }

  /**
   * Build the radial-gradient flash texture: white-hot center → colored mid →
   * colored edge → transparent. Uses a canvas when the DOM is available
   * (the real game), and a procedurally-filled DataTexture otherwise (tests /
   * headless), so the texture is always genuinely procedural with no assets.
   */
  private createFlashTexture(profile: FlashProfile): THREE.Texture {
    const size = 64;
    if (typeof document !== 'undefined') {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
        g.addColorStop(0, profile.core);
        g.addColorStop(0.25, profile.mid);
        g.addColorStop(0.6, profile.edge);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, size, size);
        return new THREE.CanvasTexture(canvas);
      }
    }
    return this.createDataFlashTexture(profile, size);
  }

  /** DOM-less radial-gradient: interpolate the gradient stops per pixel. */
  private createDataFlashTexture(profile: FlashProfile, size: number): THREE.Texture {
    const stops: Array<{ t: number; c: [number, number, number, number] }> = [
      { t: 0.0, c: parseRgba(profile.core) },
      { t: 0.25, c: parseRgba(profile.mid) },
      { t: 0.6, c: parseRgba(profile.edge) },
      { t: 1.0, c: [0, 0, 0, 0] },
    ];
    const data = new Uint8Array(size * size * 4);
    const c = (size - 1) / 2;
    const maxR = size / 2;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = x - c;
        const dy = y - c;
        let r = Math.sqrt(dx * dx + dy * dy) / maxR;
        if (r > 1) r = 1;
        let a = stops[0];
        let b = stops[stops.length - 1];
        for (let i = 0; i < stops.length - 1; i++) {
          if (r >= stops[i].t && r <= stops[i + 1].t) {
            a = stops[i];
            b = stops[i + 1];
            break;
          }
        }
        const span = b.t - a.t || 1;
        const f = (r - a.t) / span;
        const idx = (y * size + x) * 4;
        data[idx] = Math.round(a.c[0] + (b.c[0] - a.c[0]) * f);
        data[idx + 1] = Math.round(a.c[1] + (b.c[1] - a.c[1]) * f);
        data[idx + 2] = Math.round(a.c[2] + (b.c[2] - a.c[2]) * f);
        data[idx + 3] = Math.round((a.c[3] + (b.c[3] - a.c[3]) * f) * 255);
      }
    }
    const tex = new THREE.DataTexture(data, size, size);
    tex.needsUpdate = true;
    return tex;
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

  /** Create one pooled brass shell casing (a tiny metallic cylinder). */
  private createShellData(): ShellData {
    // ~1cm tall, ~1cm diameter cylinder.
    const geo = new THREE.CylinderGeometry(0.005, 0.005, 0.012, 8);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xb87333,
      metalness: 0.9,
      roughness: 0.4,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.visible = false;
    mesh.castShadow = true;
    // Shells must never block weapon raycasts.
    (mesh as any).raycast = () => {};
    this.scene.add(mesh);
    return {
      mesh,
      velocity: { x: 0, y: 0, z: 0 },
      angular: { x: 0, y: 0, z: 0 },
      createdAt: 0,
    };
  }

  private resetShell(s: ShellData): void {
    s.mesh.visible = false;
    s.velocity.x = 0;
    s.velocity.y = 0;
    s.velocity.z = 0;
    s.angular.x = 0;
    s.angular.y = 0;
    s.angular.z = 0;
  }

  /**
   * Eject a brass shell from the weapon's ejection port. `weaponPosition` and
   * `weaponRotation` describe the weapon in world space; the port offset and the
   * initial velocity (rightward + upward + backward) are expressed in weapon-local
   * space and rotated into the world by `weaponRotation`. The shell then arcs
   * under gravity, tumbles, and bounces once on the floor (see tickShells).
   */
  ejectShell(weaponPosition: THREE.Vector3, weaponRotation: THREE.Quaternion): void {
    const s = this.shellPool.acquire();

    // Ejection port: right side, just below the sightline, slightly forward.
    const port = new THREE.Vector3(0.18, -0.04, -0.12)
      .applyQuaternion(weaponRotation)
      .add(weaponPosition);
    s.mesh.position.copy(port);

    // Initial velocity in weapon-local space, then rotated to world.
    const localVel = new THREE.Vector3(
      2.2 + (Math.random() - 0.5) * 1.0, // rightward
      1.8 + (Math.random() - 0.5) * 0.8, // upward
      1.2 + (Math.random() - 0.5) * 0.8, // backward (+z = behind the camera)
    ).applyQuaternion(weaponRotation);
    s.velocity.x = localVel.x;
    s.velocity.y = localVel.y;
    s.velocity.z = localVel.z;

    // Tumble: random spin on every axis.
    s.angular.x = (Math.random() - 0.5) * 30;
    s.angular.y = (Math.random() - 0.5) * 30;
    s.angular.z = (Math.random() - 0.5) * 30;

    s.mesh.rotation.set(Math.random() * 6.28, Math.random() * 6.28, Math.random() * 6.28);
    s.mesh.visible = true;
    s.createdAt = performance.now();
    this.activeShells.push(s);
  }

  /** Integrate shell physics: gravity, drag, floor bounce, tumble, recycle. */
  private tickShells(now: number): void {
    if (this.activeShells.length === 0) {
      this._lastShellTime = now;
      return;
    }
    const dt = Math.min((now - (this._lastShellTime ?? now)) / 1000, 0.05);
    this._lastShellTime = now;

    const drag = 1 - WeaponRenderer.SHELL_DRAG * dt;
    for (let i = this.activeShells.length - 1; i >= 0; i--) {
      const s = this.activeShells[i];
      if (now - s.createdAt >= WeaponRenderer.SHELL_LIFETIME_MS) {
        this.activeShells.splice(i, 1);
        this.shellPool.release(s);
        continue;
      }

      // Gravity + slight air drag.
      s.velocity.y -= WeaponRenderer.SHELL_GRAVITY * dt;
      s.velocity.x *= drag;
      s.velocity.y *= drag;
      s.velocity.z *= drag;

      // Integrate position.
      s.mesh.position.x += s.velocity.x * dt;
      s.mesh.position.y += s.velocity.y * dt;
      s.mesh.position.z += s.velocity.z * dt;

      // Floor collision: bounce once (flip + dampen y, add ground friction).
      if (s.mesh.position.y <= 0 && s.velocity.y < 0) {
        s.velocity.y = -s.velocity.y * WeaponRenderer.SHELL_BOUNCE_DAMPEN;
        s.velocity.x *= 0.6;
        s.velocity.z *= 0.6;
        if (this.onShellBounce) this.onShellBounce();
      }

      // Tumble.
      s.mesh.rotation.x += s.angular.x * dt;
      s.mesh.rotation.y += s.angular.y * dt;
      s.mesh.rotation.z += s.angular.z * dt;
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

  /**
   * Trigger an animated muzzle flash for the given weapon. The billboard scales
   * up then fades over ~80ms while the point light pulses bright for ~50ms,
   * lighting nearby geometry. Color varies per weapon (see FLASH_PROFILES).
   */
  triggerMuzzleFlash(weaponType?: string): void {
    const key = this.resolveFlashKey(weaponType);
    const profile = FLASH_PROFILES[key];

    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    const pos = this.camera.position.clone().add(dir.multiplyScalar(0.5));
    pos.y -= 0.1;

    // Billboard mesh: face the camera, start at ~0 scale.
    this.muzzleFlashMaterial.map = this.getFlashTexture(key);
    this.muzzleFlashMaterial.needsUpdate = true;
    this.muzzleFlashMaterial.opacity = 1;
    this.muzzleFlashMesh.position.copy(pos);
    this.muzzleFlashMesh.quaternion.copy(this.camera.quaternion);
    this.muzzleFlashMesh.scale.set(0.0001, 0.0001, 1);
    this.muzzleFlashMesh.visible = true;

    // Point light pulse.
    this.muzzleFlash.position.copy(pos);
    this.muzzleFlash.color.setHex(profile.light);
    this.muzzleFlash.intensity = profile.intensity;
    this.muzzleFlash.visible = true;

    this.flashBaseSize = profile.size;
    this.flashPeakIntensity = profile.intensity;
    this.flashStart = performance.now();
    this.flashActive = true;
  }

  /** Back-compat alias; prefer triggerMuzzleFlash(weaponType). */
  showMuzzleFlash(weaponType?: string): void {
    this.triggerMuzzleFlash(weaponType);
  }

  /** Advance the muzzle-flash bloom + light pulse. Called from tick(). */
  private tickMuzzleFlash(now: number): void {
    if (!this.flashActive) return;
    const age = now - this.flashStart;
    const meshDur = WeaponRenderer.FLASH_MESH_MS;
    const lightDur = WeaponRenderer.FLASH_LIGHT_MS;

    // Mesh: scale 0 → 1.2 → 0 (peak ~35% through) with brightness fade.
    if (age < meshDur) {
      const p = age / meshDur;
      const peak = 0.35;
      const s = p < peak ? p / peak : 1 - (p - peak) / (1 - peak);
      const scale = this.flashBaseSize * 1.2 * Math.max(0.0001, s);
      this.muzzleFlashMesh.scale.set(scale, scale, 1);
      this.muzzleFlashMesh.quaternion.copy(this.camera.quaternion); // keep billboarded
      this.muzzleFlashMaterial.opacity = 1 - p;
    } else {
      this.muzzleFlashMesh.visible = false;
    }

    // Light: pulse bright, then fall to zero.
    if (age < lightDur) {
      this.muzzleFlash.intensity = this.flashPeakIntensity * (1 - age / lightDur);
    } else {
      this.muzzleFlash.intensity = 0;
      this.muzzleFlash.visible = false;
    }

    if (age >= meshDur && age >= lightDur) {
      this.flashActive = false;
    }
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
    // Muzzle flash bloom + light pulse
    this.tickMuzzleFlash(now);

    // Brass shells: gravity, bounce, tumble
    this.tickShells(now);

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
    this.scene.remove(this.muzzleFlashMesh);
    this.muzzleFlashMesh.geometry.dispose();
    this.muzzleFlashMaterial.dispose();
    for (const tex of this.flashTextures.values()) tex.dispose();
    this.flashTextures.clear();

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
    for (const s of this.activeShells) {
      this.scene.remove(s.mesh);
      s.mesh.geometry.dispose();
      (s.mesh.material as THREE.Material).dispose();
    }
    this.activeShells = [];

    this.trailPool.clear();
    this.impactPool.clear();
    this.bloodPool.clear();
    this.shellPool.clear();
  }
}
