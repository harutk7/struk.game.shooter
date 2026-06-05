/**
 * Time-of-day skybox — late-afternoon 3-stop gradient with a faint sun disc.
 * The gradient blends warm orange at the horizon through mid-sky warm blue to
 * deep blue at the zenith, matching the DirectionalLight sun position.
 */

import * as THREE from 'three';
import { GAME_CONFIG } from '../core/GameConfig';

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

    // Normalise sun world-position to a direction vector for the disc shader
    const [sx, sy, sz] = GAME_CONFIG.lighting.sun.position;
    const sunDir = new THREE.Vector3(sx, sy, sz).normalize();

    const material = new THREE.ShaderMaterial({
      uniforms: {
        zenithColor:  { value: new THREE.Color(0x0b1e4f) },  // deep blue at top
        midColor:     { value: new THREE.Color(0x2a5280) },  // warm blue mid-sky
        horizonColor: { value: new THREE.Color(0xff7030) },  // warm orange horizon
        sunDirection: { value: sunDir },
        sunSize:      { value: 0.006 },                      // angular radius (cos threshold)
        sunHaloSize:  { value: 0.06 },                       // soft glow radius
      },
      vertexShader: /* glsl */ `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPos.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 zenithColor;
        uniform vec3 midColor;
        uniform vec3 horizonColor;
        uniform vec3 sunDirection;
        uniform float sunSize;
        uniform float sunHaloSize;
        varying vec3 vWorldPosition;

        void main() {
          vec3 dir = normalize(vWorldPosition);
          float h = dir.y; // -1 below horizon, 0 at horizon, +1 at zenith

          // 3-stop gradient: horizon → mid → zenith
          // Below horizon: blend to a slightly darker horizon colour
          float tLow  = smoothstep(-0.05, 0.15, h);   // horizon → mid
          float tHigh = smoothstep(0.10, 0.70, h);     // mid → zenith
          vec3 sky = mix(horizonColor, midColor,   tLow);
          sky       = mix(sky,         zenithColor, tHigh);

          // Sun disc + soft halo
          float cosAngle = dot(dir, sunDirection);
          float disc  = smoothstep(1.0 - sunSize,     1.0,            cosAngle);
          float halo  = smoothstep(1.0 - sunHaloSize, 1.0 - sunSize,  cosAngle) * 0.35;
          vec3 sunColor = vec3(1.0, 0.93, 0.75);
          sky = mix(sky, sunColor, clamp(disc + halo, 0.0, 1.0));

          gl_FragColor = vec4(sky, 1.0);
        }
      `,
      side: THREE.BackSide,
      depthWrite: false,
    });

    return new THREE.Mesh(geometry, material);
  }

  /** Update the two-stop colours (kept for API compatibility). */
  setColors(_topColor: number, _bottomColor: number): void {
    // no-op: colours are now fixed to the time-of-day scheme
  }

  dispose(): void {
    this.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}
