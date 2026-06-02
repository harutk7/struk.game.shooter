/**
 * Object pool utility for reusing Three.js objects.
 * Avoids GC pressure from constant create/destroy cycles.
 */

type Factory<T> = () => T;
type Reset<T> = (item: T) => void;

export class ObjectPool<T> {
  private available: T[] = [];
  private active: T[] = [];
  private factory: Factory<T>;
  private reset: Reset<T>;
  private maxSize: number;

  constructor(factory: Factory<T>, reset: Reset<T>, maxSize = 50) {
    this.factory = factory;
    this.reset = reset;
    this.maxSize = maxSize;
  }

  acquire(): T {
    let item: T;
    if (this.available.length > 0) {
      item = this.available.pop()!;
    } else {
      item = this.factory();
    }
    this.active.push(item);
    return item;
  }

  release(item: T): void {
    const idx = this.active.indexOf(item);
    if (idx !== -1) {
      this.active.splice(idx, 1);
    }

    this.reset(item);

    if (this.available.length < this.maxSize) {
      this.available.push(item);
    }
  }

  releaseAll(): void {
    while (this.active.length > 0) {
      this.release(this.active[0]);
    }
  }

  getActive(): T[] {
    return this.active;
  }

  get activeCount(): number {
    return this.active.length;
  }

  clear(): void {
    this.available = [];
    this.active = [];
  }
}
