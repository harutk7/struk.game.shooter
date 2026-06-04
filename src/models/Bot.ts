/**
 * Bot (AI opponent) model — pure data, no rendering, no behavior logic.
 * Behavior lives in systems/BotAI.ts; rendering in rendering/BotRenderer.ts.
 *
 * Bot FSM states:
 *   idle      — standing still or patrolling
 *   patrol    — walking between random waypoints
 *   investigate — moving toward last known noise (gunshot) origin
 *   engage    — actively shooting at a visible enemy
 *   cover     — moving to a cover spot while shooting
 *   reload    — playing reload, can't fire
 *   dead      — waiting to respawn (deathmatch only)
 */

import { GAME_CONFIG } from '../core/GameConfig';
import type { WeaponType } from './Weapon';

export type BotState =
  | 'idle'
  | 'patrol'
  | 'investigate'
  | 'engage'
  | 'cover'
  | 'reload'
  | 'dead';

export type BotDifficulty = 'easy' | 'normal' | 'hard';

export interface BotData {
  id: string;
  name: string;
  color: number;
  difficulty: BotDifficulty;

  /** Current position on the XZ plane (Y is foot height; body center = Y + height/2). */
  position: { x: number; y: number; z: number };
  /** Current facing yaw in radians. */
  yaw: number;
  /** Current velocity in m/s. */
  velocity: { x: number; z: number };

  health: number;
  maxHealth: number;
  isAlive: boolean;

  weapon: WeaponType;
  ammo: number;
  reserve: number;
  isReloading: boolean;
  reloadTimer: number;

  /** Current FSM state. */
  state: BotState;
  /** Time the bot has been in the current state (seconds). */
  stateTimer: number;

  /** Current target waypoint (patrol) or cover spot. */
  target: { x: number; z: number } | null;
  /** Last known enemy position (from sight or hearing). */
  lastKnownEnemyPos: { x: number; z: number } | null;
  /** The enemy the bot is currently engaging (id; null = none). */
  targetEnemyId: string | null;

  /** Patrol/waypoint pick timer. */
  waypointTimer: number;

  /** Scoring: kills / deaths / assists. */
  kills: number;
  deaths: number;
  assists: number;

  /** Deathmatch respawn timer (counts down while state=='dead'). */
  respawnTimer: number;

  /** Reaction time accumulator — random delay before pulling the trigger. */
  shotPendingTimer: number;

  /** Move direction for strafe while engaging. */
  strafeDir: -1 | 0 | 1;
  strafeTimer: number;
}

let _nextBotId = 1;
export function nextBotId(): string {
  return `bot_${_nextBotId++}`;
}

/** Reset id counter (for tests). */
export function _resetBotIds(): void {
  _nextBotId = 1;
}

const NAMES = GAME_CONFIG.bots.names;
const COLORS = GAME_CONFIG.bots.colors;
const DIFFICULTIES: BotDifficulty[] = ['easy', 'normal', 'hard'];

/** Procedurally assign a name + color + difficulty for index n. */
export function pickBotIdentity(n: number): { name: string; color: number; difficulty: BotDifficulty } {
  return {
    name: NAMES[n % NAMES.length],
    color: COLORS[n % COLORS.length],
    difficulty: DIFFICULTIES[n % DIFFICULTIES.length],
  };
}

export function createBot(index: number, spawn: { x: number; z: number }): BotData {
  const id = nextBotId();
  const { name, color, difficulty } = pickBotIdentity(index);
  return {
    id,
    name,
    color,
    difficulty,
    position: { x: spawn.x, y: 0, z: spawn.z },
    yaw: Math.random() * Math.PI * 2,
    velocity: { x: 0, z: 0 },
    health: 100,
    maxHealth: 100,
    isAlive: true,
    weapon: index % 2 === 0 ? 'RIFLE' : 'PISTOL',
    ammo: index % 2 === 0 ? 30 : 12,
    reserve: index % 2 === 0 ? 90 : 48,
    isReloading: false,
    reloadTimer: 0,
    state: 'patrol',
    stateTimer: 0,
    target: null,
    lastKnownEnemyPos: null,
    targetEnemyId: null,
    waypointTimer: 0,
    kills: 0,
    deaths: 0,
    assists: 0,
    respawnTimer: 0,
    shotPendingTimer: 0,
    strafeDir: 0,
    strafeTimer: 0,
  };
}

export function isBotAlive(b: BotData): boolean {
  return b.isAlive && b.state !== 'dead';
}

export function damageBot(bot: BotData, amount: number): BotData {
  if (!bot.isAlive) return bot;
  const newHealth = Math.max(0, bot.health - amount);
  return {
    ...bot,
    health: newHealth,
    isAlive: newHealth > 0,
  };
}

export function respawnBot(bot: BotData, spawn: { x: number; z: number }): BotData {
  return {
    ...bot,
    position: { x: spawn.x, y: 0, z: spawn.z },
    yaw: Math.random() * Math.PI * 2,
    velocity: { x: 0, z: 0 },
    health: bot.maxHealth,
    isAlive: true,
    ammo: bot.weapon === 'RIFLE' ? 30 : 12,
    reserve: bot.weapon === 'RIFLE' ? 90 : 48,
    isReloading: false,
    reloadTimer: 0,
    state: 'patrol',
    stateTimer: 0,
    target: null,
    lastKnownEnemyPos: null,
    targetEnemyId: null,
    waypointTimer: 0,
    shotPendingTimer: 0,
    strafeDir: 0,
    strafeTimer: 0,
    respawnTimer: 0,
  };
}
