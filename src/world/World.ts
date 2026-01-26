import * as THREE from 'three';

export interface ArenaConfig {
  width: number;
  depth: number;
  wallHeight: number;
  floorColor: number;
  wallColor: number;
}

export class World {
  private scene: THREE.Scene;
  private config: ArenaConfig;
  private obstacles: THREE.Mesh[] = [];
  private colliders: THREE.Box3[] = [];

  constructor(scene: THREE.Scene, config?: Partial<ArenaConfig>) {
    this.scene = scene;
    this.config = {
      width: 50,
      depth: 50,
      wallHeight: 5,
      floorColor: 0x2d5a27,
      wallColor: 0x4a4a4a,
      ...config,
    };

    this.build();
  }

  private build(): void {
    this.createFloor();
    this.createWalls();
    this.createObstacles();
    this.createDecorations();
    this.enhanceLighting();
  }

  private createFloor(): void {
    const floorGeometry = new THREE.PlaneGeometry(
      this.config.width,
      this.config.depth,
      20,
      20
    );
    
    const positions = floorGeometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const y = positions.getY(i);
      if (Math.abs(x) < this.config.width / 2 - 2 && 
          Math.abs(y) < this.config.depth / 2 - 2) {
        positions.setZ(i, Math.random() * 0.1);
      }
    }
    floorGeometry.computeVertexNormals();

    const floorMaterial = new THREE.MeshStandardMaterial({
      color: this.config.floorColor,
      roughness: 0.9,
      metalness: 0.1,
    });

    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    floor.name = 'floor';
    this.scene.add(floor);

