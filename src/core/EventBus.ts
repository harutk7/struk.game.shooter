/**
 * Typed event bus for decoupled communication between game systems.
 *
 * Usage:
 *   const bus = new EventBus<GameEvents>();
 *   const unsub = bus.on('enemyKilled', (data) => { ... });
 *   bus.emit('enemyKilled', { enemyId: 'abc', points: 100 });
 *   unsub(); // remove listener
 */

export type EventHandler<T> = (data: T) => void;
type Unsubscribe = () => void;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class EventBus<Events extends Record<string, any>> {
  private listeners = new Map<keyof Events, Set<EventHandler<unknown>>>();

  /** Register a listener. Returns an unsubscribe function. */
  on<K extends keyof Events>(event: K, handler: EventHandler<Events[K]>): Unsubscribe {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler as EventHandler<unknown>);

    return () => {
      this.listeners.get(event)?.delete(handler as EventHandler<unknown>);
    };
  }

  /** Register a one-shot listener. */
  once<K extends keyof Events>(event: K, handler: EventHandler<Events[K]>): Unsubscribe {
    const wrapper: EventHandler<Events[K]> = (data) => {
      unsub();
      handler(data);
    };
    const unsub = this.on(event, wrapper);
    return unsub;
  }

  /** Emit an event to all listeners. */
  emit<K extends keyof Events>(event: K, data: Events[K]): void {
    const handlers = this.listeners.get(event);
    if (!handlers) return;

    for (const handler of handlers) {
      try {
        handler(data);
      } catch (e) {
        console.error(`EventBus error in handler for "${String(event)}":`, e);
      }
    }
  }

  /** Remove all listeners for an event, or all events if none specified. */
  clear(event?: keyof Events): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }

  /** Number of registered listeners across all events. */
  get listenerCount(): number {
    let count = 0;
    for (const set of this.listeners.values()) {
      count += set.size;
    }
    return count;
  }
}
