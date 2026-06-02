export class GameOverScreen {
  private element: HTMLDivElement;
  private scoreText: HTMLSpanElement;
  private waveText: HTMLSpanElement;
  private killsText: HTMLSpanElement;
  private onRestart: (() => void) | null = null;

  constructor() {
    this.element = document.createElement('div');
    this.scoreText = document.createElement('span');
    this.waveText = document.createElement('span');
    this.killsText = document.createElement('span');
    Object.assign(this.element.style, {
      position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
      backgroundColor: 'rgba(0,0,0,0.8)', display: 'none',
      flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
      zIndex: '3000', fontFamily: "'Segoe UI', Arial, sans-serif", userSelect: 'none',
    });
    const title = document.createElement('h1');
    title.textContent = 'GAME OVER';
    Object.assign(title.style, { color: '#F44336', fontSize: 'clamp(32px, 6vw, 56px)', fontWeight: '900', letterSpacing: '6px', marginBottom: '30px', textShadow: '0 0 30px rgba(244,67,54,0.4)' });
    this.element.appendChild(title);
    const stats = document.createElement('div');
    Object.assign(stats.style, { display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '40px', textAlign: 'center' });
    const sr = (l: string, e: HTMLSpanElement) => { const r = document.createElement('div'); const lb = document.createElement('span'); lb.textContent = l; Object.assign(lb.style, { color: '#888', fontSize: '14px', letterSpacing: '2px', marginRight: '12px' }); Object.assign(e.style, { color: '#fff', fontSize: '28px', fontWeight: '700' }); r.append(lb, e); return r; };
    this.scoreText.textContent = '0'; this.waveText.textContent = '1'; this.killsText.textContent = '0';
    stats.append(sr('SCORE', this.scoreText), sr('WAVE', this.waveText), sr('KILLS', this.killsText));
    this.element.appendChild(stats);
    const btn = document.createElement('button');
    btn.textContent = 'PLAY AGAIN';
    Object.assign(btn.style, { padding: '14px 40px', fontSize: '18px', fontWeight: '700', backgroundColor: '#ff6600', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', letterSpacing: '2px' });
    btn.addEventListener('click', () => this.onRestart?.());
    this.element.appendChild(btn);
  }

  show(score: number, wave: number, kills: number): void {
    this.scoreText.textContent = `${score}`; this.waveText.textContent = `${wave}`; this.killsText.textContent = `${kills}`;
    if (!document.body.contains(this.element)) document.body.appendChild(this.element);
    this.element.style.display = 'flex';
  }
  hide(): void { this.element.style.display = 'none'; }
  setOnRestart(cb: () => void): void { this.onRestart = cb; }
  dispose(): void { if (document.body.contains(this.element)) document.body.removeChild(this.element); }
}