    const gridHelper = new THREE.GridHelper(
      Math.min(this.config.width, this.config.depth),
      20,
      0x000000,
      0x000000
    );
    gridHelper.position.y = 0.02;
    gridHelper.material.opacity = 0.1;
    gridHelper.material.transparent = true;
    this.scene.add(gridHelper);
  }

  private createWalls(): void {
    const { width, depth, wallHeight, wallColor } = this.config;
    const wallThickness = 1;

    const wallMaterial = new THREE.MeshStandardMaterial({
      color: wallColor,
      roughness: 0.8,
      metalness: 0.2,
    });

    const walls = [
      { 
        size: [width + wallThickness * 2, wallHeight, wallThickness],
        position: [0, wallHeight / 2, -depth / 2]
      },
      {
        size: [width + wallThickness * 2, wallHeight, wallThickness],
        position: [0, wallHeight / 2, depth / 2]
      },
      {
        size: [wallThickness, wallHeight, depth],
        position: [width / 2, wallHeight / 2, 0]
      },
      {
        size: [wallThickness, wallHeight, depth],
        position: [-width / 2, wallHeight / 2, 0]
      },
    ];

    walls.forEach((wallConfig) => {
      const geometry = new THREE.BoxGeometry(...wallConfig.size as [number, number, number]);
      const wall = new THREE.Mesh(geometry, wallMaterial);
      wall.position.set(...wallConfig.position as [number, number, number]);
      wall.castShadow = true;
      wall.receiveShadow = true;
      this.scene.add(wall);

      const box = new THREE.Box3().setFromObject(wall);
      this.colliders.push(box);
    });

    const pillarPositions = [
      [-width / 2, depth / 2],
      [width / 2, depth / 2],
      [-width / 2, -depth / 2],
      [width / 2, -depth / 2],
    ];

    const pillarGeometry = new THREE.CylinderGeometry(1, 1.2, wallHeight + 1, 8);
    const pillarMaterial = new THREE.MeshStandardMaterial({
      color: 0x3a3a3a,
      roughness: 0.6,
    });

    pillarPositions.forEach((pos) => {
      const pillar = new THREE.Mesh(pillarGeometry, pillarMaterial);
      pillar.position.set(pos[0], (wallHeight + 1) / 2, pos[1]);
      pillar.castShadow = true;
      pillar.receiveShadow = true;
      this.scene.add(pillar);
    });
  }

  private createObstacles(): void {
    const obstacleConfigs = [
      { type: 'crate', positions: [
        [-8, -8], [8, -8], [-8, 8], [8, 8],
        [0, -15], [-12, 0], [12, 0], [0, 15],
      ]},
      { type: 'barrel', positions: [
        [-5, -5], [5, -5], [-5, 5], [5, 5],
        [-15, -15], [15, -15], [-15, 15], [15, 15],
      ]},
      { type: 'lowWall', positions: [
        [-10, 0], [10, 0], [0, -10], [0, 10],
      ]},
      { type: 'pillar', positions: [
        [-6, -12], [6, -12], [-6, 12], [6, 12],
      ]},
    ];

    obstacleConfigs.forEach(config => {
      config.positions.forEach((pos) => {
        const obstacle = this.createObstacle(config.type, pos[0], pos[1]);
        if (obstacle) {
          this.obstacles.push(obstacle);
          
          const box = new THREE.Box3().setFromObject(obstacle);
          this.colliders.push(box);
        }
      });
    });
  }

  private createObstacle(type: string, x: number, z: number): THREE.Mesh | null {
    let mesh: THREE.Mesh;

    switch (type) {
      case 'crate': {
        const size = 1.5 + Math.random() * 0.5;
        const geometry = new THREE.BoxGeometry(size, size, size);
        const material = new THREE.MeshStandardMaterial({
          color: 0x8B4513,
          roughness: 0.9,
        });
        mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(x, size / 2, z);
        break;
      }
      case 'barrel': {
        const geometry = new THREE.CylinderGeometry(0.5, 0.5, 1.2, 12);
        const material = new THREE.MeshStandardMaterial({
          color: 0x444444,
          roughness: 0.7,
          metalness: 0.3,
        });
        mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(x, 0.6, z);
        
        const bandGeometry = new THREE.CylinderGeometry(0.52, 0.52, 0.2, 12);
        const bandMaterial = new THREE.MeshStandardMaterial({
          color: Math.random() > 0.5 ? 0xff4444 : 0x44ff44,
        });
        const band = new THREE.Mesh(bandGeometry, bandMaterial);
        band.position.y = 0.3;
        mesh.add(band);
        break;
      }
      case 'lowWall': {
        const geometry = new THREE.BoxGeometry(4, 1.2, 0.5);
        const material = new THREE.MeshStandardMaterial({
          color: 0x666666,
          roughness: 0.8,
        });
        mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(x, 0.6, z);
        mesh.rotation.y = Math.random() * Math.PI;
        break;
      }
      case 'pillar': {
        const geometry = new THREE.CylinderGeometry(0.6, 0.6, 3, 8);
        const material = new THREE.MeshStandardMaterial({
          color: 0x888888,
          roughness: 0.6,
        });
        mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(x, 1.5, z);
        break;
      }
      default:
        return null;
    }

    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    return mesh;
  }

  private createDecorations(): void {
    const debrisGeometry = new THREE.DodecahedronGeometry(0.2);
    const debrisMaterial = new THREE.MeshStandardMaterial({
      color: 0x555555,
      roughness: 1,
    });

    for (let i = 0; i < 50; i++) {
      const debris = new THREE.Mesh(debrisGeometry, debrisMaterial);
      debris.position.set(
        (Math.random() - 0.5) * (this.config.width - 4),
        0.1,
        (Math.random() - 0.5) * (this.config.depth - 4)
      );
      debris.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI
      );
      debris.scale.setScalar(0.5 + Math.random() * 1.5);
      debris.receiveShadow = true;
      this.scene.add(debris);
    }
  }

  private enhanceLighting(): void {
    const lightPositions = [
      [-15, 4, -15],
      [15, 4, -15],
      [-15, 4, 15],
      [15, 4, 15],
    ];

    lightPositions.forEach((pos) => {
      const light = new THREE.PointLight(0xffaa66, 0.5, 20);
      light.position.set(pos[0], pos[1], pos[2]);
      light.castShadow = true;
      light.shadow.mapSize.width = 512;
      light.shadow.mapSize.height = 512;
      this.scene.add(light);

      const fixtureGeometry = new THREE.CylinderGeometry(0.3, 0.4, 0.3, 8);
      const fixtureMaterial = new THREE.MeshStandardMaterial({
        color: 0xffcc88,
        emissive: 0xffaa66,
        emissiveIntensity: 0.5,
      });
      const fixture = new THREE.Mesh(fixtureGeometry, fixtureMaterial);
      fixture.position.set(pos[0], pos[1] + 0.5, pos[2]);
      this.scene.add(fixture);
    });
  }

  public getColliders(): THREE.Box3[] {
    return this.colliders;
  }

  public getObstacles(): THREE.Mesh[] {
    return this.obstacles;
  }

  public isInsideArena(position: THREE.Vector3): boolean {
    const halfWidth = this.config.width / 2 - 1;
    const halfDepth = this.config.depth / 2 - 1;
    
    return (
      position.x > -halfWidth && position.x < halfWidth &&
      position.z > -halfDepth && position.z < halfDepth
    );
  }

  public clampToArena(position: THREE.Vector3): THREE.Vector3 {
    const halfWidth = this.config.width / 2 - 1;
    const halfDepth = this.config.depth / 2 - 1;
    
    position.x = Math.max(-halfWidth, Math.min(halfWidth, position.x));
    position.z = Math.max(-halfDepth, Math.min(halfDepth, position.z));
    
    return position;
  }

  public dispose(): void {
    this.obstacles.forEach(obstacle => {
      this.scene.remove(obstacle);
      obstacle.geometry.dispose();
      if (Array.isArray(obstacle.material)) {
        obstacle.material.forEach(m => m.dispose());
      } else {
        obstacle.material.dispose();
      }
    });
    this.obstacles = [];
    this.colliders = [];
  }
}
