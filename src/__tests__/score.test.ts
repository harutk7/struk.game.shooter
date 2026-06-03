import { describe, it, expect } from 'vitest';
import { createScoreState, addKill, tickCombo, resetScore } from '../models/ScoreManager';

describe('ScoreManager', () => {
  /* ── Creation ── */
  it('starts at zero', () => {
    const s = createScoreState();
    expect(s.score).toBe(0);
    expect(s.kills).toBe(0);
    expect(s.combo).toBe(0);
    expect(s.maxComboReached).toBe(0);
    expect(s.lastKillTime).toBe(0);
  });

  /* ── addKill ── */
  it('adds first kill with base points', () => {
    const s = createScoreState();
    const r = addKill(s, 100, 1);
    expect(r.state.score).toBe(100);
    expect(r.state.kills).toBe(1);
    expect(r.state.combo).toBe(1);
    expect(r.pointsAwarded).toBe(100);
    expect(r.comboActive).toBe(false);
  });

  it('builds combo on rapid kills', () => {
    let s = createScoreState();
    const r1 = addKill(s, 100, 1);
    s = r1.state;
    const r2 = addKill(s, 100, 1.5);
    expect(r2.state.combo).toBe(2);
    expect(r2.pointsAwarded).toBe(200);
    expect(r2.comboActive).toBe(true);
  });

  it('combo multiplies to x3', () => {
    let s = createScoreState();
    s = addKill(s, 100, 1).state;
    s = addKill(s, 100, 1.5).state;
    const r3 = addKill(s, 100, 2);
    expect(r3.state.combo).toBe(3);
    expect(r3.pointsAwarded).toBe(300);
  });

  it('combo caps at x5', () => {
    let s = createScoreState();
    for (let i = 0; i < 10; i++) {
      s = addKill(s, 100, i + 1).state;
    }
    expect(s.combo).toBe(5);
    expect(s.maxComboReached).toBe(5);
  });

  it('combo resets after window expires', () => {
    let s = createScoreState();
    s = addKill(s, 100, 1).state;
    s = addKill(s, 100, 1.5).state;
    const r3 = addKill(s, 100, 5);
    expect(r3.state.combo).toBe(1);
    expect(r3.pointsAwarded).toBe(100);
  });

  it('combo resets exactly at window boundary', () => {
    let s = createScoreState();
    s = addKill(s, 100, 1).state;
    const r2 = addKill(s, 100, 3.01);
    expect(r2.state.combo).toBe(1);
  });

  it('combo continues within window', () => {
    let s = createScoreState();
    s = addKill(s, 100, 1).state;
    const r2 = addKill(s, 100, 2.99);
    expect(r2.state.combo).toBe(2);
  });

  it('different point values work', () => {
    const s = createScoreState();
    const r = addKill(s, 300, 1);
    expect(r.state.score).toBe(300);
    expect(r.pointsAwarded).toBe(300);
  });

  it('combo multiplies different point values', () => {
    let s = createScoreState();
    s = addKill(s, 100, 1).state;
    const r2 = addKill(s, 300, 1.5);
    expect(r2.pointsAwarded).toBe(600);
    expect(r2.state.score).toBe(700);
  });

  it('tracks maxComboReached', () => {
    let s = createScoreState();
    s = addKill(s, 100, 1).state;
    s = addKill(s, 100, 1.5).state;
    s = addKill(s, 100, 2).state;
    expect(s.maxComboReached).toBe(3);
    s = addKill(s, 100, 5).state;
    expect(s.maxComboReached).toBe(3);
  });

  /* ── tickCombo ── */
  it('tickCombo expires combo after window', () => {
    let s = createScoreState();
    s = addKill(s, 100, 1).state;
    s = tickCombo(s, 5);
    expect(s.combo).toBe(0);
  });

  it('tickCombo keeps combo within window', () => {
    let s = createScoreState();
    s = addKill(s, 100, 1).state;
    s = tickCombo(s, 2);
    expect(s.combo).toBe(1);
  });

  it('tickCombo on zero combo is no-op', () => {
    const s = createScoreState();
    const t = tickCombo(s, 100);
    expect(t.combo).toBe(0);
  });

  /* ── resetScore ── */
  it('resetScore returns fresh state', () => {
    let s = createScoreState();
    s = addKill(s, 100, 1).state;
    s = addKill(s, 100, 1.5).state;
    const r = resetScore();
    expect(r.score).toBe(0);
    expect(r.kills).toBe(0);
    expect(r.combo).toBe(0);
    expect(r.maxComboReached).toBe(0);
  });

  /* ── Edge cases ── */
  it('zero-point kill', () => {
    const s = createScoreState();
    const r = addKill(s, 0, 1);
    expect(r.state.score).toBe(0);
    expect(r.pointsAwarded).toBe(0);
  });

  it('negative points (should not happen but handled)', () => {
    const s = createScoreState();
    const r = addKill(s, -50, 1);
    expect(r.state.score).toBe(-50);
  });

  it('very large score accumulation', () => {
    let s = createScoreState();
    for (let i = 0; i < 100; i++) {
      s = addKill(s, 100, i * 3 + 1).state;
    }
    expect(s.kills).toBe(100);
    expect(s.score).toBeGreaterThanOrEqual(10000);
  });

  it('lastKillTime updates on each kill', () => {
    const s = createScoreState();
    const r1 = addKill(s, 100, 1);
    expect(r1.state.lastKillTime).toBe(1);
    const r2 = addKill(r1.state, 100, 3.5);
    expect(r2.state.lastKillTime).toBe(3.5);
  });
});
