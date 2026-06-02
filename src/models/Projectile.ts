/**
 * Pure-data projectile model. Used for hitscan results and visual trails.
 */

export interface ProjectileData {
  id: string;
  origin: { x: number; y: number; z: number };
  direction: { x: number; y: number; z: number };
  distance: number;
  damage: number;
  hit: boolean;
  hitPoint?: { x: number; y: number; z: number };
  hitNormal?: { x: number; y: number; z: number };
  hitObjectId?: string;
  timestamp: number;
}

let projectileId = 0;

export function createProjectile(
  origin: { x: number; y: number; z: number },
  direction: { x: number; y: number; z: number },
  distance: number,
  damage: number,
): ProjectileData {
  return {
    id: `proj_${++projectileId}`,
    origin: { ...origin },
    direction: { ...direction },
    distance,
    damage,
    hit: false,
    timestamp: performance.now(),
  };
}

export function markProjectileHit(
  proj: ProjectileData,
  point: { x: number; y: number; z: number },
  normal?: { x: number; y: number; z: number },
  objectId?: string,
): ProjectileData {
  return {
    ...proj,
    hit: true,
    hitPoint: { ...point },
    hitNormal: normal ? { ...normal } : undefined,
    hitObjectId: objectId,
  };
}

export function resetProjectileIdCounter(): void {
  projectileId = 0;
}
