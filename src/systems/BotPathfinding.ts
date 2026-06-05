/**
 * Bot pathfinding — coarse grid A* over the arena, collider-aware.
 *
 * The arena is discretised into a fixed grid (default 0.5m cells covering the
 * full 50m x 50m arena). A cell is "blocked" if its centre lies inside any
 * static collider (the AABBs returned by `SceneBuilder.build()` and stored in
 * Game.obstacles). `findPath` runs 8-directional A* between two world-space
 * (x, z) points and returns a list of waypoints, simplified with a
 * line-of-sight "string pull" so the bot walks natural diagonals instead of a
 * blocky staircase.
 *
 * Design notes:
 *  - The grid is built ONCE per collider set (the colliders are static) and the
 *    same `BotPathfinding` instance is reused across ticks/bots. Building costs
 *    ~10k point-in-AABB tests (<1ms); A* itself is capped at `maxExpansions`
 *    (default 200) so a single `findPath` stays well under the 16ms/bot budget.
 *  - Colliders are inflated by `inflate` (a coarse bot radius) so paths keep a
 *    little clearance from walls/crates instead of clipping corners.
 *  - No `three` import — pure math, runs in node/vitest with no DOM.
 */

export interface GridCollider {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface PathfindingOptions {
  /** Cell size in metres (grid resolution). Default 0.5. */
  cellSize?: number;
  /** Arena width (metres) the grid covers. Default 50. */
  width?: number;
  /** Arena depth (metres) the grid covers. Default 50. */
  depth?: number;
  /** Max A* node expansions before bailing with a best-effort path. Default 200. */
  maxExpansions?: number;
  /** Collider inflation (metres) — keeps paths clear of obstacle edges. Default 0.4. */
  inflate?: number;
}

/** A world-space point on the XZ plane: [x, z]. */
export type Point = [number, number];

const SQRT2 = Math.SQRT2;

/** 8-connected neighbour offsets and their step cost (in cell units). */
const NEIGHBORS: Array<[number, number, number]> = [
  [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
  [1, 1, SQRT2], [1, -1, SQRT2], [-1, 1, SQRT2], [-1, -1, SQRT2],
];

/** Minimal binary min-heap keyed by an external f-score array. */
class MinHeap {
  private items: number[] = [];
  constructor(private f: Float64Array) {}

  get size(): number {
    return this.items.length;
  }

  push(node: number): void {
    const items = this.items;
    items.push(node);
    let i = items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.f[items[parent]] <= this.f[items[i]]) break;
      [items[parent], items[i]] = [items[i], items[parent]];
      i = parent;
    }
  }

  pop(): number {
    const items = this.items;
    const top = items[0];
    const last = items.pop()!;
    if (items.length > 0) {
      items[0] = last;
      let i = 0;
      const n = items.length;
      for (;;) {
        const l = 2 * i + 1;
        const r = 2 * i + 2;
        let smallest = i;
        if (l < n && this.f[items[l]] < this.f[items[smallest]]) smallest = l;
        if (r < n && this.f[items[r]] < this.f[items[smallest]]) smallest = r;
        if (smallest === i) break;
        [items[smallest], items[i]] = [items[i], items[smallest]];
        i = smallest;
      }
    }
    return top;
  }
}

export class BotPathfinding {
  readonly cellSize: number;
  readonly cols: number;
  readonly rows: number;
  readonly minX: number;
  readonly minZ: number;
  readonly maxExpansions: number;
  private blocked: Uint8Array;

  constructor(colliders: GridCollider[], options: PathfindingOptions = {}) {
    this.cellSize = options.cellSize ?? 0.5;
    const width = options.width ?? 50;
    const depth = options.depth ?? 50;
    this.maxExpansions = options.maxExpansions ?? 200;
    const inflate = options.inflate ?? 0.4;

    this.cols = Math.max(1, Math.ceil(width / this.cellSize));
    this.rows = Math.max(1, Math.ceil(depth / this.cellSize));
    this.minX = -width / 2;
    this.minZ = -depth / 2;

    this.blocked = new Uint8Array(this.cols * this.rows);
    this.buildGrid(colliders, inflate);
  }

