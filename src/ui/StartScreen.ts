export class StartScreen {
  private element: HTMLDivElement;
  private onClick: (() => void) | null = null;
  private boundClick: (() => void) | null = null;
  private boundTouch: ((e: TouchEvent) => void) | null = null;

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
        '<br>3 Weapons: Pistol &bull; Assault Rifle &bull; Shotgun';
    } else {
      ctrl.innerHTML =
        'WASD Move &bull; Mouse Look &bull; Click Shoot &bull; R Reload' +
        '<br>Space Jump &bull; Shift Sprint &bull; 1/2/3 or Scroll Switch Weapon &bull; Esc Pause' +
        '<br>3 Weapons: 1=Pistol &bull; 2=Assault Rifle &bull; 3=Shotgun';
    }
    Object.assign(ctrl.style, {
      color: '#555', fontSize: 'clamp(11px, 1.8vw, 13px)', marginTop: '50px',
      textAlign: 'center', maxWidth: '480px', lineHeight: '1.8',
    });
    this.element.appendChild(ctrl);

    const style = document.createElement('style');
    style.textContent =
      '@keyframes strukPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.4;transform:scale(1.05)}}';
    document.head.appendChild(style);
  }

  setOnClick(cb: () => void): void {
    this.onClick = cb;
    this.boundClick = () => this.onClick?.();
    this.boundTouch = (e: TouchEvent) => { e.preventDefault(); this.onClick?.(); };
    this.element.addEventListener('click', this.boundClick);
    this.element.addEventListener('touchstart', this.boundTouch, { passive: false });
  }

  show(): void {
    if (!document.body.contains(this.element)) document.body.appendChild(this.element);
    this.element.style.display = 'flex';
  }

  hide(): void { this.element.style.display = 'none'; }

  dispose(): void {
    if (this.boundClick) this.element.removeEventListener('click', this.boundClick);
    if (this.boundTouch) this.element.removeEventListener('touchstart', this.boundTouch);
    if (document.body.contains(this.element)) document.body.removeChild(this.element);
  }
}
