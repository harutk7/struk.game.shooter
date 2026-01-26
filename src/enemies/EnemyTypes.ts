export interface EnemyConfig {
  name: string;
  health: number;
  speed: number;
  damage: number;
  attackRange: number;
  attackCooldown: number;
  detectionRange: number;
  color: number;
  size: { width: number; height: number; depth: number };
  points: number;
}

export const ENEMY_TYPES: Record<string, EnemyConfig> = {
  GRUNT: {
    name: 'Grunt',
    health: 50,
    speed: 3,
    damage: 10,
    attackRange: 2,
    attackCooldown: 1.5,
    detectionRange: 20,
    color: 0xff4444,
    size: { width: 0.8, height: 1.6, depth: 0.8 },
    points: 100,
  },
  FAST: {
    name: 'Runner',
    health: 30,
    speed: 6,
    damage: 5,
    attackRange: 1.5,
    attackCooldown: 0.8,
    detectionRange: 25,
    color: 0x44ff44,
    size: { width: 0.6, height: 1.2, depth: 0.6 },
    points: 150,
  },
  TANK: {
    name: 'Tank',
    health: 150,
    speed: 1.5,
    damage: 25,
    attackRange: 2.5,
    attackCooldown: 2,
    detectionRange: 15,
    color: 0x4444ff,
    size: { width: 1.2, height: 2, depth: 1.2 },
    points: 300,
  },
};
