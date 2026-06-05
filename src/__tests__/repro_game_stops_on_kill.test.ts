/**
 * REPRO (T20) — "After 1 bot die, game stops."
 *
 * This is a DIAGNOSIS test. It is EXPECTED TO FAIL on the current `main`
 * (commit 2bc3456). The failing assertions are the deliverable: they pin
 * down the exact moment the deathmatch kill-flow drops a player kill on the
 * floor. The fix lands in T21 — see tasks/realism-v2/BUG_T20_DIAGNOSIS.md.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Root cause (verified):
 *
 * The deathmatch kill of a bot is applied in TWO places, in the WRONG order,
 * within a single Game.loop() frame:
 *
 *   1. Game.doShoot()  (src/game/Game.ts ~L714-739) runs FIRST when the player
 *      fires. On the killing shot it mutates the bot in-place and flips
 *      `isAlive = false`, `state = 'dead'` SYNCHRONOUSLY:
 *
 *          this.bots[idx] = { ...this.bots[idx], isAlive: false, state: 'dead', ... };
 *
 *   2. Game.tickBots() (src/game/Game.ts ~L653) runs LATER in the same frame
 *      and tries to detect the death by comparing the pre-tick bot to the
 *      post-tick bot:
 *
 *          if (bot.isAlive && !next.isAlive) {
 *            this.botRenderer.startDeathAnimation(next.id);
 *            this.bus.emit('botKilled', { ... killerId: 'player' ... });
 *            addKill(this.score, 100, ...);   // scoreboard
 *          }
 *
 *      But `bot` here is the array element doShoot ALREADY killed, so
 *      `bot.isAlive` is already `false`. The guard is never true.
 *
 * Net effect: `botKilled` is NEVER emitted for a player kill, so the
 * `botKilled` handler in Game.wireEvents() (~L215) never calls
 * registerKillEvent(), the scoreboard never increments, the kill feed stays
 * empty, and the ragdoll/death animation never plays. The match can never
 * reach scoreLimit, so the deathmatch is permanently stuck after the first
 * kill — the user's "after 1 bot die, game stops."
 *
 * NOTE on test shape: Game cannot be instantiated under vitest (its
 * constructor builds a THREE.WebGLRenderer + DOM widgets that need a real
 * canvas/WebGL context, unavailable in the node test env, and jsdom is not a
 * dependency). So this test reproduces Game's exact two-phase kill sequence
 * using the REAL domain modules (createBot, tickBot, EventBus, MatchManager)
 * and asserts the user-facing invariant. Line references above let T21 verify
 * the fix against the real source.
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
 * on a bot. Mirrors src/game/Game.ts exactly:
 *   - doShoot() kills the bot synchronously, then
 *   - tickBots() runs the death-detection / event-emit / scoring.
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

  // ── Phase 1 — Game.doShoot() (Game.ts ~L723): player's bullet drops the
  //    bot's HP to 0 and the kill is committed SYNCHRONOUSLY in-place. ──
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

  // ── Phase 2 — Game.tickBots() (Game.ts ~L588-665): run the AI tick and the
  //    death-transition detection for every bot, exactly as the real loop. ──
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
    const next = res.bot;

    // Game.ts L653 — the death-detection guard.
    if (b.isAlive && !next.isAlive) {
      bus.emit('botKilled', {
        id: next.id,
        name: next.name,
        killerId: 'player',
        weaponType: 'RIFLE',
        position: { x: next.position.x, z: next.position.z },
      });
    }
    updated.push(next);
  }
  bots = updated;

  const playerScore = match.players.find((p) => p.isPlayer)!;
  return { botKilledCount, playerKills: playerScore.kills, matchPhase: match.phase };
}

describe('REPRO T20 — game stops on first kill', () => {
  it('registers the kill when the player kills one bot (FAILS today — bug)', () => {
    const { botKilledCount, playerKills, matchPhase } = simulateKillingFrame();

    // The match should still be live — confirms scoreLimit/state-machine are
    // NOT the cause (this assertion PASSES, ruling those hypotheses out).
    expect(matchPhase, 'match should remain IN_PROGRESS (active) after one kill').toBe('active');

    // The actual bug: the player's kill is dropped. These FAIL on `main`
    // because doShoot() already flipped isAlive=false before tickBots() looked,
    // so the botKilled event is never emitted and the kill never scores.
    expect(
      botKilledCount,
      'Game.tickBots() should emit exactly one botKilled when the player kills a bot, ' +
        'but it emits 0: doShoot() already set isAlive=false, so the ' +
        '`bot.isAlive && !next.isAlive` guard (Game.ts L653) is never true.',
    ).toBe(1);

    expect(
      playerKills,
      'the deathmatch scoreboard should record the player kill (kills=1), ' +
        'but it stays 0 — the match can never reach scoreLimit, so play is ' +
        'stuck after the first kill.',
    ).toBe(1);
  });
});
