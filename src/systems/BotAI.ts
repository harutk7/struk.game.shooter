/**
 * Bot AI — per-tick state updates for AI opponents.
 *
 * Pure functions over BotData + a snapshot of the world (player position,
 * other bots, obstacles, etc.). Returns a new BotData — never mutates.
 *
 * The AI uses a simple finite-state machine with these states:
 *   patrol → (heard/saw) → investigate
 *   investigate → (reached position) → patrol
 *   investigate → (saw enemy) → engage
 *   engage → (low ammo) → reload (after seeking cover)
 *   engage → (low health) → cover
 *   any → (killed) → dead
 *
 * Perception: line-of-sight raycast + hearing (gunshot radius).
 * Difficulty controls reaction time, accuracy, and probability of
 * higher-quality decisions (strafe, cover).
 */

import { GAME_CONFIG } from '../core/GameConfig';
import type { BotData } from '../models/Bot';
import { BotPathfinding, type Point } from './BotPathfinding';

const TWO_PI = Math.PI * 2;

// ── Pathfinding state (module-level) ───────────────────────────────────────
// The arena colliders are static, so the grid is built ONCE per collider set
// and the same pathfinder is reused across every bot and tick. Per-bot path
// state (current waypoint, plan age, the player position we planned for) is
// keyed by bot id so `tickBot` can stay a per-bot function.

let _pathfinder: BotPathfinding | null = null;
let _pathfinderColliders: BotWorldSnapshot['obstacles'] | null = null;

/** Get (or lazily build) the pathfinder for the current static collider set. */
function getPathfinder(obstacles: BotWorldSnapshot['obstacles']): BotPathfinding {
  if (_pathfinder && _pathfinderColliders === obstacles) return _pathfinder;
  _pathfinder = new BotPathfinding(obstacles, {
    width: GAME_CONFIG.arena.width,
    depth: GAME_CONFIG.arena.depth,
  });
  _pathfinderColliders = obstacles;
  return _pathfinder;
}

interface BotPathState {
  /** Simplified waypoint list (world XZ). */
  path: Point[];
  /** Index of the waypoint we are currently steering toward. */
  index: number;
  /** Player position at plan time — replan when the player drifts from it. */
  plannedTarget: { x: number; z: number };
  /** Seconds since the path was planned. */
  ageSec: number;
}

const _pathStates = new Map<string, BotPathState>();

/** How far (m) the player may drift from the plan target before we replan. */
const REPLAN_PLAYER_DRIFT = 3.0;
/** Max plan age (s) before a forced replan. */
const REPLAN_MAX_AGE = 2.0;
/** Distance (m) at which a waypoint counts as reached. */
const WAYPOINT_REACHED = 0.6;

/** Reset all pathfinding caches/state (for tests and match restarts). */
export function _resetPathfindingState(): void {
  _pathfinder = null;
  _pathfinderColliders = null;
  _pathStates.clear();
}

function wrapAngle(a: number): number {
  // Normalize to [-PI, PI]
  while (a > Math.PI) a -= TWO_PI;
  while (a < -Math.PI) a += TWO_PI;
  return a;
}

function dist2D(a: { x: number; z: number }, b: { x: number; z: number }): number {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}

/** Pick a random patrol waypoint within `radius` of `origin`. */
function pickWaypoint(origin: { x: number; z: number }, radius: number, arena: { width: number; depth: number }): { x: number; z: number } {
  const angle = Math.random() * TWO_PI;
  const r = Math.random() * radius;
  return {
    x: Math.max(-arena.width / 2 + 2, Math.min(arena.width / 2 - 2, origin.x + Math.cos(angle) * r)),
    z: Math.max(-arena.depth / 2 + 2, Math.min(arena.depth / 2 - 2, origin.z + Math.sin(angle) * r)),
  };
}

/** Smoothly rotate yaw toward a target angle. */
function approachYaw(current: number, target: number, dt: number, rate: number): number {
  const diff = wrapAngle(target - current);
  const max = rate * dt;
  if (Math.abs(diff) <= max) return target;
  return current + Math.sign(diff) * max;
}

