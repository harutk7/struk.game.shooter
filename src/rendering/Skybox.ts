/**
 * Gradient skybox using a custom shader.
 */

import * as THREE from 'three';

export class Skybox {
  private scene: THREE.Scene;
  private mesh: THREE.Mesh;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.mesh = this.createSky();
    this.scene.add(this.mesh);
  }

  private createSky(): THREE.Mesh {
    const geometry = new THREE.SphereGeometry(500, 32, 32);

    const material = new THREE.ShaderMaterial({
      uniforms: {
        topColor: { value: new THREE.Color(0x0077ff) },
        bottomColor: { value: new THREE.Color(0xffffff) },
        offset: { value: 33 },
        exponent: { value: 0.6 },
      },
      vertexShader: /* glsl */ `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
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
      depthWrite: false,
    });

    return new THREE.Mesh(geometry, material);
  }

  setColors(topColor: number, bottomColor: number): void {
    const mat = this.mesh.material as THREE.ShaderMaterial;
    mat.uniforms.topColor.value.setHex(topColor);
    mat.uniforms.bottomColor.value.setHex(bottomColor);
  }

  dispose(): void {
    this.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}
