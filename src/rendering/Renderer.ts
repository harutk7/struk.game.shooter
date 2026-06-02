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
    this.scene.fog = new THREE.Fog(
      GAME_CONFIG.rendering.fogColor,
      GAME_CONFIG.rendering.fogNear,
      GAME_CONFIG.rendering.fogFar,
    );

    this.camera = new THREE.PerspectiveCamera(
      GAME_CONFIG.camera.fov,
      window.innerWidth / window.innerHeight,
      GAME_CONFIG.camera.near,
      GAME_CONFIG.camera.far,
    );

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
