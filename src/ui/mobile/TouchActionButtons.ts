export interface ActionButtonState { shoot: boolean; reload: boolean; jump: boolean; }

export class TouchActionButtons {
  private container: HTMLDivElement;
  private shootBtn: HTMLDivElement;
  private reloadBtn: HTMLDivElement;
  private jumpBtn: HTMLDivElement;
  private state: ActionButtonState = { shoot: false, reload: false, jump: false };

  constructor() {
    this.container = document.createElement('div');
    this.shootBtn = document.createElement('div');
    this.reloadBtn = document.createElement('div');
    this.jumpBtn = document.createElement('div');
    Object.assign(this.container.style, { position: 'fixed', bottom: '40px', right: '40px', display: 'none', flexDirection: 'column', gap: '12px', zIndex: '2000' });
    this.makeBtn(this.shootBtn, 'shoot', 75, '#ff4444', '🔫');
    this.makeBtn(this.jumpBtn, 'jump', 55, '#4444ff', '⬆');
    this.makeBtn(this.reloadBtn, 'reload', 50, '#44aa44', '↻');
    const tr = document.createElement('div');
    Object.assign(tr.style, { display: 'flex', gap: '10px', justifyContent: 'flex-end' });
    tr.append(this.reloadBtn, this.jumpBtn);
    this.container.append(tr, this.shootBtn);
  }

  private makeBtn(el: HTMLDivElement, action: keyof ActionButtonState, size: number, color: string, icon: string): void {
    Object.assign(el.style, { width: `${size}px`, height: `${size}px`, borderRadius: '50%', backgroundColor: color, opacity: '0.65', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: `${size * 0.4}px`, userSelect: 'none', touchAction: 'none', border: '2px solid rgba(255,255,255,0.4)', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', transition: 'transform 0.1s, opacity 0.1s' });
    el.textContent = icon;
    el.addEventListener('touchstart', (e) => { e.preventDefault(); this.state[action] = true; el.style.transform = 'scale(0.85)'; el.style.opacity = '1'; }, { passive: false });
    el.addEventListener('touchend', (e) => { e.preventDefault(); this.state[action] = false; el.style.transform = 'scale(1)'; el.style.opacity = '0.65'; }, { passive: false });
    el.addEventListener('touchcancel', (e) => { e.preventDefault(); this.state[action] = false; el.style.transform = 'scale(1)'; el.style.opacity = '0.65'; }, { passive: false });
  }

  getState(): ActionButtonState { return { ...this.state }; }
  show(): void { if (!document.body.contains(this.container)) document.body.appendChild(this.container); this.container.style.display = 'flex'; }
  hide(): void { this.container.style.display = 'none'; }
  dispose(): void { if (document.body.contains(this.container)) document.body.removeChild(this.container); }
}
