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
    
    this.init();
  }

  private init(): void {
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    this.scene.background = new THREE.Color(0x87ceeb);
    this.scene.fog = new THREE.Fog(0x87ceeb, 10, 100);

    this.setupLighting();

    this.setupTestEnvironment();

    this.startOverlay.setOnClick(() => {
      this.fpsControls.lock();
    });

    this.fpsControls.onLock = () => {
      this.startOverlay.hide();
      this.crosshair.show();
      this.hud.show();
      this.clock.start();
      console.log('Game active');
    };

    this.fpsControls.onUnlock = () => {
      this.startOverlay.show();
      this.crosshair.hide();
      this.hud.hide();
      this.clock.stop();
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
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    this.scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x444444, 0.6);
    hemiLight.position.set(0, 50, 0);
    this.scene.add(hemiLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(20, 40, 20);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 100;
    directionalLight.shadow.camera.left = -30;
    directionalLight.shadow.camera.right = 30;
    directionalLight.shadow.camera.top = 30;
    directionalLight.shadow.camera.bottom = -30;
    this.scene.add(directionalLight);
  }

  private setupTestEnvironment(): void {
    const floorGeometry = new THREE.PlaneGeometry(50, 50);
    const floorMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x3a7d3a,
      roughness: 0.8,
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    const gridHelper = new THREE.GridHelper(50, 50, 0x000000, 0x000000);
    gridHelper.position.y = 0.01;
    gridHelper.material.opacity = 0.2;
    gridHelper.material.transparent = true;
    this.scene.add(gridHelper);

    const boxGeometry = new THREE.BoxGeometry(2, 2, 2);
    const boxMaterial = new THREE.MeshStandardMaterial({ color: 0x808080 });

    const positions = [
      { x: -5, z: -5 },
      { x: 5, z: -5 },
      { x: 0, z: -10 },
      { x: -8, z: -15 },
      { x: 8, z: -15 },
      { x: -3, z: -20 },
      { x: 3, z: -20 },
    ];

    positions.forEach((pos) => {
      const box = new THREE.Mesh(boxGeometry, boxMaterial);
      box.position.set(pos.x, 1, pos.z);
      box.castShadow = true;
      box.receiveShadow = true;
      this.scene.add(box);
    });

    const tallBoxGeometry = new THREE.BoxGeometry(2, 4, 2);
    const tallBox1 = new THREE.Mesh(tallBoxGeometry, boxMaterial);
    tallBox1.position.set(-10, 2, -10);
    tallBox1.castShadow = true;
    this.scene.add(tallBox1);

    const tallBox2 = new THREE.Mesh(tallBoxGeometry, boxMaterial);
    tallBox2.position.set(10, 2, -10);
    tallBox2.castShadow = true;
    this.scene.add(tallBox2);

    const pillarGeometry = new THREE.CylinderGeometry(0.5, 0.5, 5, 16);
    const pillarMaterial = new THREE.MeshStandardMaterial({ color: 0xb0b0b0 });
    const pillar = new THREE.Mesh(pillarGeometry, pillarMaterial);
    pillar.position.set(3, 2.5, -8);
    pillar.castShadow = true;
    pillar.receiveShadow = true;
    this.scene.add(pillar);
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
