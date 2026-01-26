import * as THREE from 'three';
import { Enemy } from './Enemy';

export class EnemyManager {
  private scene: THREE.Scene;
  private enemies: Map<string, Enemy> = new Map();
  private spawnPoints: THREE.Vector3[] = [];
  
  private maxEnemies: number = 10;
  private spawnInterval: number = 3;
  private lastSpawnTime: number = 0;
  private waveNumber: number = 1;
  private enemiesPerWave: number = 5;
  private enemiesSpawnedThisWave: number = 0;
  
  public onEnemyKilled: ((points: number) => void) | null = null;
  public onPlayerDamaged: ((damage: number) => void) | null = null;
  public onWaveComplete: ((waveNumber: number) => void) | null = null;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.setupSpawnPoints();
  }

  private setupSpawnPoints(): void {
    const spawnDistance = 20;
    const numPoints = 8;
    
    for (let i = 0; i < numPoints; i++) {
      const angle = (i / numPoints) * Math.PI * 2;
      const x = Math.cos(angle) * spawnDistance;
      const z = Math.sin(angle) * spawnDistance;
      this.spawnPoints.push(new THREE.Vector3(x, 0, z));
    }
  }

  public update(deltaTime: number, playerPosition: THREE.Vector3): void {
    this.enemies.forEach((enemy) => {
      if (!enemy.isDead()) {
        enemy.update(deltaTime, playerPosition);
      }
    });
    
    this.handleSpawning();
    
    if (this.enemiesSpawnedThisWave >= this.enemiesPerWave && this.enemies.size === 0) {
      this.nextWave();
    }
  }

  private handleSpawning(): void {
    const now = performance.now() / 1000;
    
    if (now - this.lastSpawnTime < this.spawnInterval) return;
    if (this.enemies.size >= this.maxEnemies) return;
    if (this.enemiesSpawnedThisWave >= this.enemiesPerWave) return;
    
    this.spawnEnemy();
    this.lastSpawnTime = now;
  }

  public spawnEnemy(type?: string): Enemy {
    const spawnPoint = this.spawnPoints[
      Math.floor(Math.random() * this.spawnPoints.length)
    ].clone();
    
    spawnPoint.x += (Math.random() - 0.5) * 5;
    spawnPoint.z += (Math.random() - 0.5) * 5;
    
    if (!type) {
      type = this.chooseEnemyType();
    }
    
    const enemy = new Enemy(this.scene, spawnPoint, type);
    
    enemy.onDeath = (e) => this.handleEnemyDeath(e);
    enemy.onAttack = (damage) => {
      if (this.onPlayerDamaged) {
        this.onPlayerDamaged(damage);
      }
    };
    
    this.enemies.set(enemy.getId(), enemy);
    this.enemiesSpawnedThisWave++;
    
    return enemy;
  }

  private chooseEnemyType(): string {
    const rand = Math.random();
    
    if (this.waveNumber >= 3 && rand < 0.2) {
      return 'TANK';
    } else if (this.waveNumber >= 2 && rand < 0.4) {
      return 'FAST';
    }
    
    return 'GRUNT';
  }

  private handleEnemyDeath(enemy: Enemy): void {
    const points = enemy.getPoints();
    this.enemies.delete(enemy.getId());
    
    if (this.onEnemyKilled) {
      this.onEnemyKilled(points);
    }
  }

  private nextWave(): void {
    this.waveNumber++;
    this.enemiesSpawnedThisWave = 0;
    this.enemiesPerWave = Math.min(5 + this.waveNumber * 2, 20);
    this.spawnInterval = Math.max(1, 3 - this.waveNumber * 0.2);
    
    if (this.onWaveComplete) {
      this.onWaveComplete(this.waveNumber - 1);
    }
    
    console.log(`Wave ${this.waveNumber} starting! Enemies: ${this.enemiesPerWave}`);
  }

  public handleHit(object: THREE.Object3D, damage: number): boolean {
    let current: THREE.Object3D | null = object;
    while (current) {
      if (current.userData.type === 'enemy') {
        const enemy = current.userData.enemy as Enemy;
        if (enemy && !enemy.isDead()) {
          return enemy.takeDamage(damage);
        }
      }
      current = current.parent;
    }
    return false;
  }

  public getEnemies(): Enemy[] {
    return Array.from(this.enemies.values());
  }

  public getEnemyCount(): number {
    return this.enemies.size;
  }

  public getWaveNumber(): number {
    return this.waveNumber;
  }

  public reset(): void {
    this.enemies.forEach(enemy => enemy.dispose());
    this.enemies.clear();
    this.waveNumber = 1;
    this.enemiesSpawnedThisWave = 0;
    this.enemiesPerWave = 5;
    this.spawnInterval = 3;
    this.lastSpawnTime = 0;
  }

  public dispose(): void {
    this.enemies.forEach(enemy => enemy.dispose());
    this.enemies.clear();
  }
}