/** Public world snapshot the AI reads from. */
export interface BotWorldSnapshot {
  /** Player position (the target the bots hunt). */
  playerPosition: { x: number; y: number; z: number };
  /** Player alive? */
  playerAlive: boolean;
  /** Other bots' positions (for collision avoidance). */
  otherBots: Array<{ id: string; position: { x: number; z: number }; isAlive: boolean }>;
  /** Coarse static obstacle map (xz boxes the bots must not walk into). */
  obstacles: Array<{ minX: number; maxX: number; minZ: number; maxZ: number }>;
  /** Arena bounds. */
  arena: { width: number; depth: number };
  /** Whether the player has fired recently (heard gunshot origin). */
  gunshot: { x: number; z: number; ageSec: number } | null;
  /** Time since match start, for variety. */
  matchTime: number;
}

export interface BotAIResult {
  bot: BotData;
  /** Did the bot fire THIS frame? (caller renders muzzle flash, spawns projectile) */
  fired: boolean;
  /** Direction the bot fired (world-space, normalized). */
  fireDir: { x: number; z: number };
}

/** Line-of-sight check between two points against the obstacle list. */
export function hasLineOfSight(
  from: { x: number; y: number; z: number },
  to: { x: number; y: number; z: number },
  obstacles: BotWorldSnapshot['obstacles'],
): boolean {
  // AABB ray test for each obstacle
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const dist = Math.sqrt(dx * dx + dz * dz);
  if (dist < 0.001) return true;
  const invX = 1 / dx;
  const invZ = 1 / dz;
  for (const o of obstacles) {
    let tMin = 0, tMax = 1;
    if (Math.abs(dx) < 1e-6) {
      if (from.x < o.minX || from.x > o.maxX) continue;
    } else {
      const t1 = (o.minX - from.x) * invX;
      const t2 = (o.maxX - from.x) * invX;
      const lo = Math.min(t1, t2);
      const hi = Math.max(t1, t2);
      tMin = Math.max(tMin, lo);
      tMax = Math.min(tMax, hi);
      if (tMin > tMax) continue;
    }
    if (Math.abs(dz) < 1e-6) {
      if (from.z < o.minZ || from.z > o.maxZ) continue;
    } else {
      const t1 = (o.minZ - from.z) * invZ;
      const t2 = (o.maxZ - from.z) * invZ;
      const lo = Math.min(t1, t2);
      const hi = Math.max(t1, t2);
      tMin = Math.max(tMin, lo);
      tMax = Math.min(tMax, hi);
      if (tMin > tMax) continue;
    }
    if (tMin <= 1 && tMax >= 0) {
      // Ray hit this obstacle
      return false;
    }
  }
  return true;
}

/** Returns true if `from` can see `to` and `to` is in front of `from`'s facing. */
export function canSeeTarget(
  bot: BotData,
  target: { x: number; z: number },
  obstacles: BotWorldSnapshot['obstacles'],
): boolean {
  const dx = target.x - bot.position.x;
  const dz = target.z - bot.position.z;
  const dist = Math.sqrt(dx * dx + dz * dz);
  if (dist > GAME_CONFIG.bots.sightRange) return false;
  // FOV check
  const angle = Math.atan2(dz, dx);
  const diff = Math.abs(wrapAngle(angle - bot.yaw));
  const halfFov = (GAME_CONFIG.bots.fov / 2) * (Math.PI / 180);
  if (diff > halfFov) return false;
  return hasLineOfSight(
    { x: bot.position.x, y: 1.5, z: bot.position.z },
    { x: target.x, y: 1.5, z: target.z },
    obstacles,
  );
}

