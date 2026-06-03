import { describe, it, expect } from 'vitest';
import { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/GameEvents';
import { CombatSystem } from '../systems/CombatSystem';
import { createPlayer } from '../models/Player';
import { createEnemy } from '../models/Enemy';
import { createWeapon } from '../models/Weapon';

describe('CombatSystem', () => {
  /* ── Player damage ── */
  it('damages player', () => {
    const bus = new EventBus<GameEvents>();
    const cs = new CombatSystem(bus);
    const p = createPlayer();
    const r = cs.damagePlayer(p, 20);
    expect(r.health).toBe(80);
    expect(r.isAlive).toBe(true);
  });

  it('emits playerDamaged event', () => {
    const bus = new EventBus<GameEvents>();
    const cs = new CombatSystem(bus);
    let emitted = false;
    bus.on('playerDamaged', (d) => {
      expect(d.amount).toBe(20);
      expect(d.currentHealth).toBe(80);
      emitted = true;
    });
    cs.damagePlayer(createPlayer(), 20);
    expect(emitted).toBe(true);
  });

  it('emits playerDied on lethal damage', () => {
    const bus = new EventBus<GameEvents>();
    const cs = new CombatSystem(bus);
    let died = false;
    bus.on('playerDied', () => { died = true; });
    cs.damagePlayer(createPlayer(), 100);
    expect(died).toBe(true);
  });

  it('does not damage invincible player', () => {
    const bus = new EventBus<GameEvents>();
    const cs = new CombatSystem(bus);
    let p = createPlayer();
    p = cs.damagePlayer(p, 10);
    expect(p.isInvincible).toBe(true);
    const r = cs.damagePlayer(p, 50);
    expect(r.health).toBe(90);
  });

  it('does not damage dead player', () => {
    const bus = new EventBus<GameEvents>();
    const cs = new CombatSystem(bus);
    let p = createPlayer();
    p = cs.damagePlayer(p, 100);
    const r = cs.damagePlayer(p, 50);
    expect(r.health).toBe(0);
  });

  /* ── Player healing ── */
  it('heals player', () => {
    const bus = new EventBus<GameEvents>();
    const cs = new CombatSystem(bus);
    let p = createPlayer();
    p = cs.damagePlayer(p, 50);
    p = cs.healPlayer(p, 20);
    expect(p.health).toBe(70);
  });

  it('emits playerHealed event', () => {
    const bus = new EventBus<GameEvents>();
    const cs = new CombatSystem(bus);
    let emitted = false;
    bus.on('playerHealed', (d) => {
      expect(d.amount).toBe(20);
      emitted = true;
    });
    let p = createPlayer();
    p = cs.damagePlayer(p, 50);
    cs.healPlayer(p, 20);
    expect(emitted).toBe(true);
  });

  it('does not emit heal when already full', () => {
    const bus = new EventBus<GameEvents>();
    const cs = new CombatSystem(bus);
    let emitted = false;
    bus.on('playerHealed', () => { emitted = true; });
    cs.healPlayer(createPlayer(), 20);
    expect(emitted).toBe(false);
  });

  /* ── Process hit (weapon → enemy) ── */
  it('processes hit on enemy', () => {
    const bus = new EventBus<GameEvents>();
    const cs = new CombatSystem(bus);
    const weapon = createWeapon('PISTOL');
    const enemy = createEnemy('GRUNT', { x: 0, y: 0, z: 0 });
    const player = createPlayer();
    const result = cs.processHit(weapon, enemy, player);
    expect(result.result.hit).toBe(true);
    expect(result.enemy.health).toBe(25);
    expect(result.result.killed).toBe(false);
  });

  it('kills enemy on lethal hit', () => {
    const bus = new EventBus<GameEvents>();
    const cs = new CombatSystem(bus);
    const weapon = createWeapon('PISTOL');
    const enemy = createEnemy('GRUNT', { x: 0, y: 0, z: 0 });
    const player = createPlayer();
    const r1 = cs.processHit(weapon, enemy, player);
    const r2 = cs.processHit(weapon, r1.enemy, player);
    expect(r2.result.killed).toBe(true);
    expect(r2.enemy.state).toBe('dead');
  });

  it('emits enemyDamaged event', () => {
    const bus = new EventBus<GameEvents>();
    const cs = new CombatSystem(bus);
    let emitted = false;
    bus.on('enemyDamaged', (d) => {
      expect(d.id).toBeDefined();
      expect(d.amount).toBe(25);
      emitted = true;
    });
    const weapon = createWeapon('PISTOL');
    const enemy = createEnemy('GRUNT', { x: 0, y: 0, z: 0 });
    cs.processHit(weapon, enemy, createPlayer());
    expect(emitted).toBe(true);
  });

  it('emits enemyKilled event', () => {
    const bus = new EventBus<GameEvents>();
    const cs = new CombatSystem(bus);
    let killed = false;
    bus.on('enemyKilled', (d) => {
      expect(d.type).toBe('GRUNT');
      expect(d.points).toBe(100);
      killed = true;
    });
    const weapon = createWeapon('PISTOL');
    const enemy = createEnemy('GRUNT', { x: 0, y: 0, z: 0 });
    const player = createPlayer();
    const r1 = cs.processHit(weapon, enemy, player);
    cs.processHit(weapon, r1.enemy, player);
    expect(killed).toBe(true);
  });

  it('does not process hit on dead enemy', () => {
    const bus = new EventBus<GameEvents>();
    const cs = new CombatSystem(bus);
    const weapon = createWeapon('PISTOL');
    const enemy = createEnemy('GRUNT', { x: 0, y: 0, z: 0 });
    const player = createPlayer();
    const r1 = cs.processHit(weapon, enemy, player);
    const r2 = cs.processHit(weapon, r1.enemy, player);
    const r3 = cs.processHit(weapon, r2.enemy, player);
    expect(r3.result.hit).toBe(false);
    expect(r3.result.killed).toBe(false);
  });

  it('damage boost multiplies hit damage', () => {
    const bus = new EventBus<GameEvents>();
    const cs = new CombatSystem(bus);
    const weapon = createWeapon('PISTOL');
    const enemy = createEnemy('GRUNT', { x: 0, y: 0, z: 0 });
    let player = createPlayer();
    player = { ...player, activePowerUps: [{ type: 'damageBoost', multiplier: 2, remainingTime: 5 }] };
    const result = cs.processHit(weapon, enemy, player);
    expect(result.enemy.health).toBe(0);
    expect(result.result.killed).toBe(true);
  });

  /* ── Enemy attack ── */
  it('enemy attacks player', () => {
    const bus = new EventBus<GameEvents>();
    const cs = new CombatSystem(bus);
    const enemy = createEnemy('GRUNT', { x: 0, y: 0, z: 0 });
    const player = createPlayer();
    const result = cs.processEnemyAttack(enemy, player, 10);
    expect(result.attacked).toBe(true);
    expect(result.player.health).toBe(90);
  });

  it('respects attack cooldown', () => {
    const bus = new EventBus<GameEvents>();
    const cs = new CombatSystem(bus);
    const enemy = createEnemy('GRUNT', { x: 0, y: 0, z: 0 });
    const player = createPlayer();
    const r1 = cs.processEnemyAttack(enemy, player, 10);
    const r2 = cs.processEnemyAttack(r1.enemy, player, 10);
    expect(r2.attacked).toBe(false);
  });

  it('attack after cooldown works', () => {
    const bus = new EventBus<GameEvents>();
    const cs = new CombatSystem(bus);
    const enemy = createEnemy('GRUNT', { x: 0, y: 0, z: 0 });
    const player = createPlayer();
    const r1 = cs.processEnemyAttack(enemy, player, 10);
    const r2 = cs.processEnemyAttack(r1.enemy, player, 12);
    expect(r2.attacked).toBe(true);
  });

  it('dead enemy does not attack', () => {
    const bus = new EventBus<GameEvents>();
    const cs = new CombatSystem(bus);
    const enemy = { ...createEnemy('GRUNT', { x: 0, y: 0, z: 0 }), state: 'dead' as const };
    const player = createPlayer();
    const result = cs.processEnemyAttack(enemy, player, 10);
    expect(result.attacked).toBe(false);
  });

  it('emits enemyAttack event', () => {
    const bus = new EventBus<GameEvents>();
    const cs = new CombatSystem(bus);
    let emitted = false;
    bus.on('enemyAttack', (d) => {
      expect(d.damage).toBe(10);
      emitted = true;
    });
    const enemy = createEnemy('GRUNT', { x: 0, y: 0, z: 0 });
    cs.processEnemyAttack(enemy, createPlayer(), 10);
    expect(emitted).toBe(true);
  });

  /* ── Tick invincibility ── */
  it('ticks player invincibility', () => {
    const bus = new EventBus<GameEvents>();
    const cs = new CombatSystem(bus);
    let player = createPlayer();
    player = cs.damagePlayer(player, 10);
    expect(player.isInvincible).toBe(true);
    const result = cs.tickInvincibility(player, [], 0.6);
    expect(result.player.isInvincible).toBe(false);
  });

  it('ticks enemy invincibility', () => {
    const bus = new EventBus<GameEvents>();
    const cs = new CombatSystem(bus);
    const weapon = createWeapon('PISTOL');
    let enemy = createEnemy('GRUNT', { x: 0, y: 0, z: 0 });
    const hit = cs.processHit(weapon, enemy, createPlayer());
    enemy = hit.enemy;
    expect(enemy.invincibilityTimer).toBeGreaterThan(0);
    const result = cs.tickInvincibility(createPlayer(), [enemy], 0.1);
    expect(result.enemies[0].invincibilityTimer).toBe(0);
  });
});
