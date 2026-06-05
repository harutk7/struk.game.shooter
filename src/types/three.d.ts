/* Ambient type declarations for Three.js 0.173 */

declare module 'three/examples/jsm/environments/RoomEnvironment.js' {
  import * as THREE from 'three';
  export class RoomEnvironment extends THREE.Scene {
    constructor();
    dispose(): void;
  }
}

declare module 'three' {
  export class Vector2 {
    constructor(x?: number, y?: number);
    x: number; y: number;
    set(x: number, y: number): this;
  }

  export class BufferAttribute {
    constructor(array: Float32Array | Uint16Array | Uint32Array, itemSize: number);
    count: number;
    itemSize: number;
    array: Float32Array | Uint16Array | Uint32Array;
    getX(i: number): number;
    getY(i: number): number;
    setZ(i: number, v: number): void;
  }

  export class Vector3 {
    constructor(x?: number, y?: number, z?: number);
    x: number; y: number; z: number;
    set(x: number, y: number, z: number): this;
    copy(v: Vector3): this;
    clone(): Vector3;
    add(v: Vector3): this;
    addScalar(s: number): this;
    subVectors(a: Vector3, b: Vector3): this;
    multiplyScalar(s: number): this;
    normalize(): this;
    distanceTo(v: Vector3): number;
    dot(v: Vector3): number;
    applyQuaternion(q: Quaternion): Vector3;
    length(): number;
    setScalar(s: number): this;
  }

  export class Euler {
    constructor(x?: number, y?: number, z?: number, order?: string);
    x: number; y: number; z: number;
    set(x: number, y: number, z: number, order?: string): this;
    setFromQuaternion(q: Quaternion, order?: string): this;
  }

  export class Quaternion {
    constructor(x?: number, y?: number, z?: number, w?: number);
    x: number; y: number; z: number; w: number;
    setFromEuler(e: Euler): this;
  }

  export class Color {
    constructor(color?: number | string | Color);
    r: number; g: number; b: number;
    setHex(hex: number): this;
    getHex(): number;
  }

  export class Box3 {
    constructor(min?: Vector3, max?: Vector3);
    min: Vector3; max: Vector3;
    setFromObject(obj: Object3D): this;
  }

  export class Raycaster {
    constructor(origin?: Vector3, direction?: Vector3, near?: number, far?: number);
    far: number;
    set(origin: Vector3, direction: Vector3): void;
    intersectObjects(objects: Object3D[], recursive?: boolean): Intersection[];
  }

  export interface Intersection {
    point: Vector3;
    distance: number;
    object: Object3D;
    face?: Face3;
  }

  export interface Face3 {
    normal: Vector3;
  }

  export class Object3D {
    position: Vector3;
    rotation: Euler;
    quaternion: Quaternion;
    scale: Vector3;
    visible: boolean;
    parent: Object3D | null;
    name: string;
    userData: Record<string, any>;
    children: Object3D[];
    add(...objects: Object3D[]): this;
    remove(...objects: Object3D[]): this;
    lookAt(x: number | Vector3, y?: number, z?: number): void;
    getWorldDirection(dir: Vector3): Vector3;
    traverse(callback: (object: Object3D) => void): void;
    getObjectByName(name: string): Object3D | undefined;
  }

  export class Camera extends Object3D {
    position: Vector3;
    getWorldDirection(dir: Vector3): Vector3;
  }

  export class PerspectiveCamera extends Camera {
    constructor(fov?: number, aspect?: number, near?: number, far?: number);
    aspect: number;
    updateProjectionMatrix(): void;
  }

  export class Scene extends Object3D {
    fog: Fog | FogExp2 | null;
    environment: Texture | null;
  }

  export class Fog {
    constructor(color: number, near?: number, far?: number);
  }

  export class FogExp2 {
    constructor(color: number, density?: number);
    density: number;
  }

  export class WebGLRenderer {
    domElement: HTMLCanvasElement;
    shadowMap: { enabled: boolean; type: number };
    outputColorSpace: string;
    toneMapping: number;
    toneMappingExposure: number;
    constructor(params?: { antialias?: boolean });
    setSize(w: number, h: number): void;
    setPixelRatio(r: number): void;
    render(scene: Scene, camera: Camera): void;
    dispose(): void;
  }

  export class BufferGeometry {
    attributes: {
      position: BufferAttribute & { count: number; getX(i: number): number; getY(i: number): number; setZ(i: number, v: number): void };
      uv?: BufferAttribute;
      color?: BufferAttribute;
    };
    setAttribute(name: string, attribute: BufferAttribute): this;
    setFromPoints(points: Vector3[]): this;
    computeVertexNormals(): void;
    dispose(): void;
  }

