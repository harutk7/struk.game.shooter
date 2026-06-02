import { describe, it, expect } from 'vitest';
import { createScoreState, addKill, tickCombo } from '../models/ScoreManager';

describe('ScoreManager', () => {
  it('starts at zero', () => {
    const s = createScoreState();
    expect(s.score).toBe(0);
    expect(s.kills).toBe(0);
    expect(s.combo).toBe(0);
  });

  it('adds kill with base points', () => {
    const s = createScoreState();
    const r = addKill(s, 100, 1);
    expect(r.state.score).toBe(100);
    expect(r.state.kills).toBe(1);
    expect(r.pointsAwarded).toBe(100);
  });

  it('builds combo', () => {
    let s = createScoreState();
    const r1 = addKill(s, 100, 1);
    s = r1.state;
    const r2 = addKill(s, 100, 2);
    expect(r2.state.combo).toBe(2);
    expect(r2.pointsAwarded).toBe(200);
  });

  it('combo expires', () => {
    let s = createScoreState();
    const r1 = addKill(s, 100, 1);
    s = r1.state;
    s = tickCombo(s, 5);
    expect(s.combo).toBe(0);
  });

  it('max combo capped at 5', () => {
    let s = createScoreState();
    for (let i = 0; i < 10; i++) {
      s = addKill(s, 100, i + 1).state;
    }
    expect(s.maxComboReached).toBe(5);
  });
});
