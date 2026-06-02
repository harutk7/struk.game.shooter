/**
 * Finite state machine for game lifecycle.
 * Valid transitions:
 *   LOADING  → MENU
 *   MENU     → PLAYING
 *   PLAYING  → PAUSED | GAME_OVER
 *   PAUSED   → PLAYING | MENU
 *   GAME_OVER → MENU
 */

export type GamePhase =
  | 'LOADING'
  | 'MENU'
  | 'PLAYING'
  | 'PAUSED'
  | 'GAME_OVER';

const VALID_TRANSITIONS: Record<GamePhase, GamePhase[]> = {
  LOADING:   ['MENU'],
  MENU:      ['PLAYING'],
  PLAYING:   ['PAUSED', 'GAME_OVER'],
  PAUSED:    ['PLAYING', 'MENU'],
  GAME_OVER: ['MENU'],
};

export type StateChangeListener = (from: GamePhase, to: GamePhase) => void;

export class GameState {
  private _phase: GamePhase = 'LOADING';
  private listeners: StateChangeListener[] = [];

  get phase(): GamePhase {
    return this._phase;
  }

  get isPlaying(): boolean {
    return this._phase === 'PLAYING';
  }

  get isPaused(): boolean {
    return this._phase === 'PAUSED';
  }

  get isMenu(): boolean {
    return this._phase === 'MENU';
  }

  get isGameOver(): boolean {
    return this._phase === 'GAME_OVER';
  }

  get isLoading(): boolean {
    return this._phase === 'LOADING';
  }

  /** Attempt a transition. Returns true if valid, false if rejected. */
  transition(to: GamePhase): boolean {
    const allowed = VALID_TRANSITIONS[this._phase];
    if (!allowed.includes(to)) {
      console.warn(
        `GameState: invalid transition ${this._phase} → ${to} (allowed: ${allowed.join(', ')})`
      );
      return false;
    }

    const from = this._phase;
    this._phase = to;

    for (const listener of this.listeners) {
      try {
        listener(from, to);
      } catch (e) {
        console.error('GameState listener error:', e);
      }
    }

    return true;
  }

  onChange(listener: StateChangeListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  /** Force-set phase (for testing / reset only — bypasses validation). */
  _forceSet(phase: GamePhase): void {
    this._phase = phase;
  }

  reset(): void {
    this._phase = 'LOADING';
  }
}