  /** Mark every cell whose centre lies inside an (inflated) collider as blocked. */
  private buildGrid(colliders: GridCollider[], inflate: number): void {
    for (const c of colliders) {
      const minX = c.minX - inflate;
      const maxX = c.maxX + inflate;
      const minZ = c.minZ - inflate;
      const maxZ = c.maxZ + inflate;
      // Cell range whose centres could fall inside this collider.
      let cx0 = Math.floor((minX - this.minX) / this.cellSize);
      let cx1 = Math.floor((maxX - this.minX) / this.cellSize);
      let cz0 = Math.floor((minZ - this.minZ) / this.cellSize);
      let cz1 = Math.floor((maxZ - this.minZ) / this.cellSize);
      cx0 = Math.max(0, cx0);
      cz0 = Math.max(0, cz0);
      cx1 = Math.min(this.cols - 1, cx1);
      cz1 = Math.min(this.rows - 1, cz1);
      for (let cz = cz0; cz <= cz1; cz++) {
        for (let cx = cx0; cx <= cx1; cx++) {
          const wx = this.minX + (cx + 0.5) * this.cellSize;
          const wz = this.minZ + (cz + 0.5) * this.cellSize;
          if (wx >= minX && wx <= maxX && wz >= minZ && wz <= maxZ) {
            this.blocked[cz * this.cols + cx] = 1;
          }
        }
      }
    }
  }

  private inBounds(cx: number, cz: number): boolean {
    return cx >= 0 && cx < this.cols && cz >= 0 && cz < this.rows;
  }

  /** True if the cell is out of bounds or occupied by a collider. */
  isBlockedCell(cx: number, cz: number): boolean {
    if (!this.inBounds(cx, cz)) return true;
    return this.blocked[cz * this.cols + cx] === 1;
  }

  worldToCell(x: number, z: number): [number, number] {
    return [
      Math.floor((x - this.minX) / this.cellSize),
      Math.floor((z - this.minZ) / this.cellSize),
    ];
  }

  cellCenter(cx: number, cz: number): Point {
    return [
      this.minX + (cx + 0.5) * this.cellSize,
      this.minZ + (cz + 0.5) * this.cellSize,
    ];
  }