  export class PlaneGeometry extends BufferGeometry {
    constructor(width: number, height: number, segW?: number, segH?: number);
  }
  export class BoxGeometry extends BufferGeometry {
    constructor(w: number, h: number, d: number, segW?: number, segH?: number, segD?: number);
  }
  export class SphereGeometry extends BufferGeometry {
    constructor(radius: number, segW?: number, segH?: number);
  }
  export class CylinderGeometry extends BufferGeometry {
    constructor(topR: number, botR: number, h: number, seg?: number);
  }
  export class DodecahedronGeometry extends BufferGeometry {
    constructor(radius: number, detail?: number);
  }
  export class RingGeometry extends BufferGeometry {
    constructor(innerR: number, outerR: number, seg?: number);
  }
  export class OctahedronGeometry extends BufferGeometry {
    constructor(radius: number, detail?: number);
  }

  export class Material {
    opacity: number;
    transparent: boolean;
    side: number;
    depthWrite: boolean;
    depthTest: boolean;
    fog: boolean;
    dispose(): void;
  }

  export class MeshStandardMaterial extends Material {
    color: Color;
    roughness: number;
    metalness: number;
    emissive: Color;
    emissiveIntensity: number;
    map: Texture | null;
    needsUpdate: boolean;
    normalMap: Texture | null;
    roughnessMap: Texture | null;
    aoMap: Texture | null;
    aoMapIntensity: number;
    envMap: Texture | null;
    vertexColors: boolean;
    constructor(params?: Record<string, any>);
  }

  export class MeshBasicMaterial extends Material {
    color: Color;
    constructor(params?: Record<string, any>);
  }

  export class MeshPhongMaterial extends Material {
    color: Color;
    constructor(params?: Record<string, any>);
  }

  export class LineBasicMaterial extends Material {
    color: Color;
    constructor(params?: Record<string, any>);
  }

  export class ShaderMaterial extends Material {
    uniforms: Record<string, { value: any }>;
    vertexShader: string;
    fragmentShader: string;
    constructor(params?: Record<string, any>);
  }

  export class SpriteMaterial extends Material {
    map: Texture | null;
    color: Color;
    blending: number;
    constructor(params?: Record<string, any>);
  }

  export class Mesh extends Object3D {
    geometry: BufferGeometry;
    material: Material | Material[];
    castShadow: boolean;
    receiveShadow: boolean;
    constructor(geometry?: BufferGeometry, material?: Material | Material[]);
  }

  export class Line extends Object3D {
    geometry: BufferGeometry;
    material: LineBasicMaterial | Material | Material[];
    constructor(geometry?: BufferGeometry, material?: Material);
  }

  export class Sprite extends Object3D {
    material: SpriteMaterial;
    constructor(material?: SpriteMaterial);
  }

  export class Group extends Object3D {}

  export class GridHelper extends Line {
    material: Material;
    constructor(size: number, divisions: number, color1?: number, color2?: number);
  }

  export class AmbientLight extends Object3D {
    constructor(color?: number, intensity?: number);
  }

  export class HemisphereLight extends Object3D {
    constructor(skyColor?: number, groundColor?: number, intensity?: number);
  }

  export class DirectionalLight extends Object3D {
    castShadow: boolean;
    shadow: {
      mapSize: { width: number; height: number };
      camera: { near: number; far: number; left: number; right: number; top: number; bottom: number };
      bias: number;
      normalBias: number;
      radius: number;
    };
    constructor(color?: number, intensity?: number);
  }

  export class PMREMGenerator {
    constructor(renderer: WebGLRenderer);
    compileEquirectangularShader(): void;
    fromEquirectangular(texture: Texture): { texture: Texture };
    fromScene(scene: Scene, sigma?: number, near?: number, far?: number): { texture: Texture };
    dispose(): void;
  }

  export class PointLight extends Object3D {
    castShadow: boolean;
    shadow: { mapSize: { width: number; height: number } };
    visible: boolean;
    constructor(color?: number, intensity?: number, distance?: number);
  }

  export class Texture {
    constructor(image?: HTMLCanvasElement | null);
    wrapS: number;
    wrapT: number;
    repeat: Vector2;
    needsUpdate: boolean;
    magFilter: number;
    minFilter: number;
    dispose(): void;
  }

  export class CanvasTexture extends Texture {
    constructor(canvas: HTMLCanvasElement);
  }

  export class TextureLoader {
    load(
      url: string,
      onLoad?: (texture: Texture) => void,
      onProgress?: (event: ProgressEvent) => void,
      onError?: (err: unknown) => void,
    ): Texture;
  }

  export const MathUtils: {
    degToRad(degrees: number): number;
    radToDeg(radians: number): number;
  };

  export const DoubleSide: number;
  export const BackSide: number;
  export const FrontSide: number;
  export const AdditiveBlending: number;
  export const NormalBlending: number;
  export const PCFSoftShadowMap: number;
  export const SRGBColorSpace: string;
  export const ACESFilmicToneMapping: number;
  export const RepeatWrapping: number;
  export const NearestFilter: number;
  export const LinearFilter: number;
}

declare module 'three/examples/jsm/loaders/RGBELoader.js' {
  import * as THREE from 'three';
  export class RGBELoader {
    load(url: string, onLoad: (texture: THREE.Texture) => void): void;
  }
}
