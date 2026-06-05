/**
 * Skybox v2 — 3-stop gradient (zenith/mid/horizon), procedural sun disc,
 * faint FBM cloud band, all inside a large BoxGeometry with BackSide material.
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
    const geometry = new THREE.BoxGeometry(1000, 1000, 1000);

    const [sx, sy, sz] = GAME_CONFIG.lighting.sun.position;
    const sunPos = new THREE.Vector3(sx, sy, sz).normalize();

    const material = new THREE.ShaderMaterial({
      uniforms: {
        zenithColor:  { value: new THREE.Color(0x0b1e4f) },  // deep blue at top
        midColor:     { value: new THREE.Color(0xe87840) },  // warm orange mid-sky
        horizonColor: { value: new THREE.Color(0xf0e8d0) },  // pale yellow-white horizon
        uSunPosition: { value: sunPos },
        sunSize:      { value: 0.006 },
        sunHaloSize:  { value: 0.07 },
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
        uniform vec3 uSunPosition;
        uniform float sunSize;
        uniform float sunHaloSize;
        varying vec3 vWorldPosition;

        // Value noise helpers for FBM cloud band
        float hash21(vec2 p) {
          p = fract(p * vec2(234.34, 435.345));
          p += dot(p, p + 34.23);
          return fract(p.x * p.y);
        }

        float valueNoise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(hash21(i),                  hash21(i + vec2(1.0, 0.0)), f.x),
            mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x),
            f.y
          );
        }

        float fbm(vec2 p) {
          float v = 0.0;
          float a = 0.5;
          for (int i = 0; i < 4; i++) {
            v += a * valueNoise(p);
            p  = p * 2.1 + vec2(1.3, 2.7);
            a *= 0.5;
          }
          return v;
        }

        void main() {
          vec3 dir = normalize(vWorldPosition);
          float h = dir.y; // -1 below horizon, 0 at horizon, +1 at zenith

          // 3-stop gradient: horizon → mid → zenith
          float tLow  = smoothstep(-0.05, 0.30, h);
          float tHigh = smoothstep(0.20, 0.75, h);
          vec3 sky = mix(horizonColor, midColor,   tLow);
          sky       = mix(sky,         zenithColor, tHigh);

          // Faint horizontal cloud band (between mid and zenith)
          float cloudBand = smoothstep(0.18, 0.32, h) * smoothstep(0.55, 0.38, h);
          vec2 cloudUV = vec2(atan(dir.z, dir.x) * 2.0, dir.y * 6.0);
          float cloud  = fbm(cloudUV);
          float cloudAlpha = cloudBand * smoothstep(0.46, 0.62, cloud) * 0.22;
          sky = mix(sky, vec3(0.92, 0.88, 0.86), cloudAlpha);

          // Sun disc + soft halo
          vec3  sunDir  = normalize(uSunPosition);
          float cosAng  = dot(dir, sunDir);
          float disc    = smoothstep(1.0 - sunSize,     1.0,           cosAng);
          float halo    = smoothstep(1.0 - sunHaloSize, 1.0 - sunSize, cosAng) * 0.38;
          sky = mix(sky, vec3(1.0, 0.95, 0.75), clamp(disc + halo, 0.0, 1.0));

          gl_FragColor = vec4(sky, 1.0);
        }
      `,
      side: THREE.BackSide,
      depthWrite: false,
    });

    return new THREE.Mesh(geometry, material);
  }

  /** Kept for API compatibility. */
  setColors(_topColor: number, _bottomColor: number): void {}

  dispose(): void {
    this.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}