/** Move a bot toward `target` with simple obstacle repulsion. */
function moveToward(
  bot: BotData,
  target: { x: number; z: number },
  speed: number,
  dt: number,
  obstacles: BotWorldSnapshot['obstacles'],
  otherBots: BotWorldSnapshot['otherBots'],
  arena: { width: number; depth: number },
): { newPos: { x: number; y: number; z: number }; arrived: boolean; yaw: number } {
  const dx = target.x - bot.position.x;
  const dz = target.z - bot.position.z;
  const d = Math.sqrt(dx * dx + dz * dz);
  if (d < 0.4) {
    return { newPos: { ...bot.position }, arrived: true, yaw: bot.yaw };
  }
  const nx = dx / d;
  const nz = dz / d;

  // Apply repulsion from other bots (basic separation)
  let sepX = 0, sepZ = 0;
  for (const o of otherBots) {
    if (!o.isAlive) continue;
    const ddx = bot.position.x - o.position.x;
    const ddz = bot.position.z - o.position.z;
    const dd = Math.sqrt(ddx * ddx + ddz * ddz);
    if (dd < 1.5 && dd > 0.01) {
      sepX += (ddx / dd) * (1.5 - dd) / 1.5;
      sepZ += (ddz / dd) * (1.5 - dd) / 1.5;
    }
  }

  // Apply repulsion from obstacles
  for (const o of obstacles) {
    const cx = (o.minX + o.maxX) / 2;
    const cz = (o.minZ + o.maxZ) / 2;
    const dxo = bot.position.x - cx;
    const dzo = bot.position.z - cz;
    const dxoAbs = Math.abs(dxo);
    const dzoAbs = Math.abs(dzo);
    const halfW = (o.maxX - o.minX) / 2;
    const halfD = (o.maxZ - o.minZ) / 2;
    if (dxoAbs < halfW + 1.5 && dzoAbs < halfD + 1.5) {
      const pushX = (halfW + 1.5) - dxoAbs;
      const pushZ = (halfD + 1.5) - dzoAbs;
      if (pushX < pushZ) {
        sepX += Math.sign(dxo) * pushX * 0.5;
      } else {
        sepZ += Math.sign(dzo) * pushZ * 0.5;
      }
    }
  }

  // Arena bounds pushback
  const margin = 1.0;
  if (bot.position.x > arena.width / 2 - margin) sepX -= 2.0;
  if (bot.position.x < -arena.width / 2 + margin) sepX += 2.0;
  if (bot.position.z > arena.depth / 2 - margin) sepZ -= 2.0;
  if (bot.position.z < -arena.depth / 2 + margin) sepZ += 2.0;

  // Blend direction with separation
  const blendX = nx + sepX * 0.7;
  const blendZ = nz + sepZ * 0.7;
  const blendD = Math.sqrt(blendX * blendX + blendZ * blendZ);
  const finalNx = blendD > 0.01 ? blendX / blendD : nx;
  const finalNz = blendD > 0.01 ? blendZ / blendD : nz;

  const newPos = {
    x: bot.position.x + finalNx * speed * dt,
    y: bot.position.y,
    z: bot.position.z + finalNz * speed * dt,
  };
  const yaw = Math.atan2(finalNz, finalNx);
  return { newPos, arrived: false, yaw };
}

/** Decide a new strafe direction. */
function rollStrafeDir(): -1 | 1 {
  return Math.random() < 0.5 ? -1 : 1;
}

/**
 * Engage-state movement when the direct line to the player is blocked: maintain
 * (or replan) an A* detour around the obstacles and step toward the next
 * waypoint. Replans when the plan ages out, the player drifts off the planned
 * target, or the path has been fully consumed.
 */
function followDetour(
  bot: BotData,
  world: BotWorldSnapshot,
  dt: number,
  arena: { width: number; depth: number },
): { x: number; y: number; z: number } {
  const pf = getPathfinder(world.obstacles);
  const player = world.playerPosition;

  let st = _pathStates.get(bot.id);
  const needReplan =
    !st
    || st.ageSec >= REPLAN_MAX_AGE
    || st.index >= st.path.length
    || dist2D(st.plannedTarget, player) > REPLAN_PLAYER_DRIFT;

  let plan: BotPathState;
  if (needReplan) {
    const path = pf.findPath([bot.position.x, bot.position.z], [player.x, player.z]);
    plan = {
      path,
      index: path.length > 1 ? 1 : 0,
      plannedTarget: { x: player.x, z: player.z },
      ageSec: 0,
    };
    _pathStates.set(bot.id, plan);
  } else {
    plan = st!;
    plan.ageSec += dt;
  }

  if (plan.path.length === 0) return { ...bot.position };

  // Advance past any waypoints we have effectively reached.
  let wp = plan.path[Math.min(plan.index, plan.path.length - 1)];
  while (
    plan.index < plan.path.length - 1
    && dist2D(bot.position, { x: wp[0], z: wp[1] }) < WAYPOINT_REACHED
  ) {
    plan.index++;
    wp = plan.path[plan.index];
  }

  const r = moveToward(
    bot,
    { x: wp[0], z: wp[1] },
    GAME_CONFIG.bots.patrol.runSpeed,
    dt,
    world.obstacles,
    world.otherBots,
    arena,
  );
  return r.newPos;
}

