interface KillEntry { element: HTMLDivElement; createdAt: number; lifetime: number; }

export class KillFeed {
  private container: HTMLDivElement;
  private entries: KillEntry[] = [];
  private readonly MAX = 5;
  private readonly LIFE = 3500;

  constructor() {
    this.container = document.createElement('div');
    Object.assign(this.container.style, {
      position: 'fixed', top: '80px', right: '20px',
      display: 'flex', flexDirection: 'column', gap: '4px',
      pointerEvents: 'none', zIndex: '1000',
      fontFamily: "'Segoe UI', Arial, sans-serif", userSelect: 'none',
    });
    document.body.appendChild(this.container);
  }

  /** Wave-mode kill feed. */
  addKill(points: number, enemyName: string, combo: number): void {
    const el = document.createElement('div');
    const cs = combo > 1 ? ` x${combo}` : '';
    el.textContent = `+${points} ${enemyName.toUpperCase()}${cs}`;
    Object.assign(el.style, {
      color: combo > 1 ? '#ffaa00' : '#fff',
      fontSize: combo > 1 ? '16px' : '14px',
      fontWeight: combo > 1 ? '700' : '500',
      textShadow: '0 1px 4px rgba(0,0,0,0.5)',
      opacity: '1', transition: 'opacity 0.3s, transform 0.3s', transform: 'translateY(0)',
    });
    this.container.appendChild(el);
    this.entries.push({ element: el, createdAt: performance.now(), lifetime: this.LIFE });
    requestAnimationFrame(() => { el.style.transform = 'translateY(-8px)'; });
    while (this.entries.length > this.MAX) this.removeEntry(this.entries[0]);
  }

  /**
   * Deathmatch kill feed entry.
   * Format: `<Killer>  [WEAPON]  <Victim>` with per-row colors.
   *   killer: green (#88ff88)
   *   victim: red (#ff8888)
   *   weapon: yellow accent
   */
  addDeathmatchKill(killerName: string, victimName: string, weaponName: string, killerIsPlayer: boolean, victimIsPlayer: boolean): void {
    const el = document.createElement('div');
    el.innerHTML =
      `<span style="color:${killerIsPlayer ? '#ffffff' : '#88ff88'};font-weight:700">${escapeHtml(killerName)}</span>` +
      ` <span style="color:#ffaa00;font-size:11px;padding:0 6px">[${escapeHtml(weaponName)}]</span> ` +
      `<span style="color:${victimIsPlayer ? '#ffffff' : '#ff8888'};font-weight:700">${escapeHtml(victimName)}</span>`;
    Object.assign(el.style, {
      background: 'rgba(0,0,0,0.45)',
      padding: '3px 8px',
      borderRadius: '3px',
      fontSize: '13px',
      letterSpacing: '0.5px',
      opacity: '1',
      transition: 'opacity 0.3s, transform 0.3s',
      transform: 'translateY(0)',
      textShadow: '0 1px 3px rgba(0,0,0,0.7)',
    });
    this.container.appendChild(el);
    this.entries.push({ element: el, createdAt: performance.now(), lifetime: this.LIFE });
    requestAnimationFrame(() => { el.style.transform = 'translateY(-8px)'; });
    while (this.entries.length > this.MAX) this.removeEntry(this.entries[0]);
  }

  tick(now: number): void {
    for (let i = this.entries.length - 1; i >= 0; i--) {
      const e = this.entries[i];
      const p = (now - e.createdAt) / e.lifetime;
      if (p >= 1) this.removeEntry(e);
      else if (p > 0.7) e.element.style.opacity = `${1 - (p - 0.7) / 0.3}`;
    }
  }

  private removeEntry(e: KillEntry): void {
    const idx = this.entries.indexOf(e);
    if (idx !== -1) this.entries.splice(idx, 1);
    if (this.container.contains(e.element)) this.container.removeChild(e.element);
  }

  dispose(): void {
    for (const e of [...this.entries]) this.removeEntry(e);
    if (document.body.contains(this.container)) document.body.removeChild(this.container);
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
