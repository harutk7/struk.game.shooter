/**
 * MatchManager — tracks deathmatch timer, score limit, win condition.
 *
 * Pure state. The Game class ticks the timer once per frame and decides
 * the win state.
 */

import { GAME_CONFIG } from '../core/GameConfig';

export interface PlayerScore {
  id: string;
  name: string;
  isPlayer: boolean;
  color: number;
  kills: number;
  deaths: number;
}

export type MatchPhase = 'active' | 'finished';

export interface MatchState {
  phase: MatchPhase;
  /** Time remaining (seconds) */
  timer: number;
  /** First-to scoreLimit (or null for unlimited) */
  scoreLimit: number;
  /** Winner's id (or null) */
  winnerId: string | null;
  /** Seconds since the match ended (for post-match display). */
  endedAt: number | null;
  /** Player roster with live kill/death tallies. */
  players: PlayerScore[];
}

export function createMatchState(playerId: string, playerName: string, playerColor: number, bots: Array<{ id: string; name: string; color: number }>): MatchState {
  const players: PlayerScore[] = [
    { id: playerId, name: playerName, isPlayer: true, color: playerColor, kills: 0, deaths: 0 },
  ];
  for (const b of bots) {
    players.push({ id: b.id, name: b.name, isPlayer: false, color: b.color, kills: 0, deaths: 0 });
  }
  return {
    phase: 'active',
    timer: GAME_CONFIG.match.timeLimit,
    scoreLimit: GAME_CONFIG.match.scoreLimit,
    winnerId: null,
    endedAt: null,
    players,
  };
}

/** Tick the match timer once. Returns the new state. */
export function tickMatch(state: MatchState, dt: number): MatchState {
  if (state.phase !== 'active') return state;
  const next = { ...state, timer: Math.max(0, state.timer - dt) };
  if (next.timer <= 0) {
    return finishMatch(next, pickWinner(next.players));
  }
  // Check score limit
  for (const p of next.players) {
    if (p.kills >= next.scoreLimit) {
      return finishMatch(next, p.id);
    }
  }
  return next;
}

/** Add a kill for `killerId` and a death for `victimId`. */
export function registerKillEvent(state: MatchState, killerId: string | null, victimId: string | null): MatchState {
  if (state.phase !== 'active') return state;
  const players = state.players.map((p) => {
    let nk = p.kills;
    let nd = p.deaths;
    if (killerId === p.id) nk += 1;
    if (victimId === p.id) nd += 1;
    return { ...p, kills: nk, deaths: nd };
  });
  let next: MatchState = { ...state, players };
  for (const p of players) {
    if (p.kills >= next.scoreLimit) {
      return finishMatch(next, p.id);
    }
  }
  return next;
}

function pickWinner(players: PlayerScore[]): string | null {
  let best: PlayerScore | null = null;
  for (const p of players) {
    if (!best || p.kills > best.kills) best = p;
  }
  return best?.id ?? null;
}

function finishMatch(state: MatchState, winnerId: string | null): MatchState {
  return {
    ...state,
    phase: 'finished',
    winnerId,
    endedAt: 0,
  };
}

export function formatTime(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