/** Main per-tick AI update. */
export function tickBot(
  bot: BotData,
  world: BotWorldSnapshot,
  dt: number,
): BotAIResult {
  const cfg = GAME_CONFIG.bots;
  const diff = cfg.difficulty[bot.difficulty];
  const arena = { width: GAME_CONFIG.arena.width, depth: GAME_CONFIG.arena.depth };

  // ── Dead state: count down to respawn ──
  if (!bot.isAlive || bot.state === 'dead') {
    const respawn = { ...bot, respawnTimer: bot.respawnTimer - dt };
    if (respawn.respawnTimer <= 0) {
      // Caller is responsible for actually respawning (it picks the spawn)
      return { bot: respawn, fired: false, fireDir: { x: 0, z: 0 } };
    }
    return { bot: respawn, fired: false, fireDir: { x: 0, z: 0 } };
  }

  // ── Perception ──
  const playerVisible = bot.isAlive && world.playerAlive && canSeeTarget(bot, world.playerPosition, world.obstacles);
  const heardGunshot = world.gunshot
    && dist2D(bot.position, world.gunshot) < cfg.hearingRadius
    && world.gunshot.ageSec < 0.5
    && !playerVisible; // only "investigate" if we don't already see the player

  let next: BotData = { ...bot, stateTimer: bot.stateTimer + dt };

  // ── State machine transitions ──
  if (playerVisible) {
    // Priority: engage. If low ammo, cover & reload.
    if (next.ammo <= 5 && next.reserve > 0 && !next.isReloading) {
      next.state = 'reload';
      next.stateTimer = 0;
      next.isReloading = true;
      next.reloadTimer = 2.0;
    } else if (next.health < 30 && Math.random() < diff.coverProb) {
      next.state = 'cover';
      next.stateTimer = 0;
      // Cover spot: opposite of player position
      const dx = next.position.x - world.playerPosition.x;
      const dz = next.position.z - world.playerPosition.z;
      const d = Math.hypot(dx, dz) || 1;
      next.target = {
        x: next.position.x + (dx / d) * 8,
        z: next.position.z + (dz / d) * 8,
      };
    } else {
      next.state = 'engage';
      next.stateTimer = 0;
      next.targetEnemyId = 'player';
    }
    next.lastKnownEnemyPos = { x: world.playerPosition.x, z: world.playerPosition.z };
  } else if (heardGunshot && world.gunshot) {
    next.state = 'investigate';
    next.stateTimer = 0;
    next.target = { x: world.gunshot.x, z: world.gunshot.z };
    next.lastKnownEnemyPos = { x: world.gunshot.x, z: world.gunshot.z };
  } else if (next.lastKnownEnemyPos && next.state === 'investigate' && next.target) {
    // Continue investigating
  } else if (next.state === 'investigate' && (!next.target || dist2D(bot.position, next.target) < 1.0)) {
    next.state = 'patrol';
    next.stateTimer = 0;
    next.target = null;
    next.lastKnownEnemyPos = null;
  }

  // ── Patrol/Idle → pick a new waypoint ──
  if (next.state === 'patrol' || (next.state === 'idle' && !next.target)) {
    next.waypointTimer -= dt;
    if (!next.target || next.waypointTimer <= 0) {
      next.target = pickWaypoint(next.position, cfg.patrol.waypointRadius, arena);
      next.waypointTimer = cfg.patrol.waypointInterval + Math.random() * 2;
    }
  }

  // ── Reload tick ──
  if (next.isReloading) {
    next.reloadTimer -= dt;
    if (next.reloadTimer <= 0) {
      const need = 30 - next.ammo;
      const load = Math.min(need, next.reserve);
      next = {
        ...next,
        ammo: next.ammo + load,
        reserve: next.reserve - load,
        isReloading: false,
        reloadTimer: 0,
        state: playerVisible ? 'engage' : 'patrol',
        stateTimer: 0,
      };
    }
  }

  // ── Decide + apply movement per state ──
  let yawTarget = next.yaw;
  let newPos = next.position;

  switch (next.state) {
    case 'patrol':
    case 'idle': {
      if (next.target) {
        const r = moveToward(next, next.target, cfg.patrol.walkSpeed, dt, world.obstacles, world.otherBots, arena);
        newPos = r.newPos;
        yawTarget = r.yaw;
        if (r.arrived) {
          next.waypointTimer = 0;
          next.target = null;
        }
      }

      break;
    }
    case 'investigate': {
      if (next.target) {
        const r = moveToward(next, next.target, cfg.patrol.runSpeed, dt, world.obstacles, world.otherBots, arena);
        newPos = r.newPos;
        yawTarget = r.yaw;
        if (r.arrived) {
          next.state = 'patrol';
          next.target = null;
          next.lastKnownEnemyPos = null;
        }
      }

      break;
    }
    case 'engage': {
      // Always face the player.
      const dpx = world.playerPosition.x - next.position.x;
      const dpz = world.playerPosition.z - next.position.z;
      yawTarget = Math.atan2(dpz, dpx);

      // Is the direct line to the player blocked by an obstacle?
      const directClear = hasLineOfSight(
        { x: next.position.x, y: 1.5, z: next.position.z },
        { x: world.playerPosition.x, y: 1.5, z: world.playerPosition.z },
        world.obstacles,
      );

      if (directClear) {
        // ── Clear line: engage directly (strafe in place while shooting) ──
        _pathStates.delete(next.id); // drop any stale detour
        next.strafeTimer -= dt;
        if (next.strafeTimer <= 0) {
          next.strafeDir = Math.random() < diff.strafeProb ? rollStrafeDir() : 0;
          next.strafeTimer = 0.4 + Math.random() * 0.6;
        }
        // Strafe perpendicular to the line-of-sight.
        const perpX = -Math.sin(yawTarget);
        const perpZ = Math.cos(yawTarget);
        const strafeSpeed = 1.2;
        const stepX = perpX * next.strafeDir * strafeSpeed * dt;
        const stepZ = perpZ * next.strafeDir * strafeSpeed * dt;
        newPos = {
          x: next.position.x + stepX,
          y: next.position.y,
          z: next.position.z + stepZ,
        };
      } else {
        // ── Blocked: A* a detour around the obstacles and follow it ──
        newPos = followDetour(next, world, dt, arena);
      }

      break;
    }
    case 'cover': {
      // Run away from the player toward a cover spot
      if (next.target) {
        const r = moveToward(next, next.target, cfg.patrol.runSpeed, dt, world.obstacles, world.otherBots, arena);
        newPos = r.newPos;
        yawTarget = r.yaw;
        if (r.arrived) {
          next.state = playerVisible ? 'engage' : 'patrol';
          next.target = null;
        }
      }

      break;
    }
    case 'reload': {
      // Stand still and reload
      if (next.lastKnownEnemyPos) {
        yawTarget = Math.atan2(
          next.lastKnownEnemyPos.z - next.position.z,
          next.lastKnownEnemyPos.x - next.position.x,
        );
      }
      newPos = next.position;

      break;
    }
    case 'dead': {
      // Should not reach here (handled above)
      newPos = next.position;

      break;
    }
  }

  // ── Smoothly approach the target yaw ──
  const yawRate = next.state === 'engage' ? 6.0 : 3.0;
  next.yaw = approachYaw(next.yaw, yawTarget, dt, yawRate);

  // ── Tick shot-pending (reaction time) ──
  if (next.state === 'engage' && !next.isReloading) {
    next.shotPendingTimer -= dt;
  } else {
    next.shotPendingTimer = diff.reactionTime;
  }

  // ── Velocity for animation ──
  next.velocity = {
    x: (newPos.x - next.position.x) / Math.max(dt, 0.0001),
    z: (newPos.z - next.position.z) / Math.max(dt, 0.0001),
  };
  next.position = newPos;

  // ── Firing decision ──
  let fired = false;
  let fireDir = { x: 0, z: 0 };
  if (next.state === 'engage' && next.shotPendingTimer <= 0 && next.ammo > 0 && !next.isReloading) {
    // Accuracy roll: harder diff = higher hit chance
    if (Math.random() < diff.accuracy) {
      fired = true;
      // Fire along facing direction
      fireDir = { x: Math.cos(next.yaw), z: Math.sin(next.yaw) };
    }
    // Reset timer for next shot (based on weapon fire rate)
    const fireRate = next.weapon === 'RIFLE' ? 8 : 3; // shots/sec
    next.shotPendingTimer = (1 / fireRate) * (0.6 + Math.random() * 0.8);
    next.ammo -= 1;
    if (next.ammo <= 0 && next.reserve > 0) {
      next.isReloading = true;
      next.reloadTimer = 2.0;
      next.state = 'reload';
      next.stateTimer = 0;
    }
  }

  return { bot: next, fired, fireDir };
}
