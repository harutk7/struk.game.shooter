import * as THREE from 'three';

export class Skybox {
  private scene: THREE.Scene;
  private sky: THREE.Mesh;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.sky = this.createGradientSky();
    this.scene.add(this.sky);
  }

  private createGradientSky(): THREE.Mesh {
    const geometry = new THREE.SphereGeometry(500, 32, 32);
    
    const material = new THREE.ShaderMaterial({
      uniforms: {
        topColor: { value: new THREE.Color(0x0077ff) },
        bottomColor: { value: new THREE.Color(0xffffff) },
        offset: { value: 33 },
        exponent: { value: 0.6 },
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        uniform float offset;
        uniform float exponent;
        varying vec3 vWorldPosition;
        void main() {
          float h = normalize(vWorldPosition + offset).y;
          gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
        }
      `,
      side: THREE.BackSide,
    });

    return new THREE.Mesh(geometry, material);
  }

  public setColors(topColor: number, bottomColor: number): void {
    const material = this.sky.material as THREE.ShaderMaterial;
    material.uniforms.topColor.value.setHex(topColor);
    material.uniforms.bottomColor.value.setHex(bottomColor);
  }

  public dispose(): void {
    this.scene.remove(this.sky);
    this.sky.geometry.dispose();
    (this.sky.material as THREE.Material).dispose();
  }
}
