# BUG T20 — "After 1 bot die, game stops" — Diagnosis

**Workstream:** D (stability) · **Task:** T20 (diagnose only — fix is T21)
**Repo:** struk.game.shooter · **Baseline:** `main` @ `2bc3456`
**Branch:** `fix/realism-v2-repro-game-stops-bug`
**Repro test:** `src/__tests__/repro_game_stops_on_kill.test.ts` (RED on purpose)

---

## 1. Repro steps

1. `npm run dev`, open `http://localhost:3000` (or `…/?mode=dm` to jump straight in).
2. From the start screen click **Deathmatch**. 5 bots spawn; the match HUD shows
   `You 0 / Bot 0`, timer counting down from 5:00.
3. Find a bot and shoot it until its HP bar empties (e.g. ~4 rifle hits).
4. Observe the moment the bot's HP reaches 0.

Headless equivalent (no browser/WebGL needed):

```
npm test -- repro_game_stops_on_kill      # exits non-zero — the captured bug
```

## 2. Observed symptoms

When the first bot's HP hits 0:

- **No kill is registered.** The deathmatch scoreboard (`MatchHUD`) stays `You 0`.
- **No kill feed entry** appears.
- **No death ragdoll.** `BotRenderer.startDeathAnimation()` is never called, so the
  bot's mesh just freezes standing in place (it does not fall/fade).
- **The match never progresses.** Because no kill is ever scored, no player can reach
  `scoreLimit` (20), so the match cannot end via score and play is effectively stuck
  after the first kill — matching the user's "after 1 bot die, game stops."
- ~3 s later the frozen bot silently teleports to a spawn point (respawn) reusing the
  old mesh, with no death having visibly occurred.

**Console error / stack trace:** None. The loop does **not** throw and the
`requestAnimationFrame` chain keeps running; input/movement still work. This is a
**logic / event-flow stall**, not a crash or a hard freeze. (`EventBus.emit()` also
wraps every handler in try/catch — `src/core/EventBus.ts:45-51` — so even a throwing
listener could not stop the loop.)

## 3. Root cause

The bot kill is committed in **two places, in the wrong order, inside one
`Game.loop()` frame**:

1. **`Game.doShoot()` runs first** when the player fires (`src/game/Game.ts:714-739`).
   On the killing shot it mutates the bot **in-place** and flips it dead
   **synchronously**:

   ```ts
   this.bots[idx] = { ...this.bots[idx], isAlive: false, state: 'dead',
                      respawnTimer: GAME_CONFIG.bots.respawnDelay, deaths: bot.deaths + 1 };
   // emits only 'botDamaged' — NOT 'botKilled'
   ```

2. **`Game.tickBots()` runs later in the same frame** (`src/game/Game.ts:543`,
   `567-668`) and is the only place that emits `botKilled` + scores the kill. It
   detects death by diffing the pre-tick vs post-tick bot (`src/game/Game.ts:653`):

   ```ts
   if (bot.isAlive && !next.isAlive) {            // ← never true for a player kill
     this.botRenderer.startDeathAnimation(next.id);
     this.bus.emit('botKilled', { id: next.id, killerId: 'player', ... });
     const kr = addKill(this.score, 100, ...);    // scoreboard
   }
   ```

   But `bot` is the array element **doShoot already killed**, so `bot.isAlive` is
   already `false` and the guard is never satisfied.

**Consequence chain:**
`botKilled` never fires → the handler in `Game.wireEvents()` (`src/game/Game.ts:215-224`)
never runs → `registerKillEvent()` (`src/models/MatchManager.ts:69`) never increments
kills → scoreboard, kill feed, ragdoll, and powerup-drop hooks all stay dormant → the
match can never reach `scoreLimit` → deathmatch is stuck after the first kill.

### Hypotheses investigated and ruled out

- **Premature `GAME_OVER` / `handleGameOver` on a bot death** — ruled out. The only
  caller of `handleGameOver()` is the `playerDied` event (`Game.ts:178`), emitted only
  when the *player's* HP hits 0 (`Game.ts:632`). A bot death never touches `GameState`.
- **`scoreLimit` flips the match to finished on kill #1** — ruled out.
  `GAME_CONFIG.match.scoreLimit = 20` (`src/core/GameConfig.ts:73`); `tickMatch` /
  `registerKillEvent` only finish at `kills >= 20`. The repro test asserts
  `matchPhase === 'active'` and that assertion **passes**.
- **EventBus listener leak (handlers stacking per death)** — ruled out. `wireEvents()`
  is called once in `init()`; `EventBus` stores handlers in a `Set`
  (`src/core/EventBus.ts:16`). No per-death subscription exists.
