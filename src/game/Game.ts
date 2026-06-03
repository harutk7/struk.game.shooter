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
import { createPlayer, tickInvincibility, tickPowerUps, addPowerUp } from '../models/Player';
import type { EnemyData } from '../models/Enemy';
import { isEnemyAlive } from '../models/Enemy';
import type { PowerUpData } from '../models/PowerUp';
import { tickPowerUpLifetime, isPowerUpExpired, getPowerUpConfig } from '../models/PowerUp';
import type { ScoreState } from '../models/ScoreManager';
import { createScoreState, addKill, tickCombo } from '../models/ScoreManager';
import type { WaveState } from '../models/WaveManager';
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
  private powerUps: PowerUpData[] = [];
  private score: ScoreState;
  private wave: WaveState;
  private animFrameId = 0;
  private lastTime = 0;
  private cameraYaw = 0;
  private cameraPitch = 0;

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
    this.skybox = new Skybox(this.renderer.scene);
    this.enemyRenderer = new EnemyRenderer(this.renderer.scene);
    this.weaponRenderer = new WeaponRenderer(this.renderer.scene, this.renderer.camera);
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
    this.bus.on('weaponReloadStart', () => this.hud.showReloading(true));
    this.bus.on('weaponReloadEnd', () => this.hud.showReloading(false));
    this.bus.on('weaponSwitched', (d) => this.hud.updateWeapon(getWeaponConfig(d.to).name));
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
    this.bus.on('waveStarted', (d) => this.hud.updateWave(d.wave));
    this.bus.on('waveCompleted', (d) => this.hud.updateWave(d.wave + 1));
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
    this.hud.updateHealth(this.player.health, this.player.maxHealth);
    this.hud.updateScore(0);
    this.hud.updateWave(1);
    this.hud.updateWeapon('Pistol');
    this.weapons.initWeapons(this.player.ownedWeapons);
    const wp = this.weapons.getCurrentWeapon(this.player);
    if (wp) this.hud.updateAmmo(wp.currentAmmo, wp.reserveAmmo);
    if (this.input.isMobileDevice) {
      this.joystick.show(); this.lookController.show(); this.actionButtons.show();
    }
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
  }

  private restartGame(): void {
    this.player = createPlayer();
    this.enemies = []; this.powerUps = [];
    this.score = createScoreState(); this.wave = createWaveState();
    this.enemyRenderer.clear(); this.effects.clearPowerUps(); this.weapons.reset();
    this.gameOverScreen.hide();
    this.startGame();
  }

  private resumeGame(): void {
    this.state.transition('PLAYING');
    this.pauseScreen.hide(); this.input.lockPointer();
    this.lastTime = performance.now(); this.loop();
  }

  private quitToMenu(): void {
    this.state.transition('MENU');
    this.pauseScreen.hide(); this.input.unlockPointer();
    this.crosshair.hide(); this.hud.hide(); this.startScreen.show();
    this.player = createPlayer();
    this.enemies = []; this.powerUps = [];
    this.score = createScoreState(); this.wave = createWaveState();
    this.enemyRenderer.clear(); this.effects.clearPowerUps(); this.weapons.reset();
  }

  private loop = (): void => {
    this.animFrameId = requestAnimationFrame(this.loop);
    const now = performance.now();
    const dt = Math.min((now - this.lastTime) / 1000, 0.1);
    this.lastTime = now;
    const snap = this.input.poll();

    if (this.input.isMobileDevice) {
      const joy = this.joystick.getState();
      const acts = this.actionButtons.getState();
      this.input.setMobileInput({ moveX: joy.x, moveY: joy.y, shoot: acts.shoot, jump: acts.jump, reload: acts.reload });
    }

    if (snap.pause && this.state.isPlaying) {
      this.state.transition('PAUSED');
      this.pauseScreen.show(); this.input.unlockPointer();
      return;
    }
    if (!this.state.isPlaying) return;

    // ── Camera rotation (mouse look) ──
    if (snap.pointerLocked) {
      this.cameraYaw -= snap.lookX * GAME_CONFIG.camera.mouseSensitivity;
      this.cameraPitch -= snap.lookY * GAME_CONFIG.camera.mouseSensitivity;
      this.cameraPitch = Math.max(GAME_CONFIG.camera.minPitch, Math.min(GAME_CONFIG.camera.maxPitch, this.cameraPitch));
    }

    if (snap.weaponSwitch !== 0) this.player = this.weapons.switchWeapon(this.player, snap.weaponSwitch);
    if (snap.reload) this.weapons.tryReload(this.player);
    this.player = this.physics.updatePlayer(this.player, snap, dt, this.cameraYaw);

    // ── Sync camera to player ──
    const cam = this.renderer.camera;
    cam.position.set(this.player.position.x, this.player.position.y, this.player.position.z);
    const euler = new THREE.Euler(this.cameraPitch, this.cameraYaw, 0, 'YXZ');
    cam.quaternion.setFromEuler(euler);

    if (snap.shoot) {
      const fr = this.weapons.tryFire(this.player, now / 1000);
      if (fr) { this.weaponRenderer.showMuzzleFlash(); this.doShoot(fr.damage, fr.spread, fr.range, fr.pellets); }
    } else { this.weapons.release(this.player); }

    this.weapons.tickReloads(dt);
    this.updateEnemies(dt, now);
    const tickRes = this.combat.tickInvincibility(this.player, this.enemies, dt);
    this.player = tickRes.player; this.enemies = tickRes.enemies;
    this.player = tickPowerUps(this.player, dt);
    this.player = tickInvincibility(this.player, dt);

    const spawnRes = this.spawner.trySpawnEnemy(this.wave, this.enemies.filter(isEnemyAlive), { x: this.player.position.x, z: this.player.position.z });
    this.wave = spawnRes.wave;
    if (spawnRes.enemy) { this.enemies.push(spawnRes.enemy); this.enemyRenderer.createMesh(spawnRes.enemy); }

    this.wave = tickWave(this.wave, dt, this.enemies.filter(isEnemyAlive).length);
    if (this.wave.phase === 'spawning' && this.wave.enemiesSpawned === 0 && this.wave.spawnTimer <= 0) {
      this.bus.emit('waveStarted', { wave: this.wave.waveNumber, enemiesRemaining: this.wave.totalEnemiesThisWave });
    }
    this.score = tickCombo(this.score, now / 1000);
    this.handlePowerUpCollection();

    const camPos = this.renderer.camera.position;
    for (const e of this.enemies) { if (isEnemyAlive(e)) this.enemyRenderer.sync(e, camPos); }
    for (const pu of this.powerUps) { if (!pu.collected) this.effects.syncPowerUp(pu, now / 1000); }
    for (const id of this.enemyRenderer.tickDeathAnimations(now)) { this.enemyRenderer.removeMesh(id); }

    this.weaponRenderer.tick(now);
    this.effects.tickShake(dt);
    this.killFeed.tick(now);
    this.crosshair.setSpread(Math.abs(snap.moveX) + Math.abs(snap.moveY));
    this.renderer.render();
  };

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
          obj = obj.parent;
        }
      } else {
        this.weaponRenderer.createTrail(origin, origin.clone().add(dir.clone().multiplyScalar(range)), false);
      }
    }
  }

  private handlePowerUpCollection(): void {
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
    this.powerUps = this.powerUps.filter(p => {
      const u = tickPowerUpLifetime(p, 0);
      if (isPowerUpExpired(u)) { this.effects.removePowerUpMesh(p.id); return false; }
      return true;
    });
  }

  dispose(): void {
    cancelAnimationFrame(this.animFrameId);
    this.input.detach(); this.bus.clear();
    this.renderer.dispose(); this.sceneBuilder.dispose(); this.skybox.dispose();
    this.enemyRenderer.dispose(); this.weaponRenderer.dispose(); this.effects.dispose();
    this.hud.dispose(); this.crosshair.dispose(); this.startScreen.dispose();
    this.gameOverScreen.dispose(); this.pauseScreen.dispose(); this.killFeed.dispose();
    this.joystick.dispose(); this.lookController.dispose(); this.actionButtons.dispose();
  }
}
