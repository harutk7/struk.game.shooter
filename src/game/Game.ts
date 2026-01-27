import * as THREE from 'three';
import { FPSControls } from '../controls/FPSControls';
import { InputManager } from '../controls/InputManager';
import { Player } from '../player/Player';
import { Crosshair } from '../ui/Crosshair';
import { StartOverlay } from '../ui/StartOverlay';
import { GameClock } from '../utils/GameClock';
import { Weapon } from '../weapons/Weapon';
import { HUD } from '../ui/HUD';
import { EnemyManager } from '../enemies/EnemyManager';
import { World } from '../world/World';
import { Skybox } from '../world/Skybox';
import { DeviceDetection } from '../utils/DeviceDetection';

export class Game {
  private container: HTMLElement;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private isRunning: boolean = false;
  
  private fpsControls: FPSControls;
  private inputManager: InputManager;
  private player: Player;
  private clock: GameClock;
  
  private crosshair: Crosshair;
  private startOverlay: StartOverlay;
  private weapon: Weapon;
  private hud: HUD;
  private enemyManager: EnemyManager;
  private score: number = 0;
  private world: World;
  private skybox: Skybox;

  constructor(container: HTMLElement) {
    this.container = container;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    
    this.clock = new GameClock();
    this.fpsControls = new FPSControls(this.camera, this.renderer.domElement);
    this.inputManager = new InputManager();
    this.player = new Player(this.camera, this.fpsControls, this.inputManager);
    this.weapon = new Weapon(this.camera, this.scene, 'PISTOL');
    this.hud = new HUD();
    this.enemyManager = new EnemyManager(this.scene);
    
    this.crosshair = new Crosshair();
    this.startOverlay = new StartOverlay();
    
    this.player.setWeapon(this.weapon);
    
    this.enemyManager.onEnemyKilled = (points) => {
      this.score += points;
      this.hud.updateScore(this.score);
      console.log(`Enemy killed! +${points} points. Total: ${this.score}`);
    };

    this.enemyManager.onPlayerDamaged = (damage) => {
      this.player.takeDamage(damage);
      this.hud.updateHealth(this.player.getHealth(), this.player.getMaxHealth());
      this.flashDamage();
    };

    this.enemyManager.onWaveComplete = (waveNumber) => {
      console.log(`Wave ${waveNumber} complete!`);
    };
    
    this.weapon.onAmmoChange = (current, reserve) => {
      this.hud.updateAmmo(current, reserve);
    };

    this.weapon.onReloadStart = () => {
      this.hud.showReloading(true);
    };

    this.weapon.onReloadEnd = () => {
      this.hud.showReloading(false);
    };

    this.weapon.onFire = (hitResult) => {
      if (hitResult.hit && hitResult.object) {
        const killed = this.enemyManager.handleHit(hitResult.object, this.weapon.getDamage());
        if (killed) {
          console.log('Enemy killed!');
        }
      }
    };
    
    this.world = new World(this.scene, {
      width: 50,
      depth: 50,
      wallHeight: 5,
    });
    this.skybox = new Skybox(this.scene);
    
    this.init();
  }

  private init(): void {
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    this.scene.fog = new THREE.Fog(0x87ceeb, 10, 100);

    const isMobile = DeviceDetection.isTouchDevice();

    if (isMobile) {
      const mobileControls = this.fpsControls.getMobileControls();
      if (mobileControls) {
        this.inputManager.setMobileControls(mobileControls);
      }
    }

    this.setupLighting();

    this.startOverlay.setOnClick(() => {
      this.fpsControls.lock();
    });

    this.fpsControls.onLock = () => {
      this.startOverlay.hide();
      this.crosshair.show();
      this.hud.show();
      this.clock.start();
      
      if (isMobile) {
        const mobileControls = this.fpsControls.getMobileControls();
        if (mobileControls) mobileControls.enable();
      }
      
      console.log('Game active');
    };

    this.fpsControls.onUnlock = () => {
      this.startOverlay.show();
      this.crosshair.hide();
      this.hud.hide();
      this.clock.stop();
      
      if (isMobile) {
        const mobileControls = this.fpsControls.getMobileControls();
        if (mobileControls) mobileControls.disable();
      }
      
      console.log('Game paused');
    };

    this.startOverlay.show();
    this.crosshair.hide();
    this.hud.hide();
    
    this.hud.updateHealth(100, 100);
    this.hud.updateAmmo(this.weapon.getCurrentAmmo(), this.weapon.getReserveAmmo());

    window.addEventListener('resize', this.onWindowResize.bind(this));
  }

  private setupLighting(): void {
    const ambientLight = new THREE.AmbientLight(0x6688cc, 0.4);
    this.scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x444444, 0.5);
    hemiLight.position.set(0, 50, 0);
    this.scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xffffcc, 1.2);
    sunLight.position.set(30, 50, 30);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 4096;
    sunLight.shadow.mapSize.height = 4096;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 150;
    sunLight.shadow.camera.left = -50;
    sunLight.shadow.camera.right = 50;
    sunLight.shadow.camera.top = 50;
    sunLight.shadow.camera.bottom = -50;
    sunLight.shadow.bias = -0.0001;
    this.scene.add(sunLight);

    const fillLight = new THREE.DirectionalLight(0x8888ff, 0.3);
    fillLight.position.set(-20, 30, -20);
    this.scene.add(fillLight);
  }

  private onWindowResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  public start(): void {
    this.isRunning = true;
    this.animate();
    console.log('Game initialized! Click to play.');
  }

  private animate(): void {
    if (!this.isRunning) return;
    
    requestAnimationFrame(this.animate.bind(this));
    
    const deltaTime = this.clock.update();
    
    this.update(deltaTime);
    
    this.renderer.render(this.scene, this.camera);
  }

  private update(deltaTime: number): void {
    this.player.update(deltaTime);
    
    const playerPos = this.player.getPosition();
    this.world.clampToArena(playerPos);
    
    this.enemyManager.update(deltaTime, this.player.getPosition());
  }

  private flashDamage(): void {
    const overlay = document.createElement('div');
    Object.assign(overlay.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      backgroundColor: 'rgba(255, 0, 0, 0.3)',
      pointerEvents: 'none',
      zIndex: '999',
    });
    document.body.appendChild(overlay);
    
    setTimeout(() => {
      document.body.removeChild(overlay);
    }, 100);
  }

  public getScene(): THREE.Scene {
    return this.scene;
  }

  public getCamera(): THREE.PerspectiveCamera {
    return this.camera;
  }

  public getPlayer(): Player {
    return this.player;
  }
}
