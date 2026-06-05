import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader';
import type { AssetManifest } from './assetManifest';

// ── Minimal loader interfaces (allows injection of mocks in tests) ──────────

export type { GLTF };

export interface TextureLoaderLike {
  load(
    url: string,
    onLoad?: (texture: THREE.Texture) => void,
    onProgress?: (event: ProgressEvent) => void,
    onError?: (err: unknown) => void,
  ): void;
}

export interface AudioLoaderLike {
  load(
    url: string,
    onLoad?: (buffer: AudioBuffer) => void,
    onProgress?: (event: ProgressEvent) => void,
    onError?: (err: unknown) => void,
  ): void;
}

export interface GLTFLoaderLike {
  load(
    url: string,
    onLoad?: (gltf: GLTF) => void,
    onProgress?: (event: ProgressEvent) => void,
    onError?: (err: unknown) => void,
  ): void;
}

export interface AssetLoaderDeps {
  textureLoader?: TextureLoaderLike;
  audioLoader?: AudioLoaderLike;
  gltfLoader?: GLTFLoaderLike;
  /** Override how a blank fallback texture is created (useful in tests). */
  makeFallbackTexture?: () => THREE.Texture;
  /** Override how a blank fallback scene is created (useful in tests). */
  makeFallbackScene?: () => THREE.Group;
}

// ── AssetLoader ─────────────────────────────────────────────────────────────

export class AssetLoader {
  private textureLoader: TextureLoaderLike;
  private audioLoader: AudioLoaderLike;
  private gltfLoader: GLTFLoaderLike;
  private makeFallbackTexture: () => THREE.Texture;
  private makeFallbackScene: () => THREE.Group;

  constructor(deps?: AssetLoaderDeps) {
    // Real THREE loaders are used by default; tests inject mocks via deps.
    this.textureLoader = deps?.textureLoader ?? new THREE.TextureLoader();
    this.audioLoader = deps?.audioLoader ?? new THREE.AudioLoader();

    if (deps?.gltfLoader) {
      this.gltfLoader = deps.gltfLoader;
    } else {
      // Dynamic import keeps GLTFLoader out of the critical boot path.
      const loader: GLTFLoaderLike = { load: () => {} };
      import('three/examples/jsm/loaders/GLTFLoader').then(({ GLTFLoader }) => {
        const real = new GLTFLoader();
        loader.load = real.load.bind(real);
      });
      this.gltfLoader = loader;
    }

    this.makeFallbackTexture = deps?.makeFallbackTexture ?? (() => new THREE.Texture());
    this.makeFallbackScene = deps?.makeFallbackScene ?? (() => new THREE.Group());
  }

  /**
   * Load a texture. Returns a 1×1 blank texture if the URL fails (404 etc.).
   * If `fallback` URL is provided, that is tried first before the blank default.
   */
  loadTexture(url: string, fallback?: string): Promise<THREE.Texture> {
    return new Promise((resolve) => {
      const tryFallback = (err: unknown) => {
        console.warn(`AssetLoader: texture load failed for "${url}"`, err);
        if (fallback) {
          this.textureLoader.load(
            fallback,
            resolve,
            undefined,
            (err2) => {
              console.warn(`AssetLoader: fallback texture also failed for "${fallback}"`, err2);
              resolve(this.makeFallbackTexture());
            },
          );
        } else {
          resolve(this.makeFallbackTexture());
        }
      };
      this.textureLoader.load(url, resolve, undefined, tryFallback);
    });
  }

  /**
   * Load a GLTF model. Returns `{ scene: emptyGroup }` on failure.
   */
  loadGLTF(url: string): Promise<GLTF> {
    return new Promise((resolve) => {
      this.gltfLoader.load(url, resolve, undefined, (err) => {
        console.warn(`AssetLoader: GLTF load failed for "${url}"`, err);
        resolve({ scene: this.makeFallbackScene(), scenes: [] });
      });
    });
  }

  /**
   * Load an AudioBuffer. Rejects if the URL fails (audio is always intentional).
   */
  loadAudio(url: string): Promise<AudioBuffer> {
    return new Promise((resolve, reject) => {
      this.audioLoader.load(url, resolve, undefined, (err) => {
        console.warn(`AssetLoader: audio load failed for "${url}"`, err);
        reject(err instanceof Error ? err : new Error(String(err)));
      });
    });
  }

  /**
   * Preload all entries in the manifest. Currently a no-op while the manifest
   * is empty; subsequent tasks populate it.
   */
  preloadManifest(manifest: AssetManifest): Promise<void> {
    const textureJobs = manifest.textures.map((t) => this.loadTexture(t.url));
    const weaponJobs = manifest.weapons.map((w) => this.loadGLTF(w.url));
    if (!textureJobs.length && !weaponJobs.length) return Promise.resolve();
    return Promise.all([...textureJobs, ...weaponJobs]).then(() => undefined);
  }
}