- **Respawn timer never fires** — ruled out. `tickBot` decrements `respawnTimer` for
  dead bots (`src/systems/BotAI.ts:241-248`) and `Game.tickBots` respawns at `<= 0`
  (`Game.ts:637-651`). Respawn works (it is in fact the only reason the frozen bot
  eventually moves).

## 4. Suggested fix direction (for T21)

Make the kill register **where the death actually happens** — `Game.doShoot()` — instead
of relying on a transition check in `tickBots()` that a synchronous in-place kill
defeats. Concretely, one of:

- **Preferred:** in `doShoot()`, when a bot's HP crosses to 0, do the kill bookkeeping
  right there: call `this.botRenderer.startDeathAnimation(id)`, `emit('botKilled', { killerId: 'player', ... })`,
  and `addKill(...)`. Remove the now-dead `bot.isAlive && !next.isAlive` branch from
  `tickBots()` (or keep it only for non-player deaths, which currently don't exist).
- **Alternative:** have `doShoot()` only apply damage and **not** flip `isAlive`; let the
  bot's death be discovered by `tickBots()` (have `tickBot`/`tickBots` detect `health <= 0`
  and perform the transition), so the existing `bot.isAlive && !next.isAlive` diff fires
  exactly once.

Either way, after the fix the repro test's invariant must hold: **one player kill ⇒ one
`botKilled` event ⇒ scoreboard kills = 1, match still `active`.** T21 should convert this
repro into a green regression test.

---

## 5. RESOLVED (T21)

**Fixed by:** agent id **134** (Default Claude · `claude:sonnet`)
**Branch:** `fix/realism-v2-game-stops-bug` (cut from the T20 branch, i.e. `main` @ `2bc3456`
plus the T20 repro commit `6076dae`)
**Commit:** `fix(game): resolve game-stops-on-first-kill (see BUG_T20_DIAGNOSIS.md)`

### What changed

Adopted the **preferred** fix from §4: register the kill *where the death actually
happens* instead of relying on a post-tick diff that the synchronous in-place kill
defeated.

1. **`src/game/Game.ts` — `doShoot()`** (bot-hit branch): when a bot's HP crosses to 0,
   the kill is now booked **right there**, in the same statement that flips the bot dead:
   - `this.botRenderer.startDeathAnimation(id)` — death ragdoll plays,
   - `this.bus.emit('botKilled', { killerId: 'player', … })` — scoreboard + kill feed fire,
   - `addKill(this.score, 100, …)` + `hud.updateScore(...)` — score HUD updates.

2. **`src/game/Game.ts` — `tickBots()`**: removed the now-dead
   `if (bot.isAlive && !next.isAlive) { … }` death-detection branch. A bot can only die
   from a player shot and `doShoot()` is the only place that flips `isAlive = false`, so
   there is no post-tick transition left to detect. Respawn handling in `tickBots()` is
   unchanged.

No other files in `src/` were touched; the match state machine, BotAI, respawn logic,
and realism-v2 systems (assets/PBR/audio/pathfinding) were left intact.

### Tests

- `src/__tests__/repro_game_stops_on_kill.test.ts` — the T20 repro, converted from RED to
  a **green** regression test that mirrors the fixed flow (kill registered at the moment of
  death; `tickBots()` emits no second `botKilled`).
- `src/__tests__/deathmatch_kill_flow.test.ts` — **new** hardening suite:
  - killing N = 3 and N = 5 bots keeps the match `active`,
  - the match transitions to `finished` **only** at `scoreLimit` (20), with the player as
    winner — and stays `active` for every kill before that,
  - a killed bot respawns after `respawnDelay` (3 s): back in the world with
    `isAlive = true`, full health, non-`dead` state, death tally preserved.

### Verification gates (all green)

- `npm test` — **266 passed** (was 261 passed / 1 failing repro before the fix).
- `npm run build` — `tsc && vite build` succeed.
- `node scripts/runtime_smoke.mjs` — 41 modules fetched, 0 transform errors (run against
  `npm run dev` on `localhost:3000`).

### Screenshot note

The VERIFY step asks for a mid-match screenshot
(`tasks/realism-v2/screenshots/t21-match-after-kills.png`). This sandbox has **no headless
browser with a WebGL context** (no Chromium/Puppeteer/Playwright installed), and the
deathmatch requires live pointer-lock gameplay to render, so a genuine in-game screenshot
could not be captured here. Rather than fabricate an image, the `screenshots/` directory is
kept with its `.gitkeep` placeholder; the headless `runtime_smoke` gate stands in as the
automated runtime proof that every game module loads and transforms cleanly after the fix.
