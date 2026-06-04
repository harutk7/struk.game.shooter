/**
 * MatchHUD — deathmatch timer + scoreboard.
 *
 * Two panels:
 *   - top-center timer (M:SS) and current score
 *   - right side scoreboard (sortable list: kills, deaths, KDR)
 *
 * Pure DOM; the Game class calls update() once per frame.
 */

import type { MatchState } from '../models/MatchManager';
import { formatTime } from '../models/MatchManager';

export class MatchHUD {
  private root: HTMLDivElement;
  private timerEl: HTMLDivElement;
  private scoreLimitEl: HTMLDivElement;
  private boardEl: HTMLDivElement;
  private lastBoard: string = '';
  private lastTimer: string = '';

  constructor() {
    this.root = document.createElement('div');
    Object.assign(this.root.style, {
      position: 'fixed', top: '0', left: '0', width: '100%', pointerEvents: 'none',
      fontFamily: "'Segoe UI', Arial, sans-serif", userSelect: 'none', zIndex: '900',
    });

    // Timer panel (top center)
    this.timerEl = document.createElement('div');
    Object.assign(this.timerEl.style, {
      position: 'absolute', top: '14px', left: '50%', transform: 'translateX(-50%)',
      color: '#fff', background: 'rgba(0,0,0,0.55)', padding: '6px 18px',
      borderRadius: '6px', fontSize: '22px', fontWeight: '700', letterSpacing: '2px',
      textShadow: '0 1px 3px rgba(0,0,0,0.7)',
    });
    this.timerEl.textContent = '5:00';
    this.root.appendChild(this.timerEl);

    // Score limit line under the timer
    this.scoreLimitEl = document.createElement('div');
    Object.assign(this.scoreLimitEl.style, {
      position: 'absolute', top: '52px', left: '50%', transform: 'translateX(-50%)',
      color: '#aaa', background: 'rgba(0,0,0,0.45)', padding: '3px 10px',
      borderRadius: '4px', fontSize: '12px', letterSpacing: '1px',
    });
    this.scoreLimitEl.textContent = 'FIRST TO 20';
    this.root.appendChild(this.scoreLimitEl);

    // Scoreboard (right side)
    this.boardEl = document.createElement('div');
    Object.assign(this.boardEl.style, {
      position: 'absolute', top: '80px', right: '20px',
      color: '#fff', background: 'rgba(0,0,0,0.55)', padding: '10px 14px',
      borderRadius: '6px', minWidth: '220px', fontSize: '13px',
    });
    this.root.appendChild(this.boardEl);

    document.body.appendChild(this.root);
  }

  show(): void { this.root.style.display = 'block'; }
  hide(): void { this.root.style.display = 'none'; }

  update(state: MatchState, playerId: string): void {
    // Timer (only update DOM when changed)
    const t = formatTime(state.timer);
    if (t !== this.lastTimer) {
      this.timerEl.textContent = t;
      // Color shifts when time is low
      if (state.timer <= 30) this.timerEl.style.color = '#ff4444';
      else if (state.timer <= 60) this.timerEl.style.color = '#ffaa44';
      else this.timerEl.style.color = '#fff';
      this.lastTimer = t;
    }
    this.scoreLimitEl.textContent = `FIRST TO ${state.scoreLimit}`;

    // Scoreboard
    const sorted = [...state.players].sort((a, b) => b.kills - a.kills);
    const key = JSON.stringify({ p: sorted, t, end: state.phase });
    if (key !== this.lastBoard) {
      const rows: string[] = [];
      rows.push(
        '<div style="display:flex;gap:8px;padding-bottom:4px;border-bottom:1px solid #444;font-size:11px;color:#888;letter-spacing:1px">' +
          '<div style="flex:1">PLAYER</div><div style="width:28px;text-align:right">K</div>' +
          '<div style="width:28px;text-align:right">D</div><div style="width:36px;text-align:right">KDR</div>' +
        '</div>',
      );
      for (const p of sorted) {
        const kdr = p.deaths > 0 ? (p.kills / p.deaths).toFixed(1) : p.kills.toString();
        const r = (p.color >> 16) & 0xff;
        const g = (p.color >> 8) & 0xff;
        const b = p.color & 0xff;
        const isPlayer = p.id === playerId;
        const youTag = isPlayer ? ' <span style="color:#ffaa44;font-size:10px">(YOU)</span>' : '';
        const isWinning = state.winnerId === p.id;
        const bg = isWinning ? 'background:rgba(255,200,0,0.10);' : '';
        rows.push(
          `<div style="display:flex;gap:8px;align-items:center;padding:3px 0;${bg}">` +
            `<div style="flex:1;color:rgb(${r},${g},${b});font-weight:${isPlayer ? '700' : '500'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">` +
            `${p.name}${youTag}</div>` +
            `<div style="width:28px;text-align:right">${p.kills}</div>` +
            `<div style="width:28px;text-align:right;color:#888">${p.deaths}</div>` +
            `<div style="width:36px;text-align:right;color:#aaa">${kdr}</div>` +
          `</div>`,
        );
      }
      this.boardEl.innerHTML = rows.join('');
      this.lastBoard = key;
    }
  }

  dispose(): void {
    if (document.body.contains(this.root)) document.body.removeChild(this.root);
  }
}
