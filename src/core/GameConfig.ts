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

  /** First-person view body & motion (added in realistic-shooter-overhaul). */
  fpv: {
    /** Vertical eye-bob amplitude in world units (added to camera Y). */
    bobAmplitude: 0.04,
    /** Lateral body sway amplitude in world units. */
    walkSway: 0.025,
    /** Eye height offset from player.position.y (m). 1.6m = ~5'3". */
    eyeHeight: 1.6,
    /** Crouch eye-height multiplier (1.0 = standing, 0.6 = crouched). */
    crouchEyeHeightMul: 0.65,
    /** Body z offset from camera (chest sits in front of eyes). */
    bodyZ: -0.12,
  },

  /** Per-weapon body-recoil / sway tuning (added in realistic-shooter-overhaul). */
  weaponFeel: {
    PISTOL:  { kick: 0.30, sway: 0.10, raise: 0.35 },
    RIFLE:   { kick: 0.25, sway: 0.08, raise: 0.40 },
    SHOTGUN: { kick: 0.60, sway: 0.18, raise: 0.55 },
    SNIPER:  { kick: 0.75, sway: 0.05, raise: 0.50 },
  },

  /** Weapon switch animation timing (added in realistic-shooter-overhaul). */
  weaponAnim: {
    /** seconds spent lowering the current weapon before swap */
    switchDownTime: 0.12,
    /** seconds spent raising the new weapon after swap */
    switchUpTime: 0.20,
    /** how far down the weapon moves during switch (local Y units) */
    switchDropDistance: 0.25,
  },

  /** Deathmatch match config (added in T4). */
  match: {
    /** First to this many kills wins. 0 = timer-only. */
    scoreLimit: 20,
    /** Time limit in seconds. */
    timeLimit: 300, // 5 minutes
    /** Seconds to count up the post-match scoreboard. */
    postMatchDelay: 4,
  },

  /** Bot (AI opponent) tuning (added in realistic-shooter-overhaul). */
  bots: {
    /** Number of bots to spawn in a deathmatch. */
    count: 5,
    /** Bot names pool. */
    names: [
      'Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo',
      'Foxtrot', 'Golf', 'Hotel', 'India', 'Juliet',
    ],
    /** Per-bot accent color. */
    colors: [0x8844ff, 0x44ddff, 0xff44dd, 0xdddd44, 0x44ff88, 0xff8844, 0x44ff44, 0x8888ff],
    /** Difficulty levels — affects reaction time, accuracy, and decision quality. */
    difficulty: {
      easy:   { reactionTime: 0.55, accuracy: 0.45, strafeProb: 0.20, coverProb: 0.15 },
      normal: { reactionTime: 0.35, accuracy: 0.65, strafeProb: 0.40, coverProb: 0.30 },
      hard:   { reactionTime: 0.18, accuracy: 0.85, strafeProb: 0.60, coverProb: 0.55 },
    },
    /** Default per-bot behavior tuning. */
    patrol: {
      /** Radius of random walk around a waypoint. */
      waypointRadius: 6,
      /** How often a bot picks a new waypoint. */
      waypointInterval: 4,
      /** Walk speed (m/s). */
      walkSpeed: 3.0,
      /** Sprint speed when engaging. */
      runSpeed: 4.5,
    },
    /** Hearing: gunshot radius (m) — bots inside react to it. */
    hearingRadius: 22,
    /** Field of view (deg) for sight checks. */
    fov: 110,
    /** Max distance for a sight check. */
    sightRange: 35,
    /** Respawn delay (s) after death in deathmatch. */
    respawnDelay: 3,
    /** Deathmatch spawn points (xz). 8 distributed around the arena. */
    spawnPoints: [
      { x:  18, z:  18 },
      { x: -18, z:  18 },
      { x:  18, z: -18 },
      { x: -18, z: -18 },
      { x:   0, z:  22 },
      { x:   0, z: -22 },
      { x:  22, z:   0 },
      { x: -22, z:   0 },
    ] as const,
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
    },    // Added in realistic-shooter-overhaul (CS 1.6-style bolt-action)
    SNIPER: {
      name: 'Sniper Rifle',
      damage: 90,
      fireRate: 1.0,
      magazineSize: 5,
      reloadTime: 2.6,
      range: 250,
      spread: 0.3,       // very tight
      automatic: false,
      reserveAmmo: 20,
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
