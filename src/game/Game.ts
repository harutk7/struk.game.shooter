import * as THREE from 'three';
import { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/GameEvents';
import { GameState } from '../core/GameState';
import { GAME_CONFIG } from '../core/GameConfig';
import { InputSystem } from '../systems/InputSystem';
import { PhysicsSystem } from '../systems/PhysicsSystem';
import { CombatSystem } from '../systems/CombatSystem';
import { SpawnSystem } from '../systems/SpawnSystem';
import { WeaponSystem } from '../systems/WeaponSystem';
import { Renderer } from '../rendering/Renderer';
import { SceneBuilder } from '../rendering/SceneBuilder';
import { Skybox } from '../rendering/Skybox';
import { EnemyRenderer } from '../rendering/EnemyRenderer';
import { WeaponRenderer } from '../rendering/WeaponRenderer';
import { PlayerBodyRenderer } from '../rendering/PlayerBodyRenderer';
import { BotRenderer } from '../rendering/BotRenderer';
import { Effects } from '../rendering/Effects';
import { HUD } from '../ui/HUD';
import { Crosshair } from '../ui/Crosshair';
import { StartScreen } from '../ui/StartScreen';
import { GameOverScreen } from '../ui/GameOverScreen';
import { PauseScreen } from '../ui/PauseScreen';
import { KillFeed } from '../ui/KillFeed';
import { VirtualJoystick } from '../ui/mobile/VirtualJoystick';
import { TouchLookController } from '../ui/mobile/TouchLookController';
import { TouchActionButtons } from '../ui/mobile/TouchActionButtons';
import type { PlayerState } from '../models/Player';
import { createPlayer, tickPowerUps, addPowerUp } from '../models/Player';
import type { EnemyData } from '../models/Enemy';
import { isEnemyAlive } from '../models/Enemy';
import type { BotData } from '../models/Bot';
import { createBot, respawnBot } from '../models/Bot';
import { tickBot, type BotWorldSnapshot } from '../systems/BotAI';
import type { AABBCollider } from '../systems/PhysicsSystem';
import type { PowerUpData } from '../models/PowerUp';
import { tickPowerUpLifetime, isPowerUpExpired, getPowerUpConfig } from '../models/PowerUp';
import type { ScoreState } from '../models/ScoreManager';
import { createScoreState, addKill, tickCombo } from '../models/ScoreManager';
import type { WaveState } from '../models/WaveManager';
import type { WavePhase } from '../models/WaveManager';
import { createWaveState, tickWave, registerKill } from '../models/WaveManager';
import { getWeaponConfig } from '../models/Weapon';

export class Game {
  private bus = new EventBus<GameEvents>();
  private state = new GameState();
  private input: InputSystem;
  private physics: PhysicsSystem;
  private combat: CombatSystem;
  private spawner: SpawnSystem;
  private weapons: WeaponSystem;
  private renderer: Renderer;
  private sceneBuilder!: SceneBuilder;
  private skybox!: Skybox;
  private enemyRenderer!: EnemyRenderer;
  private weaponRenderer!: WeaponRenderer;
  private playerBody!: PlayerBodyRenderer;
  private botRenderer!: BotRenderer;
  private effects!: Effects;
  private hud: HUD;
  private crosshair: Crosshair;
  private startScreen: StartScreen;
  private gameOverScreen: GameOverScreen;
  private pauseScreen: PauseScreen;
  private killFeed: KillFeed;
  private joystick: VirtualJoystick;
  private lookController: TouchLookController;
  private actionButtons: TouchActionButtons;
  private player: PlayerState;
  private enemies: EnemyData[] = [];
  private bots: BotData[] = [];
  private obstacles: AABBCollider[] = [];
  private matchActive = false;
  private lastGunshotAt: { x: number; z: number; t: number } | null = null;
  private powerUps: PowerUpData[] = [];
  private score: ScoreState;
  private wave: WaveState;
  private animFrameId = 0;
  private lastTime = 0;
  private cameraYaw = 0;
  private cameraPitch = 0;
  // Realistic FPV: cumulative walk distance feeds limb-swing phase
  private walkPhase = 0;
  private horizontalSpeed = 0;
  // Throttle for empty-click SFX so a held trigger doesn't spam
  private lastEmptyClickAt = -10;
  // Cached AudioContext for the empty-click SFX (lazy-initialized)
  private audioCtx: AudioContext | null = null;
  // Track wave transitions so events are emitted exactly once
  private prevWavePhase: WavePhase = 'spawning';
  private prevWaveNumber = 1;

  constructor(container: HTMLElement) {
    this.input = new InputSystem();
    this.physics = new PhysicsSystem();
    this.combat = new CombatSystem(this.bus);
    this.spawner = new SpawnSystem(this.bus, this.physics);
    this.weapons = new WeaponSystem(this.bus);
    this.renderer = new Renderer(container);
    this.hud = new HUD();
    this.crosshair = new Crosshair();
    this.startScreen = new StartScreen();
    this.gameOverScreen = new GameOverScreen();
    this.pauseScreen = new PauseScreen();
    this.killFeed = new KillFeed();
    this.joystick = new VirtualJoystick('left');
    this.lookController = new TouchLookController();
    this.actionButtons = new TouchActionButtons();
    this.player = createPlayer();
    this.score = createScoreState();
    this.wave = createWaveState();
    this.init();
  }

  private init(): void {
    this.sceneBuilder = new SceneBuilder(this.renderer.scene);
    const colliders = this.sceneBuilder.build();
    this.physics.setColliders(colliders);
    this.obstacles = colliders;
    this.skybox = new Skybox(this.renderer.scene);
    this.enemyRenderer = new EnemyRenderer(this.renderer.scene);
    this.weaponRenderer = new WeaponRenderer(this.renderer.scene, this.renderer.camera);
    this.playerBody = new PlayerBodyRenderer();
    this.playerBody.mount(this.renderer.camera);
    this.botRenderer = new BotRenderer(this.renderer.scene);
    this.effects = new Effects(this.renderer.scene, this.renderer.camera);
    this.input.attach(this.renderer.domElement);

    if (this.input.isMobileDevice) {
      this.lookController.onLook = (dx, dy) => this.input.setMobileInput({ lookX: dx, lookY: dy });
    }

    this.wireEvents();
    this.startScreen.setOnClick(() => this.startGame());
    this.gameOverScreen.setOnRestart(() => this.restartGame());
    this.pauseScreen.setOnResume(() => this.resumeGame());
    this.pauseScreen.setOnQuit(() => this.quitToMenu());

    // Dev entrypoint: ?mode=dm on the start screen jumps straight into
    // a deathmatch round. Keeps wave mode the default for backward compat.
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('mode') === 'dm') {
        this.startDeathmatch();
      }
    } catch { /* non-browser envs */ }

    // Auto-pause when pointer lock is released on desktop (e.g. user presses ESC)
    document.addEventListener('pointerlockchange', () => {
      if (!document.pointerLockElement && this.state.isPlaying && !this.input.isMobileDevice) {
        this.state.transition('PAUSED');
        this.pauseScreen.show();
        cancelAnimationFrame(this.animFrameId);
      }
    });

    this.startScreen.show();
    this.state._forceSet('MENU');
  }

  private wireEvents(): void {
    this.bus.on('playerDamaged', (d) => {
      this.hud.updateHealth(d.currentHealth, d.maxHealth);
      this.effects.flashDamage();
      this.effects.triggerShake(0.05, 0.15);
      this.crosshair.flashHit();
    });
    this.bus.on('playerHealed', (d) => this.hud.updateHealth(d.currentHealth, this.player.maxHealth));
    this.bus.on('playerDied', () => this.handleGameOver());
    this.bus.on('ammoChanged', (d) => this.hud.updateAmmo(d.ammo, d.reserve));
    this.bus.on('weaponReloadStart', (d) => {
      this.hud.showReloading(true);
      // Drive the body reload animation
      const wp = this.weapons.getWeapon(d.weaponType);
      if (wp) this.playerBody.beginReload(wp ? (GAME_CONFIG.weapons[wp.type] as any).reloadTime : 1.5);
    });
    this.bus.on('weaponReloadEnd', () => this.hud.showReloading(false));
    this.bus.on('weaponSwitched', (d) => {
      this.hud.updateWeapon(getWeaponConfig(d.to).name);
      this.playerBody.switchWeaponTo(d.to);
    });
    this.bus.on('weaponEmptyClick', () => this.playEmptyClickSfx());
    this.bus.on('enemyKilled', (d) => {
      const result = addKill(this.score, d.points, performance.now() / 1000);
      this.score = result.state;
      this.hud.updateScore(this.score.score);
      this.killFeed.addKill(result.pointsAwarded, d.type, result.comboActive ? this.score.combo : 0);
      this.wave = registerKill(this.wave);
      const pu = this.spawner.tryDropPowerUp(d.position);
      if (pu) this.powerUps.push(pu);
    });
    this.bus.on('enemyDamaged', (d) => this.enemyRenderer.flashDamage(d.id));
    this.bus.on('waveStarted', (d) => {
      this.hud.updateWave(d.wave);
      this.hud.hideWaveBreak();
    });
    this.bus.on('waveCompleted', (d) => {
      this.hud.showWaveBreak(d.wave + 1, GAME_CONFIG.waves.waveBreakDuration);
    });
    this.bus.on('powerUpSpawned', (d) => {
      const pu = this.powerUps.find(p => p.id === d.id);
      if (pu) this.effects.createPowerUpMesh(pu);
    });
  }

  private startGame(): void {
    this.state.transition('PLAYING');
    this.input.lockPointer();
    this.startScreen.hide();
    this.crosshair.show();
    this.hud.show();

    // Give player all weapons at start
    this.player = { ...this.player, ownedWeapons: ['PISTOL', 'RIFLE', 'SHOTGUN'] };
    this.weapons.initWeapons(['PISTOL', 'RIFLE', 'SHOTGUN']);
    this.hud.updateHealth(this.player.health, this.player.maxHealth);
    this.hud.updateScore(0);
    this.hud.updateWave(1);
    this.hud.updateWeapon(getWeaponConfig(this.player.currentWeapon).name);
    const wp = this.weapons.getCurrentWeapon(this.player);
    if (wp) this.hud.updateAmmo(wp.currentAmmo, wp.reserveAmmo);

    if (this.input.isMobileDevice) {      this.joystick.show(); this.lookController.show(); this.actionButtons.show();
      this.hud.setMobileLayout();
    }
    this.prevWavePhase = 'spawning';
    this.prevWaveNumber = 1;
    cancelAnimationFrame(this.animFrameId);
    this.lastTime = performance.now();
    this.loop();
  }

  private handleGameOver(): void {
    this.state.transition('GAME_OVER');
    this.input.unlockPointer();
    this.crosshair.hide(); this.hud.hide();
    this.gameOverScreen.show(this.score.score, this.wave.waveNumber, this.score.kills);
    if (this.input.isMobileDevice) {
      this.joystick.hide(); this.lookController.hide(); this.actionButtons.hide();
    }
    // RAF is at end of loop — loop stops naturally next tick when isPlaying=false
  }

  /**
   * Start a deathmatch match against AI bots (added in T3).
   * Spawns N bots, equips player with all weapons including sniper,
   * and enables bot AI tick. The wave system is NOT active in deathmatch.
   */
  private startDeathmatch(): void {
    this.state.transition('PLAYING');
    this.input.lockPointer();
    this.startScreen.hide();
    this.crosshair.show();
    this.hud.show();

    // Player starts with all weapons including SNIPER
    this.player = {
      ...this.player,
      ownedWeapons: ['PISTOL', 'RIFLE', 'SHOTGUN', 'SNIPER'],
    };
    this.weapons.initWeapons(['PISTOL', 'RIFLE', 'SHOTGUN', 'SNIPER']);
    this.player = this.weapons.switchWeapon(this.player, 1); // start with RIFLE

    this.hud.updateHealth(this.player.health, this.player.maxHealth);
    this.hud.updateScore(0);
    this.hud.updateWave(0);
    this.hud.updateWeapon(getWeaponConfig(this.player.currentWeapon).name);
    const wp = this.weapons.getCurrentWeapon(this.player);
    if (wp) this.hud.updateAmmo(wp.currentAmmo, wp.reserveAmmo);

    if (this.input.isMobileDevice) {
      this.joystick.show(); this.lookController.show(); this.actionButtons.show();
      this.hud.setMobileLayout();
    }

    // Clear wave system state
    this.prevWavePhase = 'spawning';
    this.prevWaveNumber = 1;

    // Spawn bots
    this.spawnAllBots();
    this.matchActive = true;

    cancelAnimationFrame(this.animFrameId);
    this.lastTime = performance.now();
    this.loop();
  }

  /** Spawn the bot roster, one per spawn point (with rotation if more bots than points). */
  private spawnAllBots(): void {
    this.botRenderer.clear();
    this.bots = [];
    const points = GAME_CONFIG.bots.spawnPoints as unknown as Array<{ x: number; z: number }>;
    for (let i = 0; i < GAME_CONFIG.bots.count; i++) {
      const spawn = points[i % points.length];
      const bot = createBot(i, spawn);
      this.bots.push(bot);
      this.botRenderer.createMesh(bot);
      this.bus.emit('botSpawned', {
        id: bot.id, name: bot.name, color: bot.color,
        difficulty: bot.difficulty, position: { x: spawn.x, z: spawn.z },
      });
    }
  }

  /** Despawn all bots and exit deathmatch. */
  private endMatch(): void {
    this.matchActive = false;
    this.botRenderer.clear();
    this.bots = [];
  }

  private restartGame(): void {
    cancelAnimationFrame(this.animFrameId);
    this.state._forceSet('MENU');
    this.player = createPlayer();
    this.enemies = []; this.powerUps = [];
    this.score = createScoreState(); this.wave = createWaveState();
    this.prevWavePhase = 'spawning'; this.prevWaveNumber = 1;
    this.cameraYaw = 0; this.cameraPitch = 0;
    this.enemyRenderer.clear(); this.effects.clearPowerUps(); this.weapons.reset();
    this.endMatch();
    this.gameOverScreen.hide();
    this.startGame();
  }

  private resumeGame(): void {
    this.state.transition('PLAYING');
    this.pauseScreen.hide(); this.input.lockPointer();
    cancelAnimationFrame(this.animFrameId);
    this.lastTime = performance.now();
    this.loop();
  }

  private quitToMenu(): void {
    cancelAnimationFrame(this.animFrameId);
    this.state.transition('MENU');
    this.pauseScreen.hide(); this.input.unlockPointer();
    this.crosshair.hide(); this.hud.hide(); this.startScreen.show();
    this.player = createPlayer();
    this.enemies = []; this.powerUps = [];
    this.score = createScoreState(); this.wave = createWaveState();
    this.prevWavePhase = 'spawning'; this.prevWaveNumber = 1;
    this.cameraYaw = 0; this.cameraPitch = 0;
    this.enemyRenderer.clear(); this.effects.clearPowerUps(); this.weapons.reset();
    this.endMatch();
    if (this.input.isMobileDevice) {
      this.joystick.hide(); this.lookController.hide(); this.actionButtons.hide();
    }
  }

  private loop = (): void => {
    const now = performance.now();
    const dt = Math.min((now - this.lastTime) / 1000, 0.1);
    this.lastTime = now;

    // Feed mobile controls into InputSystem BEFORE poll() so they appear in this frame's snapshot
    if (this.input.isMobileDevice) {
      const joy = this.joystick.getState();
      const acts = this.actionButtons.getState();
      // Auto-sprint when joystick is pushed beyond 75% of max throw
      const autoSprint = joy.distance > 0.75;
      this.input.setMobileInput({
        moveX: joy.x, moveY: joy.y,
        shoot: acts.shoot, jump: acts.jump, reload: acts.reload,
        sprint: autoSprint,
        weaponSwitch: acts.weaponSwitch,
      });
    }

    const snap = this.input.poll();

    // Check mobile pause (edge-triggered via consumePause) and keyboard pause
    const mobilePause = this.input.isMobileDevice && this.actionButtons.consumePause();
    if ((snap.pause || mobilePause) && this.state.isPlaying) {
      this.state.transition('PAUSED');
      this.pauseScreen.show(); this.input.unlockPointer();
      return; // RAF not scheduled — loop stops until resumeGame() calls this.loop()
    }
    if (!this.state.isPlaying) return;

    // ── Camera rotation — separate sensitivity for mobile vs desktop ──
    const sensitivity = this.input.isMobileDevice
      ? GAME_CONFIG.camera.mobileLookSensitivity
      : GAME_CONFIG.camera.mouseSensitivity;
    if (snap.pointerLocked) {
      this.cameraYaw -= snap.lookX * sensitivity;
      this.cameraPitch -= snap.lookY * sensitivity;
      this.cameraPitch = Math.max(GAME_CONFIG.camera.minPitch, Math.min(GAME_CONFIG.camera.maxPitch, this.cameraPitch));
    }

    if (snap.weaponSlot !== -1) this.player = this.weapons.switchToSlot(this.player, snap.weaponSlot);
    else if (snap.weaponSwitch !== 0) this.player = this.weapons.switchWeapon(this.player, snap.weaponSwitch);
    if (snap.reload) this.weapons.tryReload(this.player);
    this.player = this.physics.updatePlayer(this.player, snap, dt, this.cameraYaw);

    // ── Compute movement flags for FPV body ──
    // Use horizontal velocity magnitude (ignore Y to ignore gravity/jump)
    const prevX = this.player.position.x;
    const prevZ = this.player.position.z;
    this.horizontalSpeed = Math.hypot(this.player.velocity.x, this.player.velocity.z);
    const isMoving = this.horizontalSpeed > 0.5;
    const isSprinting = !!(snap.sprint && isMoving);
    const isCrouching = !!snap.crouch;
    if (isMoving) {
      // Phase advances proportional to actual ground speed
      this.walkPhase += dt * (isSprinting ? 12.0 : 8.0);
    }
    // Snap previous position to detect first frame (avoid bob snap on respawn)
    void prevX; void prevZ;

    // ── Sync camera to player (eye height + head bob) ──
    const cam = this.renderer.camera;
    const fpv = GAME_CONFIG.fpv;
    const eyeH = fpv.eyeHeight * (isCrouching ? fpv.crouchEyeHeightMul : 1.0);
    const bob = isMoving
      ? this.playerBody.tick({ dt, isMoving, isCrouching, isSprinting, walkPhase: this.walkPhase })
      : this.playerBody.tick({ dt, isMoving: false, isCrouching, isSprinting, walkPhase: this.walkPhase });
    cam.position.set(
      this.player.position.x + bob.bobX,
      this.player.position.y + eyeH + bob.bobY,
      this.player.position.z,
    );
    const euler = new THREE.Euler(this.cameraPitch, this.cameraYaw, 0, 'YXZ');
    cam.quaternion.setFromEuler(euler);

    if (snap.shoot) {
      // ── Empty-click detection: pull on an empty magazine ──
      const currentWp = this.weapons.getCurrentWeapon(this.player);
      if (currentWp && currentWp.currentAmmo <= 0 && !currentWp.isReloading) {
        // Cooldown: at most one click per 0.15s so a held trigger doesn't spam
        const t = now / 1000;
        if (t - this.lastEmptyClickAt > 0.15) {
          this.bus.emit('weaponEmptyClick', { weaponType: this.player.currentWeapon });
          this.lastEmptyClickAt = t;
        }
      } else {
        const fr = this.weapons.tryFire(this.player, now / 1000);
        if (fr) {
          this.weaponRenderer.showMuzzleFlash();
          // Per-weapon recoil feel from config
          const feel = GAME_CONFIG.weaponFeel[fr.weapon.type];
          this.playerBody.addRecoil(feel.kick, feel.sway);
          this.doShoot(fr.damage, fr.spread, fr.range, fr.pellets);
        }
      }
    } else { this.weapons.release(this.player); }

    this.weapons.tickReloads(dt);
    this.updateEnemies(dt, now);
    const tickRes = this.combat.tickInvincibility(this.player, this.enemies, dt);
    this.player = tickRes.player; this.enemies = tickRes.enemies;
    this.player = tickPowerUps(this.player, dt);

    const spawnRes = this.spawner.trySpawnEnemy(this.wave, this.enemies.filter(isEnemyAlive), { x: this.player.position.x, z: this.player.position.z });
    this.wave = spawnRes.wave;
    if (spawnRes.enemy) { this.enemies.push(spawnRes.enemy); this.enemyRenderer.createMesh(spawnRes.enemy); }

    this.wave = tickWave(this.wave, dt, this.enemies.filter(isEnemyAlive).length);

    // Emit wave transition events exactly once per transition
    if (this.wave.phase !== this.prevWavePhase) {
      if (this.wave.phase === 'break' && this.prevWavePhase === 'fighting') {
        this.bus.emit('waveCompleted', { wave: this.wave.waveNumber });
        this.bus.emit('waveBreakStarted', { nextWave: this.wave.waveNumber + 1, duration: GAME_CONFIG.waves.waveBreakDuration });
      }
      this.prevWavePhase = this.wave.phase;
    }
    if (this.wave.waveNumber !== this.prevWaveNumber) {
      this.bus.emit('waveBreakEnded', { wave: this.wave.waveNumber });
      this.prevWaveNumber = this.wave.waveNumber;
      this.bus.emit('waveStarted', { wave: this.wave.waveNumber, enemiesRemaining: this.wave.totalEnemiesThisWave });
    }

    // Keep wave break countdown ticking
    if (this.wave.phase === 'break') {
      this.hud.updateWaveBreak(this.wave.breakTimer);
    }

    this.score = tickCombo(this.score, now / 1000);
    this.handlePowerUpCollection(dt);

    const camPos = this.renderer.camera.position;
    for (const e of this.enemies) { if (isEnemyAlive(e)) this.enemyRenderer.sync(e, camPos); }
    for (const pu of this.powerUps) { if (!pu.collected) this.effects.syncPowerUp(pu, now / 1000); }
    for (const id of this.enemyRenderer.tickDeathAnimations(now)) { this.enemyRenderer.removeMesh(id); }

    // ── Bot AI tick (deathmatch only) ──
    if (this.matchActive) {
      this.tickBots(dt);
      for (const b of this.bots) {
        if (b.isAlive) this.botRenderer.sync(b, dt, camPos);
      }
      for (const id of this.botRenderer.tickDeathAnimations(now)) {
        this.botRenderer.removeMesh(id);
      }
    }

    this.weaponRenderer.tick(now);
    this.effects.tickShake(dt);
    this.killFeed.tick(now);
    this.crosshair.setSpread(Math.abs(snap.moveX) + Math.abs(snap.moveY));
    this.renderer.render();

    // Only schedule next frame while actively playing
    this.animFrameId = requestAnimationFrame(this.loop);
  };

  /**
   * Per-tick update for all bots: build a world snapshot, run AI, sync
   * positions, handle bot-fired shots, handle bot respawns.
   */
  private tickBots(dt: number): void {
    const camPos = this.renderer.camera.position;
    const gunshot = this.lastGunshotAt
      ? { x: this.lastGunshotAt.x, z: this.lastGunshotAt.z, ageSec: (performance.now() - this.lastGunshotAt.t) / 1000 }
      : null;
    const world: BotWorldSnapshot = {
      playerPosition: { x: this.player.position.x, y: 0, z: this.player.position.z },
      playerAlive: this.player.isAlive,
      otherBots: this.bots.map((b) => ({ id: b.id, position: b.position, isAlive: b.isAlive })),
      obstacles: this.obstacles,
      arena: { width: GAME_CONFIG.arena.width, depth: GAME_CONFIG.arena.depth },
      gunshot,
      matchTime: performance.now() / 1000,
    };

    const camForward = new THREE.Vector3();
    this.renderer.camera.getWorldDirection(camForward);
    // playerEyePos
    const playerEye = camPos.clone();

    const updated: BotData[] = [];
    for (const bot of this.bots) {
      const res = tickBot(bot, world, dt);
      let next = res.bot;
      if (res.fired && next.isAlive) {
        // Bot shot — spawn a tracer and check for player hit
        const origin = new THREE.Vector3(next.position.x, 1.5, next.position.z);
        const dir = new THREE.Vector3(res.fireDir.x, 0, res.fireDir.z).normalize();
        const range = GAME_CONFIG.weapons[next.weapon].range;
        const rc = new THREE.Raycaster(origin, dir, 0, range);
        const hits = rc.intersectObjects(this.renderer.scene.children, true);
        let playerHit = false;
        const firstHit = hits[0];
        // Check if any hit is on the player's view (we don't have a player mesh, so test the line vs. a sphere at the camera)
        // Approximate player hit as ray-to-point distance < 0.6 of camera position
        const toCam = playerEye.clone().subVectors(playerEye, origin);
        const proj = toCam.x * dir.x + toCam.y * dir.y + toCam.z * dir.z;
        if (proj > 0 && proj < range) {
          const closest = origin.clone().add(dir.clone().multiplyScalar(proj));
          if (closest.distanceTo(playerEye) < 0.6) playerHit = true;
        }
        const endPoint = firstHit ? firstHit.point : origin.clone().add(dir.clone().multiplyScalar(range));
        this.weaponRenderer.createTrail(origin, endPoint, firstHit != null);
        if (firstHit) this.weaponRenderer.createImpact(firstHit.point, firstHit.face?.normal);
        if (playerHit && this.player.isAlive) {
          // Damage the player
          const dmg = Math.max(5, Math.floor(GAME_CONFIG.weapons[next.weapon].damage * 0.5));
          this.player = this.combat.damagePlayer(this.player, dmg);
          if (this.player.isAlive) {
            this.bus.emit('playerDamaged', {
              amount: dmg,
              currentHealth: this.player.health,
              maxHealth: this.player.maxHealth,
            });
          } else {
            // Player died — award the bot a kill
            next = { ...next, kills: next.kills + 1 };
            this.bus.emit('botKilled', {
              id: 'player', name: 'You', killerId: next.id,
              weaponType: next.weapon, position: { x: this.player.position.x, z: this.player.position.z },
            });
            this.bus.emit('playerDied', {});
          }
        }
      }
      // Handle respawn
      if (!next.isAlive && next.state === 'dead' && next.respawnTimer <= 0) {
        const points = GAME_CONFIG.bots.spawnPoints as unknown as Array<{ x: number; z: number }>;
        // Find a free spawn point (not within 6m of the player or any other live bot)
        let chosen = points[0];
        for (let attempt = 0; attempt < 8; attempt++) {
          const candidate = points[Math.floor(Math.random() * points.length)];
          const distToPlayer = Math.hypot(candidate.x - this.player.position.x, candidate.z - this.player.position.z);
          const tooCloseToBot = this.bots.some((b) => b !== next && b.isAlive
            && Math.hypot(candidate.x - b.position.x, candidate.z - b.position.z) < 6);
          if (distToPlayer > 8 && !tooCloseToBot) { chosen = candidate; break; }
        }
        next = respawnBot(next, chosen);
        this.botRenderer.createMesh(next);
        this.bus.emit('botRespawned', { id: next.id, name: next.name, position: { x: chosen.x, z: chosen.z } });
      }
      // Track pending deaths (the bot just lost all health)
      if (bot.isAlive && !next.isAlive) {
        this.botRenderer.startDeathAnimation(next.id);
        this.bus.emit('botKilled', {
          id: next.id, name: next.name, killerId: 'player',
          weaponType: this.player.currentWeapon,
          position: { x: next.position.x, z: next.position.z },
        });
        // Award the player a kill on the scoreboard
        const kr = addKill(this.score, 100, performance.now() / 1000);
        this.score = kr.state;
        this.hud.updateScore(this.score.score);
      }
      updated.push(next);
    }
    this.bots = updated;
  }

  private updateEnemies(dt: number, now: number): void {
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      if (!isEnemyAlive(e)) continue;
      const dist = PhysicsSystem.horizontalDistance({ x: e.position.x, z: e.position.z }, { x: this.player.position.x, z: this.player.position.z });
      let u = e;
      if (dist <= e.attackRange) {
        const res = this.combat.processEnemyAttack(e, this.player, now / 1000);
        u = res.enemy; this.player = res.player;
      } else if (dist <= e.detectionRange) {
        u = { ...e, state: 'chasing' };
      } else { u = { ...e, state: 'idle' }; }
      this.enemies[i] = this.physics.updateEnemy(u, this.player.position, dt);
    }
  }

  private doShoot(_damage: number, spread: number, range: number, pellets: number): void {
    const cam = this.renderer.camera;
    const baseDir = new THREE.Vector3(); cam.getWorldDirection(baseDir);
    const origin = cam.position.clone(); origin.y -= 0.1;
    for (let p = 0; p < pellets; p++) {
      const dir = baseDir.clone();
      if (spread > 0) { dir.x += (Math.random() - 0.5) * THREE.MathUtils.degToRad(spread); dir.y += (Math.random() - 0.5) * THREE.MathUtils.degToRad(spread); dir.normalize(); }
      const rc = new THREE.Raycaster(cam.position, dir, 0, range);
      const hits = rc.intersectObjects(this.renderer.scene.children, true);
      if (hits.length > 0) {
        const hit = hits[0];
        this.weaponRenderer.createTrail(origin, hit.point, true);
        this.weaponRenderer.createImpact(hit.point, hit.face?.normal);
        let obj: THREE.Object3D | null = hit.object;
        while (obj) {
          if (obj.userData.type === 'enemy') {
            const eid = obj.userData.enemyId as string;
            const enemy = this.enemies.find(e => e.id === eid);
            if (enemy && isEnemyAlive(enemy)) {
              const wp = this.weapons.getCurrentWeapon(this.player)!;
              const res = this.combat.processHit(wp, enemy, this.player);
              this.enemies[this.enemies.indexOf(enemy)] = res.enemy;
              if (res.result.killed) this.enemyRenderer.startDeathAnimation(res.enemy);
            }
            break;
          }
          if (obj.userData.type === 'bot') {
            const bid = obj.userData.botId as string;
            const bot = this.bots.find(b => b.id === bid);
            if (bot && bot.isAlive) {
              const wp = this.weapons.getCurrentWeapon(this.player)!;
              const dmg = GAME_CONFIG.weapons[wp.type].damage;
              const idx = this.bots.indexOf(bot);
              this.bots[idx] = { ...bot, health: Math.max(0, bot.health - dmg) };
              if (this.bots[idx].health <= 0) {
                this.bots[idx] = {
                  ...this.bots[idx],
                  isAlive: false,
                  state: 'dead',
                  respawnTimer: GAME_CONFIG.bots.respawnDelay,
                  deaths: bot.deaths + 1,
                };
              }
              this.bus.emit('botDamaged', {
                id: bot.id, amount: dmg,
                health: this.bots[idx].health, maxHealth: bot.maxHealth,
              });
              this.botRenderer.flashDamage(bot.id);
            }
            break;
          }
          obj = obj.parent;
        }
        // Broadcast the gunshot for the bot AI to hear
        this.lastGunshotAt = { x: hit.point.x, z: hit.point.z, t: performance.now() };
        this.bus.emit('gunshotHeard', { position: { x: hit.point.x, z: hit.point.z }, shooterId: 'player' });
      } else {
        this.weaponRenderer.createTrail(origin, origin.clone().add(dir.clone().multiplyScalar(range)), false);
        this.lastGunshotAt = { x: origin.x, z: origin.z, t: performance.now() };
        this.bus.emit('gunshotHeard', { position: { x: origin.x, z: origin.z }, shooterId: 'player' });
      }
    }
  }

  /**
   * Play a synthesized "empty click" via the Web Audio API.
   * No audio file required — pure oscillator + noise burst.
   */
  private playEmptyClickSfx(): void {
    try {
      const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) return;
      const ctx: AudioContext = this.audioCtx || new Ctx();
      this.audioCtx = ctx;
      if (ctx.state === 'suspended') ctx.resume();

      const now = ctx.currentTime;
      // Click 1: very short noise burst
      const bufferSize = Math.floor(0.05 * ctx.sampleRate);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.1));
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = 2000;
      noise.connect(filter).connect(gain).connect(ctx.destination);
      noise.start(now);
      noise.stop(now + 0.06);

      // Click 2: brief tone for the "click" of the trigger
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.setValueAtTime(900, now);
      const g2 = ctx.createGain();
      g2.gain.setValueAtTime(0.08, now);
      g2.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
      osc.connect(g2).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.05);
    } catch {
      // Audio not available; fail silently.
    }
  }

  private handlePowerUpCollection(dt: number): void {
    const pp = this.player.position;
    for (let i = 0; i < this.powerUps.length; i++) {
      const pu = this.powerUps[i];
      if (pu.collected) continue;
      if (PhysicsSystem.distance(pp, pu.position) < 1.5) {
        switch (pu.type) {
          case 'healthPack': {
            const c = getPowerUpConfig('healthPack') as { healAmount: number };
            this.player = this.combat.healPlayer(this.player, c.healAmount);
            break;
          }
          case 'ammoPack': {
            const c = getPowerUpConfig('ammoPack') as { ammoAmount: number };
            this.weapons.addAmmo(this.player.currentWeapon, c.ammoAmount);
            break;
          }
          case 'speedBoost': {
            const c = getPowerUpConfig('speedBoost') as { multiplier: number; duration: number };
            this.player = addPowerUp(this.player, 'speedBoost', c.multiplier, c.duration);
            break;
          }
          case 'damageBoost': {
            const c = getPowerUpConfig('damageBoost') as { multiplier: number; duration: number };
            this.player = addPowerUp(this.player, 'damageBoost', c.multiplier, c.duration);
            break;
          }
        }
        this.powerUps[i] = { ...pu, collected: true };
        this.effects.removePowerUpMesh(pu.id);
        this.bus.emit('powerUpCollected', { id: pu.id, type: pu.type });
      }
    }
    // Tick lifetime with actual dt, then remove expired/collected entries
    this.powerUps = this.powerUps
      .map(p => p.collected ? p : tickPowerUpLifetime(p, dt))
      .filter(p => {
        if (isPowerUpExpired(p)) { this.effects.removePowerUpMesh(p.id); return false; }
        return true;
      });
  }

  dispose(): void {
    cancelAnimationFrame(this.animFrameId);
    this.input.detach(); this.bus.clear();
    this.renderer.dispose(); this.sceneBuilder.dispose(); this.skybox.dispose();
    this.enemyRenderer.dispose(); this.weaponRenderer.dispose();
    this.playerBody.dispose();
    this.botRenderer.dispose();
    this.effects.dispose();
    this.hud.dispose(); this.crosshair.dispose(); this.startScreen.dispose();
    this.gameOverScreen.dispose(); this.pauseScreen.dispose(); this.killFeed.dispose();
    this.joystick.dispose(); this.lookController.dispose(); this.actionButtons.dispose();
  }
}
