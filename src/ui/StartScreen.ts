export class StartScreen {
  private element: HTMLDivElement;
  private onClick: (() => void) | null = null;
  private onDeathmatchClick: (() => void) | null = null;
  private boundClick: (() => void) | null = null;
  private boundTouch: ((e: TouchEvent) => void) | null = null;
  private dmBound: (() => void) | null = null;
  private dmButton: HTMLButtonElement | null = null;

  constructor() {
    this.element = document.createElement('div');
    Object.assign(this.element.style, {
      position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
      backgroundColor: 'rgba(0,0,0,0.82)', display: 'flex',
      flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
      zIndex: '2000', cursor: 'pointer', fontFamily: "'Segoe UI', Arial, sans-serif",
      userSelect: 'none', padding: '20px', boxSizing: 'border-box',
    });

    const title = document.createElement('h1');
    title.textContent = 'STRUK';
    Object.assign(title.style, {
      color: '#fff', fontSize: 'clamp(36px, 8vw, 72px)', fontWeight: '900',
      letterSpacing: '8px', marginBottom: '4px',
      textShadow: '0 0 40px rgba(255,100,0,0.5), 0 4px 8px rgba(0,0,0,0.5)',
    });
    this.element.appendChild(title);

    const sub = document.createElement('h2');
    sub.textContent = 'SHOOTER';
    Object.assign(sub.style, {
      color: '#ff6600', fontSize: 'clamp(16px, 3vw, 28px)', fontWeight: '300',
      letterSpacing: '12px', marginBottom: '40px',
    });
    this.element.appendChild(sub);

    const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    const cta = document.createElement('p');
    cta.textContent = isMobile ? 'TAP TO PLAY' : 'CLICK TO PLAY';
    Object.assign(cta.style, {
      color: '#aaa', fontSize: 'clamp(14px, 2.5vw, 18px)', letterSpacing: '3px',
      animation: 'strukPulse 2s ease-in-out infinite',
    });
    this.element.appendChild(cta);

    const ctrl = document.createElement('p');
    if (isMobile) {
      ctrl.innerHTML =
        'Left Joystick Move &bull; Right Drag Look' +
        '<br>🔫 Shoot &bull; ⬆ Jump &bull; ↻ Reload &bull; ⇄ Cycle Weapon &bull; ⏸ Pause' +
        '<br>4 Weapons: Pistol &bull; Rifle &bull; Shotgun &bull; Sniper';
    } else {
      ctrl.innerHTML =
        'WASD Move &bull; Mouse Look &bull; Click Shoot &bull; R Reload' +
        '<br>Space Jump &bull; Shift Sprint &bull; Ctrl/C Crouch &bull; 1-4 or Scroll Switch' +
        '<br>4 Weapons: 1=Pistol &bull; 2=Rifle &bull; 3=Shotgun &bull; 4=Sniper';
    }
    Object.assign(ctrl.style, {
      color: '#555', fontSize: 'clamp(11px, 1.8vw, 13px)', marginTop: '40px',
      textAlign: 'center', maxWidth: '480px', lineHeight: '1.8',
    });
    this.element.appendChild(ctrl);

    // ── Mode buttons (added in T4) ──
    const buttonRow = document.createElement('div');
    Object.assign(buttonRow.style, {
      display: 'flex', gap: '20px', marginTop: '30px', flexWrap: 'wrap',
      justifyContent: 'center',
    });
    this.element.appendChild(buttonRow);

    const wavesBtn = document.createElement('button');
    wavesBtn.textContent = 'WAVES (Classic)';
    Object.assign(wavesBtn.style, this.buttonStyle('#888'));
    wavesBtn.addEventListener('click', (e) => { e.stopPropagation(); this.onClick?.(); });
    buttonRow.appendChild(wavesBtn);

    const dmBtn = document.createElement('button');
    dmBtn.textContent = 'DEATHMATCH vs BOTS';
    Object.assign(dmBtn.style, this.buttonStyle('#ff6600'));
    this.dmBound = (e?: Event) => { e?.stopPropagation(); this.onDeathmatchClick?.(); };
    dmBtn.addEventListener('click', this.dmBound);
    this.dmButton = dmBtn;
    buttonRow.appendChild(dmBtn);

    const style = document.createElement('style');
    style.textContent =
      '@keyframes strukPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.4;transform:scale(1.05)}}';
    document.head.appendChild(style);
  }

  private buttonStyle(color: string): Partial<CSSStyleDeclaration> {
    return {
      color: '#fff',
      background: `linear-gradient(180deg, ${color} 0%, ${this.shade(color, -0.4)} 100%)`,
      border: `1px solid ${this.shade(color, -0.2)}`,
      padding: '14px 28px',
      fontSize: 'clamp(13px, 2.2vw, 16px)',
      fontWeight: '700',
      letterSpacing: '2px',
      borderRadius: '4px',
      cursor: 'pointer',
      fontFamily: "'Segoe UI', Arial, sans-serif",
      textTransform: 'uppercase',
      boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
      transition: 'transform 0.1s, box-shadow 0.1s',
    };
  }

  private shade(hex: string, amt: number): string {
    const n = parseInt(hex.replace('#', ''), 16);
    let r = (n >> 16) & 0xff, g = (n >> 8) & 0xff, b = n & 0xff;
    r = Math.max(0, Math.min(255, Math.floor(r + (amt < 0 ? r * amt : (255 - r) * amt))));
    g = Math.max(0, Math.min(255, Math.floor(g + (amt < 0 ? g * amt : (255 - g) * amt))));
    b = Math.max(0, Math.min(255, Math.floor(b + (amt < 0 ? b * amt : (255 - b) * amt))));
    return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
  }

  setOnClick(cb: () => void): void {
    this.onClick = cb;
    this.boundClick = () => this.onClick?.();
    this.boundTouch = (e: TouchEvent) => { e.preventDefault(); this.onClick?.(); };
    this.element.addEventListener('click', this.boundClick);
    this.element.addEventListener('touchstart', this.boundTouch, { passive: false });
  }

  /** Set the click handler for the "DEATHMATCH" button. */
  setOnDeathmatchClick(cb: () => void): void {
    this.onDeathmatchClick = cb;
    // (re-)bind in case the button was added before this is called
    if (this.dmButton && this.dmBound) {
      this.dmButton.removeEventListener('click', this.dmBound);
    }
    this.dmBound = (e?: Event) => { e?.stopPropagation(); this.onDeathmatchClick?.(); };
    this.dmButton?.addEventListener('click', this.dmBound);
  }

  show(): void {
    if (!document.body.contains(this.element)) document.body.appendChild(this.element);
    this.element.style.display = 'flex';
  }

  hide(): void { this.element.style.display = 'none'; }

  dispose(): void {
    if (this.boundClick) this.element.removeEventListener('click', this.boundClick);
    if (this.boundTouch) this.element.removeEventListener('touchstart', this.boundTouch);
    if (this.dmButton && this.dmBound) this.dmButton.removeEventListener('click', this.dmBound);
    if (document.body.contains(this.element)) document.body.removeChild(this.element);
  }
}
