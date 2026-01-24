import * as THREE from 'three';
import { FPSControls } from '../controls/FPSControls';
import { Crosshair } from '../ui/Crosshair';
import { StartOverlay } from '../ui/StartOverlay';

export class Game {
  private container: HTMLElement;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private isRunning: boolean = false;
  
  private fpsControls: FPSControls;
  
  private crosshair: Crosshair;
  private startOverlay: StartOverlay;

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
    
    this.fpsControls = new FPSControls(this.camera, this.renderer.domElement);
    
    this.crosshair = new Crosshair();
    this.startOverlay = new StartOverlay();
    
    this.init();
  }

  private init(): void {
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    this.camera.position.set(0, 1.7, 5);

    this.scene.background = new THREE.Color(0x87ceeb);

    this.scene.fog = new THREE.Fog(0x87ceeb, 10, 100);

    this.setupLighting();

    this.setupTestEnvironment();

    this.fpsControls.onLock = () => {
      this.startOverlay.hide();
      this.crosshair.show();
      console.log('Controls locked - game active');
    };

    this.fpsControls.onUnlock = () => {
      this.startOverlay.show();
      this.crosshair.hide();
      console.log('Controls unlocked - game paused');
    };

    this.startOverlay.show();
    this.crosshair.hide();

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

    const boxGeometry = new THREE.BoxGeometry(2, 2, 2);
    const boxMaterial = new THREE.MeshStandardMaterial({ color: 0x808080 });

    const positions = [
      { x: -5, z: -5 },
      { x: 5, z: -5 },
      { x: 0, z: -10 },
      { x: -8, z: -15 },
      { x: 8, z: -15 },
    ];

    positions.forEach((pos) => {
      const box = new THREE.Mesh(boxGeometry, boxMaterial);
      box.position.set(pos.x, 1, pos.z);
      box.castShadow = true;
      box.receiveShadow = true;
      this.scene.add(box);
    });

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
    console.log('Game started! Click to play.');
  }

  private animate(): void {
    if (!this.isRunning) return;
    
    requestAnimationFrame(this.animate.bind(this));
    
    this.update();
    
    this.renderer.render(this.scene, this.camera);
  }

  private update(): void {
  }

  public getScene(): THREE.Scene {
    return this.scene;
  }

  public getCamera(): THREE.PerspectiveCamera {
    return this.camera;
  }

  public getControls(): FPSControls {
    return this.fpsControls;
  }
}
