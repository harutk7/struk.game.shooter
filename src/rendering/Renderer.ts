/**
 * WebGL renderer setup and management.
 */

import * as THREE from 'three';
import { GAME_CONFIG } from '../core/GameConfig';

export class Renderer {
  public readonly threeRenderer: THREE.WebGLRenderer;
  public readonly scene: THREE.Scene;
  public readonly camera: THREE.PerspectiveCamera;
  private container: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0xc8d0d8, 0.012);

    this.camera = new THREE.PerspectiveCamera(
      GAME_CONFIG.camera.fov,
      window.innerWidth / window.innerHeight,
      GAME_CONFIG.camera.near,
      GAME_CONFIG.camera.far,
    );
    // Camera must be a child of the scene so we can parent the FPV body
    // (head, arms, weapon rig) directly to it. The camera position/quaternion
    // is still authoritative; being in the scene graph has no visual effect.
    this.scene.add(this.camera);

    this.threeRenderer = new THREE.WebGLRenderer({
      antialias: GAME_CONFIG.rendering.antialias,
    });

    this.threeRenderer.setSize(window.innerWidth, window.innerHeight);
    this.threeRenderer.setPixelRatio(GAME_CONFIG.rendering.pixelRatio);
    this.threeRenderer.shadowMap.enabled = true;
    this.threeRenderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.threeRenderer.outputColorSpace = THREE.SRGBColorSpace;
    this.threeRenderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.threeRenderer.toneMappingExposure = 1.0;

    container.appendChild(this.threeRenderer.domElement);

    window.addEventListener('resize', this.onResize);
  }

  private onResize = (): void => {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.threeRenderer.setSize(window.innerWidth, window.innerHeight);
  };

  render(): void {
    this.threeRenderer.render(this.scene, this.camera);
  }

  get domElement(): HTMLCanvasElement {
    return this.threeRenderer.domElement;
  }

  dispose(): void {
    window.removeEventListener('resize', this.onResize);
    this.threeRenderer.dispose();
    if (this.container.contains(this.threeRenderer.domElement)) {
      this.container.removeChild(this.threeRenderer.domElement);
    }
  }
}
