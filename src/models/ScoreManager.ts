/**
 * Score manager with combo system.
 * Kills within the combo window increase a multiplier (up to max).
 */

import { GAME_CONFIG } from '../core/GameConfig';

export interface ScoreState {
  score: number;
  kills: number;
  combo: number;
  maxComboReached: number;
  lastKillTime: number;
}

export function createScoreState(): ScoreState {
  return {
    score: 0,
    kills: 0,
    combo: 0,
    maxComboReached: 0,
    lastKillTime: 0,
  };
}

export function addKill(score: ScoreState, basePoints: number, now: number): {
  state: ScoreState;
  pointsAwarded: number;
  comboActive: boolean;
} {
  const comboWindow = GAME_CONFIG.scoring.comboWindow;
  const maxMultiplier = GAME_CONFIG.scoring.maxComboMultiplier;

  const inComboWindow = (now - score.lastKillTime) <= comboWindow;
  const newCombo = inComboWindow ? Math.min(score.combo + 1, maxMultiplier) : 1;
  const multiplier = newCombo;
  const pointsAwarded = basePoints * multiplier;

  return {
    state: {
      score: score.score + pointsAwarded,
      kills: score.kills + 1,
      combo: newCombo,
      maxComboReached: Math.max(score.maxComboReached, newCombo),
      lastKillTime: now,
    },
    pointsAwarded,
    comboActive: newCombo > 1,
  };
}

export function tickCombo(score: ScoreState, now: number): ScoreState {
  const comboWindow = GAME_CONFIG.scoring.comboWindow;
  if (score.combo > 0 && (now - score.lastKillTime) > comboWindow) {
    return { ...score, combo: 0 };
  }
  return score;
}

export function resetScore(): ScoreState {
  return createScoreState();
}