  /**
   * Find the nearest free cell to (cx, cz) within a small radius (spiral
   * search). Returns null if everything nearby is blocked.
   */
  private nearestFree(cx: number, cz: number, radius = 6): [number, number] | null {
    if (!this.isBlockedCell(cx, cz)) return [cx, cz];
    for (let r = 1; r <= radius; r++) {
      for (let dz = -r; dz <= r; dz++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
          const nx = cx + dx;
          const nz = cz + dz;
          if (!this.isBlockedCell(nx, nz)) return [nx, nz];
        }
      }
    }
    return null;
  }

  /**
   * A* from `start` to `end` (world-space [x, z]). Returns a simplified list of
   * waypoints; the first element is exactly `start` and the last is exactly
   * `end`. Returns `[start]` if start and end resolve to the same cell.
   *
   * If no full path is found within `maxExpansions`, returns a best-effort path
   * toward the explored node closest to the goal so the bot still makes
   * progress rather than freezing.
   */
  findPath(start: Point, end: Point): Point[] {
    const [sx0, sz0] = this.worldToCell(start[0], start[1]);
    const [ex0, ez0] = this.worldToCell(end[0], end[1]);

    const startCell = this.nearestFree(sx0, sz0);
    const goalCell = this.nearestFree(ex0, ez0);
    if (!startCell || !goalCell) return [start, end];

    const [sx, sz] = startCell;
    const [gx, gz] = goalCell;
    if (sx === gx && sz === gz) {
      return this.sameCellResult(start, end);
    }

    const n = this.cols * this.rows;
    const gScore = new Float64Array(n).fill(Infinity);
    const fScore = new Float64Array(n).fill(Infinity);
    const cameFrom = new Int32Array(n).fill(-1);
    const closed = new Uint8Array(n);

    const startIdx = sz * this.cols + sx;
    const goalIdx = gz * this.cols + gx;

    const heuristic = (cx: number, cz: number): number => {
      const dx = Math.abs(cx - gx);
      const dz = Math.abs(cz - gz);
      return (dx + dz) + (SQRT2 - 2) * Math.min(dx, dz);
    };

    gScore[startIdx] = 0;
    fScore[startIdx] = heuristic(sx, sz);
    const open = new MinHeap(fScore);
    open.push(startIdx);

    let expansions = 0;
    let bestIdx = startIdx;
    let bestH = heuristic(sx, sz);
    let reached = false;

    while (open.size > 0) {
      const current = open.pop();
      if (closed[current] === 1) continue;
      closed[current] = 1;

      if (current === goalIdx) {
        reached = true;
        bestIdx = goalIdx;
        break;
      }

      expansions++;
      if (expansions > this.maxExpansions) break;

      const ccx = current % this.cols;
      const ccz = (current - ccx) / this.cols;

      const h = heuristic(ccx, ccz);
      if (h < bestH) {
        bestH = h;
        bestIdx = current;
      }

      for (const [dx, dz, cost] of NEIGHBORS) {
        const nx = ccx + dx;
        const nz = ccz + dz;
        if (this.isBlockedCell(nx, nz)) continue;
        // Prevent cutting through a diagonal gap between two blocked cells.
        if (dx !== 0 && dz !== 0) {
          if (this.isBlockedCell(ccx + dx, ccz) || this.isBlockedCell(ccx, ccz + dz)) continue;
        }
        const nIdx = nz * this.cols + nx;
        if (closed[nIdx] === 1) continue;
        const tentative = gScore[current] + cost;
        if (tentative < gScore[nIdx]) {
          gScore[nIdx] = tentative;
          fScore[nIdx] = tentative + heuristic(nx, nz);
          cameFrom[nIdx] = current;
          open.push(nIdx);
        }
      }
    }

    const endIdx = reached ? goalIdx : bestIdx;
    if (endIdx === startIdx) {
      return this.sameCellResult(start, end);
    }

    // Reconstruct cell path.
    const cells: number[] = [];
    let cur = endIdx;
    while (cur !== -1) {
      cells.push(cur);
      if (cur === startIdx) break;
      cur = cameFrom[cur];
    }
    cells.reverse();

    // Convert to world waypoints; pin the exact start/end coords on the ends.
    const raw: Point[] = cells.map((idx) => {
      const cx = idx % this.cols;
      const cz = (idx - cx) / this.cols;
      return this.cellCenter(cx, cz);
    });
    raw[0] = [start[0], start[1]];
    if (reached) raw[raw.length - 1] = [end[0], end[1]];

    return this.simplify(raw);
  }

  private sameCellResult(start: Point, end: Point): Point[] {
    const dx = end[0] - start[0];
    const dz = end[1] - start[1];
    if (dx * dx + dz * dz < 1e-6) return [[start[0], start[1]]];
    return [[start[0], start[1]], [end[0], end[1]]];
  }

  /**
   * "String pull" simplification: greedily skip intermediate waypoints whose
   * span is unobstructed (clear line of sight), collapsing the grid staircase
   * into long straight runs.
   */
  simplify(path: Point[]): Point[] {
    if (path.length <= 2) return path;
    const result: Point[] = [path[0]];
    let i = 0;
    while (i < path.length - 1) {
      let j = path.length - 1;
      while (j > i + 1) {
        if (this.lineClear(path[i], path[j])) break;
        j--;
      }
      result.push(path[j]);
      i = j;
    }
    return result;
  }

  /** Sample the segment a→b and report whether every sample falls on a free cell. */
  lineClear(a: Point, b: Point): boolean {
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const dist = Math.hypot(dx, dz);
    const step = this.cellSize * 0.5;
    const steps = Math.max(1, Math.ceil(dist / step));
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const x = a[0] + dx * t;
      const z = a[1] + dz * t;
      const [cx, cz] = this.worldToCell(x, z);
      if (this.isBlockedCell(cx, cz)) return false;
    }
    return true;
  }
}
