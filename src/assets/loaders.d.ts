// Augments the ambient 'three' module declaration (src/types/three.d.ts) with
// loader classes that are in the package but not in the hand-rolled stubs.

declare module 'three' {
  export class TextureLoader {
    load(
      url: string,
      onLoad?: (texture: Texture) => void,
      onProgress?: (event: ProgressEvent) => void,
      onError?: (err: unknown) => void,
    ): Texture;
  }

  export class AudioLoader {
    load(
      url: string,
      onLoad?: (buffer: AudioBuffer) => void,
      onProgress?: (event: ProgressEvent) => void,
      onError?: (err: unknown) => void,
    ): void;
  }
}

declare module 'three/examples/jsm/loaders/GLTFLoader' {
  import { Group } from 'three';

  export interface GLTF {
    scene: Group;
    scenes: Group[];
  }

  export class GLTFLoader {
    load(
      url: string,
      onLoad?: (gltf: GLTF) => void,
      onProgress?: (event: ProgressEvent) => void,
      onError?: (err: unknown) => void,
    ): void;
  }
}
