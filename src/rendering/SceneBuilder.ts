/**
 * Arena scene builder — creates floor, walls, obstacles, decorations, lighting.
 * Returns AABB colliders for PhysicsSystem.
 */

import * as THREE from 'three';
import { GAME_CONFIG } from '../core/GameConfig';
import type { AABBCollider } from '../systems/PhysicsSystem';

export class SceneBuilder {
  private scene: THREE.Scene;
  private colliders: AABBCollider[] = [];
  private meshes: THREE.Object3D[] = [];

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  build(): AABBCollider[] {
    this.createFloor();
    this.createWalls();
    this.createObstacles();
    this.createDecorations();
    this.createLighting();
    return this.colliders;
  }

  private createFloor(): void {
    const { width, depth } = GAME_CONFIG.arena;

    const geometry = new THREE.PlaneGeometry(width, depth, 20, 20);
    const positions = geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const y = positions.getY(i);
      if (Math.abs(x) < width / 2 - 2 && Math.abs(y) < depth / 2 - 2) {
        positions.setZ(i, Math.random() * 0.1);
      }
    }
    geometry.computeVertexNormals();

    const material = new THREE.MeshStandardMaterial({
      color: 0x2d5a27,
      roughness: 0.9,
      metalness: 0.1,
    });

    const floor = new THREE.Mesh(geometry, material);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    floor.name = 'floor';
    this.scene.add(floor);
    this.meshes.push(floor);

