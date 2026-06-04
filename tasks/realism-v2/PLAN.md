# Realism v2 — Plan

**Project:** Games.Shooter (project_id 7)
**Repo:** https://github.com/harutk7/struk.game.shooter.git (branch: `main`)
**Assignee:** Default Claude (agent_id 134)
**Baseline:** Task #34 (commit 2bc3456) — realistic-shooter-overhaul. Already ships FPV, 4 weapons, recoil/reload, 5 bots, deathmatch, blood, hit markers.

## User complaint (verbatim, translated)

> "It's like carton [cartoon]. Minecraft. No weapon. No sound. No normal bots. After 1 bot die game stops."

Decomposed into four workstreams:

| ID | Symptom | Root cause | Tasks |
|---|---|---|---|
| **A** | "Carton, Minecraft, no weapon" | Procedural geometry is blocky primitives, no PBR/textures, no shadow/lighting work, hands are boxes, no asset pipeline. | T1-T12 (12 tasks) |
| **B** | "No sound" | No audio system. Only one synthesized empty-click SFX. No gunshots, footsteps, hits, ambient. | T13-T15 (3 tasks) |
| **C** | "No normal bots" | Bot AI is pure 2D logic (xz only) — no pathfinding through obstacles, no group behavior, no realistic reaction, bots are color-cubes with no animation. | T16-T19 (4 tasks) |
| **D** | "After 1 bot die game stops" | Game-stops-on-first-kill bug. Likely in respawn path or scoreLimit handling. Repro + fix required. | T20-T21 (2 tasks) |

**Total: 21 tasks.** Goal: realistic feel without breaking task #34's working baseline.

## Branch + commit conventions (binding for every task)

- Each task: `feat/realism-v2-<short-name>` or `fix/realism-v2-<short-name>`
- Conventional commit messages: `feat(scope): summary` / `fix(scope): summary`
- Atomic commits: one logical change per commit
- Push the branch, **do not merge to main** — user merges
- Branch is created from the latest `main` HEAD

## Prompt template (binding shape for every task)

```
GOAL: <one line, ties to realism-v2 whole>
CONTEXT: <1-2 lines: file(s), sibling task #s it composes with>
DO: <what to change, at file/subsystem level, not code>
ACCEPTANCE: <bulleted, concrete, observable>
VERIFY: <how to prove it — vitest command, manual check, screenshot, perf metric>
OUT OF SCOPE: <what not to touch>
BRANCH: feat/realism-v2-<name>
COMMIT: <conventional commit message>
PUSH: push the branch, do not merge to main
REPORT: <what to write back in the task deliverable>
```

## Dependency graph (informational; tasks still run independently)

```
T1 (env+asset pipeline) ──┬──> T2 (PBR floor) ──> T3 (PBR walls+objects)
                          ├──> T4 (lighting+shadows) ──> T5 (fog+skybox)
                          ├──> T6 (hand rig)
                          ├──> T7 (weapon glTF loader) ──> T8 (weapon PBR materials)
                          └──> T12 (CREDITS)

T9 (muzzle flash v2) ──> T10 (shell ejection) ──> T11 (recoil polish)

T13 (audio system) ──┬──> T14 (gunfire SFX) ──> T15 (footsteps + ambient)
                     └──> T16 (damage SFX)

T17 (bot pathfinding) ──> T18 (bot PBR body) ──> T19 (bot voice lines)

T20 (repro game-stop bug) ──> T21 (fix game-stop bug)
```

## Verification standards (all tasks must satisfy)

- `npm test` (vitest) must remain green
- `npm run build` (tsc + vite) must remain green
- `node scripts/runtime_smoke.mjs` (or equivalent) must remain green
- Visual changes: agent must take a screenshot or describe what they'd look for in `localhost:3000` FPV
- Behavioral changes: agent must add a vitest unit test

## What "done" means for a task

1. Code committed to its own branch, pushed.
2. All three test gates pass (vitest, build, runtime smoke).
3. New behavior covered by at least one test (if it's testable headlessly).
4. Task status updated to `done` in Strukswarm with a 1-paragraph deliverable summary.
5. If a new convention, dependency, or gotcha was learned, it is written to project memory.
