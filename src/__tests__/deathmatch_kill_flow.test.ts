/**
 * HARDENING (T21) — deathmatch kill-flow regression tests.
 *
 * These lock in the behavior the game-stops-on-first-kill bug broke:
 *   1. Killing N bots keeps the match IN_PROGRESS (active).
 *   2. The match only transitions to GAME_OVER (finished) once a competitor
 *      reaches scoreLimit — not before.
 *   3. A killed bot actually respawns after respawnDelay seconds: it comes back
 *      into the world alive, at full health, in a non-dead state.
 *
 * Like repro_game_stops_on_kill.test.ts, these drive the REAL domain modules
 * (createBot, tickBot, respawnBot, EventBus, MatchManager) rather than the
 * Game class, which needs a live WebGL/DOM context unavailable under vitest.
 * They mirror the FIXED Game flow: doShoot() registers the kill at the moment
 * of death; tickBots() handles respawn when respawnTimer hits 0.
 */

import { describe, it, expect } from 'vitest';
import { createBot, respawnBot, _resetBotIds, type BotData } from '../models/Bot';
import { tickBot, type BotWorldSnapshot } from '../systems/BotAI';
import { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/GameEvents';
import {
  createMatchState,
  registerKillEvent,
  type MatchState,
} from '../models/MatchManager';
import { GAME_CONFIG } from '../core/GameConfig';

/** Wire a match + a botKilled handler exactly as Game.wireEvents() does. */
function makeMatch(bots: BotData[]) {
  const bus = new EventBus<GameEvents>();
  let match: MatchState = createMatchState(
    'player',
    'You',
    0xffaa00,
    bots.map((b) => ({ id: b.id, name: b.name, color: b.color })),
  );
  let botKilledCount = 0;
  bus.on('botKilled', (d) => {
    botKilledCount++;
    match = registerKillEvent(match, d.killerId, d.id);
  });
  return {
    bus,
    get match() { return match; },
    get botKilledCount() { return botKilledCount; },
  };
}

/** Emit the botKilled the way the fixed doShoot() does at the moment of death. */
function killBot(bus: EventBus<GameEvents>, bot: BotData): void {
  bus.emit('botKilled', {
    id: bot.id,
    name: bot.name,
    killerId: 'player',
    weaponType: 'RIFLE',
    position: { x: bot.position.x, z: bot.position.z },
  });
}

const PLAYER = (m: MatchState) => m.players.find((p) => p.isPlayer)!;

describe('T21 — killing N bots keeps the match active', () => {
  for (const n of [3, 5]) {
    it(`stays IN_PROGRESS (active) after the player kills ${n} bots`, () => {
      _resetBotIds();
      const bots = Array.from({ length: n }, (_, i) => createBot(i, { x: i * 4, z: i * 4 }));
      const ctx = makeMatch(bots);

      for (const b of bots) killBot(ctx.bus, b);

      // N < scoreLimit (20), so the match must still be live.
      expect(n).toBeLessThan(GAME_CONFIG.match.scoreLimit);
      expect(ctx.botKilledCount).toBe(n);
      expect(PLAYER(ctx.match).kills).toBe(n);
      expect(ctx.match.phase, `match must stay active after ${n} kills`).toBe('active');
    });
  }
});

describe('T21 — match ends only at scoreLimit', () => {
  it('stays active up to scoreLimit-1, then transitions to finished at scoreLimit', () => {
    _resetBotIds();
    const limit = GAME_CONFIG.match.scoreLimit;
    const bot = createBot(0, { x: 8, z: 8 });
    const ctx = makeMatch([bot]);

    // Score one kill short of the limit — still active the whole way.
    for (let i = 0; i < limit - 1; i++) {
      killBot(ctx.bus, bot);
      expect(ctx.match.phase, `still active at ${i + 1}/${limit} kills`).toBe('active');
    }
    expect(PLAYER(ctx.match).kills).toBe(limit - 1);

    // The kill that reaches scoreLimit ends the match, with the player as winner.
    killBot(ctx.bus, bot);
    expect(PLAYER(ctx.match).kills).toBe(limit);
    expect(ctx.match.phase, 'match must finish exactly at scoreLimit').toBe('finished');
    expect(ctx.match.winnerId).toBe('player');
  });
});

describe('T21 — a killed bot respawns after respawnDelay', () => {
  it('comes back alive at full health once respawnTimer elapses', () => {
    _resetBotIds();
    const delay = GAME_CONFIG.bots.respawnDelay;
    const bot = createBot(0, { x: 8, z: 8 });

    // doShoot() flips the bot dead and arms the respawn timer.
    let dead: BotData = {
      ...bot,
      health: 0,
      isAlive: false,
      state: 'dead',
      respawnTimer: delay,
      deaths: bot.deaths + 1,
    };

    const world: BotWorldSnapshot = {
      playerPosition: { x: 0, y: 0, z: 0 },
      playerAlive: true,
      otherBots: [],
      obstacles: [],
      arena: { width: GAME_CONFIG.arena.width, depth: GAME_CONFIG.arena.depth },
      gunshot: null,
      matchTime: 1,
    };

    // Tick the dead bot frame-by-frame until the respawn timer drains.
    const dt = 1 / 60;
    let ticks = 0;
    const maxTicks = Math.ceil((delay + 1) / dt);
    while (dead.respawnTimer > 0 && ticks < maxTicks) {
      dead = tickBot(dead, world, dt).bot;
      ticks++;
      // Still dead while the timer is counting down.
      if (dead.respawnTimer > 0) {
        expect(dead.isAlive, 'bot must remain dead until respawnTimer hits 0').toBe(false);
      }
    }
    expect(dead.respawnTimer).toBeLessThanOrEqual(0);
    // Roughly delay/dt ticks should have elapsed (sanity on the timer rate).
    expect(ticks).toBeGreaterThanOrEqual(Math.floor(delay / dt));

    // Game.tickBots() performs the actual respawn at a free spawn point.
    const spawn = (GAME_CONFIG.bots.spawnPoints as unknown as Array<{ x: number; z: number }>)[0];
    const respawned = respawnBot(dead, spawn);

    expect(respawned.isAlive, 'respawned bot must be alive').toBe(true);
    expect(respawned.state).not.toBe('dead');
    expect(respawned.health).toBe(respawned.maxHealth);
    expect(respawned.respawnTimer).toBe(0);
    expect(respawned.position.x).toBe(spawn.x);
    expect(respawned.position.z).toBe(spawn.z);
    // Death tally from the prior life is preserved across respawn.
    expect(respawned.deaths).toBe(bot.deaths + 1);
  });
});
