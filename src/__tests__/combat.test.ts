import { describe, it, expect } from 'vitest';
import { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/GameEvents';
import { CombatSystem } from '../systems/CombatSystem';
import { createPlayer } from '../models/Player';
import { createEnemy } from '../models/Enemy';
import { createWeapon } from '../models/Weapon';

describe('CombatSystem', () => {
  it('damages player and emits event', () => {
    const bus = new EventBus<GameEvents>();
    const cs = new CombatSystem(bus);
    let damaged = false;
    bus.on('playerDamaged', () => { damaged = true; });
    const p = createPlayer();
    cs.damagePlayer(p, 20);
    expect(damaged).toBe(true);
  });

  it('heals player', () => {
    const bus = new EventBus<GameEvents>();
    const cs = new CombatSystem(bus);
    let p = createPlayer();
    p = cs.damagePlayer(p, 50);
    p = cs.healPlayer(p, 20);
    expect(p.health).toBe(70);
  });

  it('processes hit on enemy', () => {
    const bus = new EventBus<GameEvents>();
    const cs = new CombatSystem(bus);
    const weapon = createWeapon('PISTOL');
    const enemy = createEnemy('GRUNT', { x: 0, y: 0, z: 0 });
    const player = createPlayer();
    const result = cs.processHit(weapon, enemy, player);
    expect(result.result.hit).toBe(true);
    expect(result.enemy.health).toBe(25);
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

  it('enemy attacks player', () => {
    const bus = new EventBus<GameEvents>();
    const cs = new CombatSystem(bus);
    const enemy = createEnemy('GRUNT', { x: 0, y: 0, z: 0 });
    let player = createPlayer();
    const result = cs.processEnemyAttack(enemy, player, 10);
    expect(result.attacked).toBe(true);
    expect(result.player.health).toBeLessThan(100);
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

  it('ticks invincibility', () => {
    const bus = new EventBus<GameEvents>();
    const cs = new CombatSystem(bus);
    let player = createPlayer();
    player = cs.damagePlayer(player, 10);
    expect(player.isInvincible).toBe(true);
    const result = cs.tickInvincibility(player, [], 0.6);
    expect(result.player.isInvincible).toBe(false);
  });
});
