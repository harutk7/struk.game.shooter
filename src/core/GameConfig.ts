/**
 * Centralized game configuration — all tuning constants in one place.
 * No game logic lives here; this is pure data.
 */

export const GAME_CONFIG = {
  /** Arena dimensions */
  arena: {
    width: 50,
    depth: 50,
    wallHeight: 5,
    wallThickness: 1,
  },

  /** Player tuning */
  player: {
    moveSpeed: 8,
    sprintMultiplier: 1.6,
    jumpForce: 10,
    gravity: 25,
    height: 1.7,
    maxHealth: 100,
    invincibilityDuration: 0.5, // seconds after taking damage
    respawnDelay: 2,
  },

  /** Camera / look */
  camera: {
    fov: 75,
    near: 0.1,
    far: 500,
    mouseSensitivity: 0.002,
    mobileLookSensitivity: 0.005,
    minPitch: -Math.PI / 2 + 0.01,
    maxPitch: Math.PI / 2 - 0.01,
  },

  /** Weapon definitions */
  weapons: {
    PISTOL: {
      name: 'Pistol',
      damage: 25,
      fireRate: 4,       // rounds per second
      magazineSize: 12,
      reloadTime: 1.5,   // seconds
      range: 100,
      spread: 1,         // degrees
      automatic: false,
      reserveAmmo: 48,
    },
    RIFLE: {
      name: 'Assault Rifle',
      damage: 18,
      fireRate: 10,
      magazineSize: 30,
      reloadTime: 2.2,
      range: 150,
      spread: 2.5,
      automatic: true,
      reserveAmmo: 120,
    },
    SHOTGUN: {
      name: 'Shotgun',
      damage: 12,        // per pellet
      fireRate: 1.2,
      magazineSize: 8,
      reloadTime: 2.8,
      range: 30,
      spread: 12,
      automatic: false,
      pellets: 8,
      reserveAmmo: 32,
    },
  },

  /** Enemy definitions */
  enemies: {
    GRUNT: {
      name: 'Grunt',
      health: 50,
      speed: 3.5,
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
      speed: 7,
      damage: 5,
      attackRange: 1.5,
      attackCooldown: 0.7,
      detectionRange: 25,
      color: 0x44ff44,
      size: { width: 0.6, height: 1.2, depth: 0.6 },
      points: 150,
    },
    TANK: {
      name: 'Tank',
      health: 150,
      speed: 2,
      damage: 25,
      attackRange: 2.5,
      attackCooldown: 2.2,
      detectionRange: 15,
      color: 0x4444ff,
      size: { width: 1.2, height: 2.0, depth: 1.2 },
      points: 300,
    },
  },

  /** Wave / spawning */
  waves: {
    initialEnemiesPerWave: 5,
    maxEnemiesPerWave: 25,
    enemiesPerWaveGrowth: 2,
    initialSpawnInterval: 3,   // seconds
    minSpawnInterval: 0.8,
    spawnIntervalDecay: 0.15,
    maxSimultaneousEnemies: 12,
    spawnDistance: 22,
    spawnMargin: 4,
    waveBreakDuration: 3,      // seconds between waves
  },

  /** Scoring */
  scoring: {
    comboWindow: 2,            // seconds between kills for combo
    maxComboMultiplier: 5,
    headshotMultiplier: 2,
  },

  /** Power-ups */
  powerUps: {
    dropChance: 0.25,          // chance per enemy kill
    healthPack: { healAmount: 30 },
    ammoPack: { ammoAmount: 20 },
    speedBoost: { multiplier: 1.5, duration: 5 },
    damageBoost: { multiplier: 2, duration: 5 },
  },

  /** Rendering */
  rendering: {
    shadowMapSize: 2048,
    shadowType: 'PCFSoft' as const,
    antialias: true,
    pixelRatio: Math.min(typeof window !== 'undefined' ? window.devicePixelRatio : 1, 2),
    fogColor: 0x87ceeb,
    fogNear: 10,
    fogFar: 120,
  },

  /** Lighting */
  lighting: {
    ambient: { color: 0x6688cc, intensity: 0.4 },
    hemisphere: { sky: 0x87ceeb, ground: 0x444444, intensity: 0.5 },
    sun: { color: 0xffffcc, intensity: 1.2, position: [30, 50, 30] as const },
    fill: { color: 0x8888ff, intensity: 0.3, position: [-20, 30, -20] as const },
  },
} as const;

export type GameConfig = typeof GAME_CONFIG;
export type WeaponConfig = GameConfig['weapons'][keyof GameConfig['weapons']];
export type EnemyConfig = GameConfig['enemies'][keyof GameConfig['enemies']];