    // Grid lines
    const grid = new THREE.GridHelper(
      Math.min(width, depth), 20, 0x000000, 0x000000,
    );
    grid.position.y = 0.02;
    (grid.material as THREE.Material).opacity = 0.08;
    (grid.material as THREE.Material).transparent = true;
    this.scene.add(grid);
    this.meshes.push(grid);
  }

  private createWalls(): void {
    const { width, depth, wallHeight, wallThickness } = GAME_CONFIG.arena;
    const wallMaterial = new THREE.MeshStandardMaterial({
      color: 0x4a4a4a,
      roughness: 0.8,
      metalness: 0.2,
    });

    const wallDefs: [number, number, number, number, number, number][] = [
      [0, wallHeight / 2, -depth / 2, width + wallThickness * 2, wallHeight, wallThickness],
      [0, wallHeight / 2, depth / 2, width + wallThickness * 2, wallHeight, wallThickness],
      [width / 2, wallHeight / 2, 0, wallThickness, wallHeight, depth],
      [-width / 2, wallHeight / 2, 0, wallThickness, wallHeight, depth],
    ];

    for (const [px, py, pz, sx, sy, sz] of wallDefs) {
      const geo = new THREE.BoxGeometry(sx, sy, sz);
      const wall = new THREE.Mesh(geo, wallMaterial);
      wall.position.set(px, py, pz);
      wall.castShadow = true;
      wall.receiveShadow = true;
      this.scene.add(wall);
      this.meshes.push(wall);

      const box = new THREE.Box3().setFromObject(wall);
      this.colliders.push({
        minX: box.min.x,
        minZ: box.min.z,
        maxX: box.max.x,
        maxZ: box.max.z,
      });
    }

    // Corner pillars
    const pillarGeo = new THREE.CylinderGeometry(1, 1.2, wallHeight + 1, 8);
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.6 });
    const corners: [number, number][] = [
      [-width / 2, -depth / 2], [width / 2, -depth / 2],
      [-width / 2, depth / 2], [width / 2, depth / 2],
    ];
    for (const [cx, cz] of corners) {
      const pillar = new THREE.Mesh(pillarGeo, pillarMat);
      pillar.position.set(cx, (wallHeight + 1) / 2, cz);
      pillar.castShadow = true;
      pillar.receiveShadow = true;
      this.scene.add(pillar);
      this.meshes.push(pillar);
    }
  }

  private createObstacles(): void {
    const cratePositions = [[-8, -8], [8, -8], [-8, 8], [8, 8], [0, -15], [-12, 0], [12, 0], [0, 15]];
    const barrelPositions = [[-5, -5], [5, -5], [-5, 5], [5, 5], [-15, -15], [15, -15], [-15, 15], [15, 15]];
    const lowWallPositions = [[-10, 0], [10, 0], [0, -10], [0, 10]];
    const pillarPositions = [[-6, -12], [6, -12], [-6, 12], [6, 12]];

    for (const [x, z] of cratePositions) this.addCrate(x, z);
    for (const [x, z] of barrelPositions) this.addBarrel(x, z);
    for (const [x, z] of lowWallPositions) this.addLowWall(x, z);
    for (const [x, z] of pillarPositions) this.addPillar(x, z);
  }

  private addCrate(x: number, z: number): void {
    const size = 1.5 + Math.random() * 0.5;
    const geo = new THREE.BoxGeometry(size, size, size);
    const mat = new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.9 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, size / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    this.meshes.push(mesh);
    this.addCollider(mesh);
  }

  private addBarrel(x: number, z: number): void {
    const geo = new THREE.CylinderGeometry(0.5, 0.5, 1.2, 12);
    const mat = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.7, metalness: 0.3 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, 0.6, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    const bandGeo = new THREE.CylinderGeometry(0.52, 0.52, 0.2, 12);
    const bandMat = new THREE.MeshStandardMaterial({ color: Math.random() > 0.5 ? 0xff4444 : 0x44ff44 });
    const band = new THREE.Mesh(bandGeo, bandMat);
    band.position.y = 0.3;
    mesh.add(band);

    this.scene.add(mesh);
    this.meshes.push(mesh);
    this.addCollider(mesh);
  }

  private addLowWall(x: number, z: number): void {
    const geo = new THREE.BoxGeometry(4, 1.2, 0.5);
    const mat = new THREE.MeshStandardMaterial({ color: 0x666666, roughness: 0.8 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, 0.6, z);
    mesh.rotation.y = Math.random() * Math.PI;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    this.meshes.push(mesh);
    this.addCollider(mesh);
  }

  private addPillar(x: number, z: number): void {
    const geo = new THREE.CylinderGeometry(0.6, 0.6, 3, 8);
    const mat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.6 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, 1.5, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    this.meshes.push(mesh);
    this.addCollider(mesh);
  }

  private addCollider(mesh: THREE.Object3D): void {
    const box = new THREE.Box3().setFromObject(mesh);
    this.colliders.push({
      minX: box.min.x,
      minZ: box.min.z,
      maxX: box.max.x,
      maxZ: box.max.z,
    });
  }

  private createDecorations(): void {
    const { width, depth } = GAME_CONFIG.arena;
    const debrisGeo = new THREE.DodecahedronGeometry(0.2);
    const debrisMat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 1 });

    for (let i = 0; i < 50; i++) {
      const debris = new THREE.Mesh(debrisGeo, debrisMat);
      debris.position.set(
        (Math.random() - 0.5) * (width - 4),
        0.1,
        (Math.random() - 0.5) * (depth - 4),
      );
      debris.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      debris.scale.setScalar(0.5 + Math.random() * 1.5);
      debris.receiveShadow = true;
      this.scene.add(debris);
      this.meshes.push(debris);
    }
  }

  private createLighting(): void {
    const { ambient, hemisphere, sun, fill } = GAME_CONFIG.lighting;

    const amb = new THREE.AmbientLight(ambient.color, ambient.intensity);
    this.scene.add(amb);

    const hemi = new THREE.HemisphereLight(hemisphere.sky, hemisphere.ground, hemisphere.intensity);
    hemi.position.set(0, 50, 0);
    this.scene.add(hemi);

    const sunLight = new THREE.DirectionalLight(sun.color, sun.intensity);
    sunLight.position.set(...sun.position);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = GAME_CONFIG.rendering.shadowMapSize;
    sunLight.shadow.mapSize.height = GAME_CONFIG.rendering.shadowMapSize;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 150;
    sunLight.shadow.camera.left = -50;
    sunLight.shadow.camera.right = 50;
    sunLight.shadow.camera.top = 50;
    sunLight.shadow.camera.bottom = -50;
    sunLight.shadow.bias = -0.0001;
    this.scene.add(sunLight);

    const fillLight = new THREE.DirectionalLight(fill.color, fill.intensity);
    fillLight.position.set(...fill.position);
    this.scene.add(fillLight);

    // Wall-mounted point lights (no shadows for performance)
    const lightPositions: [number, number, number][] = [
      [-15, 4, -15], [15, 4, -15], [-15, 4, 15], [15, 4, 15],
    ];
    for (const [lx, ly, lz] of lightPositions) {
      const pt = new THREE.PointLight(0xffaa66, 0.5, 20);
      pt.position.set(lx, ly, lz);
      this.scene.add(pt);

      const fixtureGeo = new THREE.CylinderGeometry(0.3, 0.4, 0.3, 8);
      const fixtureMat = new THREE.MeshStandardMaterial({
        color: 0xffcc88, emissive: 0xffaa66, emissiveIntensity: 0.5,
      });
      const fixture = new THREE.Mesh(fixtureGeo, fixtureMat);
      fixture.position.set(lx, ly + 0.5, lz);
      this.scene.add(fixture);
      this.meshes.push(fixture);
    }
  }

  dispose(): void {
    for (const mesh of this.meshes) {
      this.scene.remove(mesh);
      if (mesh instanceof THREE.Mesh) {
        mesh.geometry?.dispose();
        const mat = mesh.material;
        if (Array.isArray(mat)) mat.forEach(m => m.dispose());
        else mat.dispose();
      }
    }
    this.meshes = [];
    this.colliders = [];
  }
}
