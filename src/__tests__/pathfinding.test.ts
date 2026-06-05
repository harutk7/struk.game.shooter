import { describe, it, expect } from 'vitest';
import { BotPathfinding, type GridCollider, type Point } from '../systems/BotPathfinding';

/** Straight-line clearance check helper for assertions. */
function segmentBlockedBy(a: Point, b: Point, c: GridCollider): boolean {
  // Sample the segment; true if any sample lands inside the collider AABB.
  const steps = 64;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = a[0] + (b[0] - a[0]) * t;
    const z = a[1] + (b[1] - a[1]) * t;
    if (x >= c.minX && x <= c.maxX && z >= c.minZ && z <= c.maxZ) return true;
  }
  return false;
}

describe('BotPathfinding', () => {
  it('returns a 2-point straight path when there are no obstacles', () => {
    const pf = new BotPathfinding([], { width: 50, depth: 50, cellSize: 0.5 });
    const path = pf.findPath([0, 0], [5, 0]);
    expect(path).toHaveLength(2);
    expect(path[0]).toEqual([0, 0]);
    expect(path[path.length - 1]).toEqual([5, 0]);
  });

  it('routes around a wall (>= 3 points, avoids the obstacle)', () => {
    // A wall straddling x=5 between the start (0,0) and goal (10,0).
    const wall: GridCollider = { minX: 4.5, maxX: 5.5, minZ: -3, maxZ: 3 };
    const pf = new BotPathfinding([wall], { width: 50, depth: 50, cellSize: 0.5 });
    const path = pf.findPath([0, 0], [10, 0]);

    expect(path.length).toBeGreaterThanOrEqual(3);
    expect(path[0]).toEqual([0, 0]);
    expect(path[path.length - 1]).toEqual([10, 0]);

    // No segment of the returned path should pass through the wall.
    for (let i = 0; i < path.length - 1; i++) {
      expect(segmentBlockedBy(path[i], path[i + 1], wall)).toBe(false);
    }

    // The detour must leave the straight z=0 corridor at some point.
    const maxAbsZ = Math.max(...path.map((p) => Math.abs(p[1])));
    expect(maxAbsZ).toBeGreaterThan(3);
  });

  it('completes within 16ms on a 100x100 grid', () => {
    // Several walls forming a maze-ish layout to make A* do real work.
    const colliders: GridCollider[] = [
      { minX: -10, maxX: -9, minZ: -20, maxZ: 10 },
      { minX: 0, maxX: 1, minZ: -10, maxZ: 20 },
      { minX: 9, maxX: 10, minZ: -20, maxZ: 10 },
    ];
    const pf = new BotPathfinding(colliders, { width: 50, depth: 50, cellSize: 0.5 });
    // 50m / 0.5m = 100 cells per axis → 100x100 grid.
    expect(pf.cols).toBe(100);
    expect(pf.rows).toBe(100);

    // Warm up the JIT — in-game the pathfinder is reused across frames, so the
    // budget concerns the steady-state per-call cost, not the cold first call.
    let path: Point[] = [];
    for (let i = 0; i < 5; i++) path = pf.findPath([-20, -20], [20, 20]);

    let best = Infinity;
    for (let i = 0; i < 10; i++) {
      const t0 = performance.now();
      pf.findPath([-20, -20], [20, 20]);
      best = Math.min(best, performance.now() - t0);
    }

    expect(path.length).toBeGreaterThanOrEqual(2);
    expect(best).toBeLessThan(16);
  });

  it('falls back to start/end when start and goal are the same cell', () => {
    const pf = new BotPathfinding([], { width: 50, depth: 50, cellSize: 0.5 });
    const path = pf.findPath([0, 0], [0.1, 0.1]);
    expect(path.length).toBeGreaterThanOrEqual(1);
    expect(path[0]).toEqual([0, 0]);
  });

  it('marks cells inside a collider as blocked', () => {
    const wall: GridCollider = { minX: -1, maxX: 1, minZ: -1, maxZ: 1 };
    const pf = new BotPathfinding([wall], { width: 50, depth: 50, cellSize: 0.5, inflate: 0 });
    const [cx, cz] = pf.worldToCell(0, 0);
    expect(pf.isBlockedCell(cx, cz)).toBe(true);
    // A clearly-open cell far from the wall is free.
    const [fx, fz] = pf.worldToCell(15, 15);
    expect(pf.isBlockedCell(fx, fz)).toBe(false);
  });
});
