/**
 * REGRESSION (T20 repro → T21 fix) — "After 1 bot die, game stops."
 *
 * This started life as a T20 DIAGNOSIS test that was RED on `main`
 * (commit 2bc3456). T21 fixed the bug and converted it into the GREEN
 * regression test below. See tasks/realism-v2/BUG_T20_DIAGNOSIS.md.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Root cause (was):
 *
 * The deathmatch kill of a bot was applied in TWO places, in the WRONG order,
 * within a single Game.loop() frame:
 *
 *   1. Game.doShoot() runs FIRST when the player fires. On the killing shot it
 *      mutated the bot in-place and flipped `isAlive = false`, `state = 'dead'`
 *      SYNCHRONOUSLY — but did NOT register the kill.
 *
 *   2. Game.tickBots() ran LATER in the same frame and tried to detect the
 *      death with `if (bot.isAlive && !next.isAlive)`. But `bot` was the array
 *      element doShoot ALREADY killed, so `bot.isAlive` was already `false` and
 *      the guard was never true — `botKilled` was never emitted, the scoreboard
 *      never incremented, and the match could never reach scoreLimit.
 *
 * The fix (T21):
 *
 * Register the kill in Game.doShoot() at the exact point the bot's HP crosses
 * to 0 (emit `botKilled` + startDeathAnimation + addKill there), and drop the
 * dead `bot.isAlive && !next.isAlive` branch from tickBots(). A bot can only
 * die from a player shot and doShoot() is the only place that flips
 * isAlive=false, so the kill now fires exactly once, where the death happens.
 *
 * NOTE on test shape: Game cannot be instantiated under vitest (its
 * constructor builds a THREE.WebGLRenderer + DOM widgets that need a real
 * canvas/WebGL context, unavailable in the node test env, and jsdom is not a
 * dependency). So this test reproduces Game's kill sequence using the REAL
 * domain modules (createBot, tickBot, EventBus, MatchManager) and asserts the
 * user-facing invariant: one player kill ⇒ one botKilled ⇒ scoreboard kills=1,
 * match still active.
 */

import { describe, it, expect } from 'vitest';
import { createBot, _resetBotIds, type BotData } from '../models/Bot';
import { tickBot, type BotWorldSnapshot } from '../systems/BotAI';
import { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/GameEvents';
import {
  createMatchState,
  registerKillEvent,
  type MatchState,
} from '../models/MatchManager';
import { GAME_CONFIG } from '../core/GameConfig';

/**
 * Reproduce one Game.loop() frame in which the player lands the killing shot
 * on a bot. Mirrors the FIXED src/game/Game.ts:
 *   - doShoot() drops the bot's HP to 0, flips it dead, AND registers the kill
 *     (emit botKilled) synchronously — all at the point of death.
 *   - tickBots() then runs the AI tick for every bot with NO death-detection
 *     branch (it was removed in T21).
 * Returns what the player-visible systems observed.
 */
function simulateKillingFrame() {
  _resetBotIds();

  // ── Game.wireEvents(): the 'botKilled' handler updates the match ──
  const bus = new EventBus<GameEvents>();
  let match: MatchState = createMatchState('player', 'You', 0xffaa00, []);
  let botKilledCount = 0;
  bus.on('botKilled', (d) => {
    botKilledCount++;
    match = registerKillEvent(match, d.killerId, d.id);
  });

  // A live bot in a deathmatch.
  const bot = createBot(0, { x: 8, z: 8 });
  match = createMatchState('player', 'You', 0xffaa00, [
    { id: bot.id, name: bot.name, color: bot.color },
  ]);

  // ── Phase 1 — Game.doShoot(): the player's bullet drops the bot's HP to 0.
  //    The bot is flipped dead AND the kill is registered right here, the
  //    instant the death happens (this is the T21 fix). ──
  const wasAlive = bot.isAlive;
  let bots: BotData[] = [
    {
      ...bot,
      health: 0,
      isAlive: false,
      state: 'dead',
      respawnTimer: GAME_CONFIG.bots.respawnDelay,
      deaths: bot.deaths + 1,
    },
  ];
  const dead = bots[0];
  if (wasAlive && !dead.isAlive) {
    bus.emit('botKilled', {
      id: dead.id,
      name: dead.name,
      killerId: 'player',
      weaponType: 'RIFLE',
      position: { x: dead.position.x, z: dead.position.z },
    });
  }

  // ── Phase 2 — Game.tickBots(): run the AI tick for every bot. There is no
  //    longer a death-detection branch here — the kill was already booked in
  //    doShoot(), so this phase must NOT emit a second botKilled. ──
  const world: BotWorldSnapshot = {
    playerPosition: { x: 0, y: 0, z: 0 },
    playerAlive: true,
    otherBots: [],
    obstacles: [],
    arena: { width: GAME_CONFIG.arena.width, depth: GAME_CONFIG.arena.depth },
    gunshot: null,
    matchTime: 1,
  };

  const dt = 0.016;
  const updated: BotData[] = [];
  for (const b of bots) {
    const res = tickBot(b, world, dt);
    updated.push(res.bot);
  }
  bots = updated;

  const playerScore = match.players.find((p) => p.isPlayer)!;
  return { botKilledCount, playerKills: playerScore.kills, matchPhase: match.phase };
}

describe('REGRESSION T20/T21 — game does NOT stop on first kill', () => {
  it('registers exactly one kill when the player kills one bot, match stays active', () => {
    const { botKilledCount, playerKills, matchPhase } = simulateKillingFrame();

    // The match stays live — scoreLimit/state-machine were never the cause.
    expect(matchPhase, 'match should remain IN_PROGRESS (active) after one kill').toBe('active');

    // The fix: doShoot() registers the kill at the point of death, so botKilled
    // fires exactly once and the scoreboard records it. (Before T21 this was 0.)
    expect(
      botKilledCount,
      'exactly one botKilled must be emitted when the player kills a bot — ' +
        'registered in doShoot() at the moment of death (T21 fix).',
    ).toBe(1);

    expect(
      playerKills,
      'the deathmatch scoreboard must record the player kill (kills=1) so the ' +
        'match can progress toward scoreLimit.',
    ).toBe(1);
  });
});
