// Smoke test: SSR-import the game's TS modules and verify they construct
// without throwing. This catches most "this.field is undefined" issues
// at module load time.
//
// Run: cd /app/shooter && npx tsx scripts/smoke.ts

import { createPlayer } from "../src/models/Player";
import { createBot, damageBot, respawnBot } from "../src/models/Bot";
import { createWeapon, startReload, tickReload } from "../src/models/Weapon";
import { hasLineOfSight, tickBot } from "../src/systems/BotAI";
import { createMatchState, tickMatch, registerKillEvent, formatTime } from "../src/models/MatchManager";
import { GAME_CONFIG } from "../src/core/GameConfig";

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean, detail?: string): void {
  if (cond) {
    pass++;
    console.log(`✓ ${name}`);
  } else {
    fail++;
    console.error(`✗ ${name} ${detail ? "— " + detail : ""}`);
  }
}

console.log("=== Pure-data smoke ===");

// 1. Player model
const p = createPlayer();
check("createPlayer has all weapons default", p.ownedWeapons.length === 1 && p.ownedWeapons[0] === "PISTOL");
check("createPlayer has full health", p.health === GAME_CONFIG.player.maxHealth);
check("createPlayer is alive", p.isAlive);

// 2. Weapon model
const w = createWeapon("RIFLE");
check("RIFLE mag size = 30", w.currentAmmo === 30);
check("RIFLE reserve = 120", w.reserveAmmo === 120);
// Drain the mag first so reload can start
const drained = { ...w, currentAmmo: 5, reserveAmmo: 25 };
const r1 = startReload(drained);
check("startReload returns new state when mag partial", r1 !== null && r1!.isReloading);
const r2 = tickReload(r1!, 3.0);
check("tickReload completes after full time", r2 !== null && !r2!.isReloading && r2!.currentAmmo === 30);
check("reserve decreased by ammo loaded", r2!.reserveAmmo === 0);

// 3. Bot model
const b = createBot(0, { x: 5, z: 5 });
check("bot created alive", b.isAlive);
check("bot has rifle (even idx)", b.weapon === "RIFLE");
const b1 = createBot(1, { x: 0, z: 0 });
check("bot 1 has pistol (odd idx)", b1.weapon === "PISTOL");
const db = damageBot(b, 30);
check("bot takes damage", db.health === 70 && db.isAlive);
const kb = damageBot(db, 200);
check("bot dies when overkilled", !kb.isAlive);
const rb = respawnBot(kb, { x: 10, z: 10 });
check("bot respawns at full health", rb.isAlive && rb.health === 100);

// 4. BotAI line of sight
const visible = hasLineOfSight(
  { x: 0, y: 1.5, z: 0 },
  { x: 10, y: 1.5, z: 0 },
  [], // no obstacles
);
check("empty-obstacle LOS returns true", visible);
const blocked = hasLineOfSight(
  { x: 0, y: 1.5, z: 0 },
  { x: 10, y: 1.5, z: 0 },
  [{ minX: 4, maxX: 6, minZ: -2, maxZ: 2 }],
);
check("obstacle in path returns false", !blocked);

// 5. BotAI tick — bot without world reacts sensibly
const world = {
  playerPosition: { x: 50, y: 0, z: 50 },
  playerAlive: true,
  otherBots: [],
  obstacles: [],
  arena: { width: 50, depth: 50 },
  gunshot: null,
  matchTime: 0,
};
const aiRes = tickBot(b1, world, 0.016);
check("tickBot returns a new bot state", aiRes.bot !== b1);
check("tickBot returns fired=false for distant player", aiRes.fired === false);

// 6. MatchManager
const m = createMatchState("player", "You", 0xffaa00, [
  { id: "bot1", name: "Alpha", color: 0xff0000 },
  { id: "bot2", name: "Bravo", color: 0x00ff00 },
]);
check("match starts with 3 players", m.players.length === 3);
check("match timer = 300s", m.timer === 300);
check("match score limit = 20", m.scoreLimit === 20);
const m2 = tickMatch(m, 10);
check("match timer ticks down", Math.abs(m2.timer - 290) < 0.001);
const m3 = registerKillEvent(m2, "player", "bot1");
check("registerKill updates player kills", m3.players.find(p => p.id === "player")!.kills === 1);
check("registerKill updates victim deaths", m3.players.find(p => p.id === "bot1")!.deaths === 1);
// Push to score limit
let m4 = m3;
for (let i = 0; i < 19; i++) m4 = registerKillEvent(m4, "player", "bot1");
check("match ends when player hits 20 kills", m4.phase === "finished");
check("player is the winner", m4.winnerId === "player");

// 7. Config sanity
check("GAME_CONFIG.fpv has eyeHeight=1.6", (GAME_CONFIG as any).fpv.eyeHeight === 1.6);
check("GAME_CONFIG.weapons has SNIPER", "SNIPER" in GAME_CONFIG.weapons);
check("GAME_CONFIG.weaponFeel has SNIPER", "SNIPER" in (GAME_CONFIG as any).weaponFeel);
check("GAME_CONFIG.bots has 5+ spawn points", (GAME_CONFIG as any).bots.spawnPoints.length >= 5);
check("GAME_CONFIG.match.scoreLimit=20", (GAME_CONFIG as any).match.scoreLimit === 20);

// 8. Format time
check("formatTime(125) = 2:05", formatTime(125) === "2:05");
check("formatTime(5) = 0:05", formatTime(5) === "0:05");

console.log(`\n=== ${pass} pass, ${fail} fail ===`);
if (fail > 0) process.exit(1);
