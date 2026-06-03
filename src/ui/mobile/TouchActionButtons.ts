export interface ActionButtonState {
  shoot: boolean;
  reload: boolean;
  jump: boolean;
  weaponSwitch: number; // 1 = next, 0 = none
}

export class TouchActionButtons {
  private container: HTMLDivElement;
  private shootBtn: HTMLDivElement;
  private reloadBtn: HTMLDivElement;
  private jumpBtn: HTMLDivElement;
  private weaponBtn: HTMLDivElement;
  private pauseBtn: HTMLDivElement;
  private state: ActionButtonState = { shoot: false, reload: false, jump: false, weaponSwitch: 0 };
  private pauseJustPressed = false;

  constructor() {
    this.container = document.createElement('div');
    this.shootBtn = document.createElement('div');
    this.reloadBtn = document.createElement('div');
    this.jumpBtn = document.createElement('div');
    this.weaponBtn = document.createElement('div');
    this.pauseBtn = document.createElement('div');

    Object.assign(this.container.style, {
      position: 'fixed', bottom: '40px', right: '40px',
      display: 'none', flexDirection: 'column', gap: '10px', zIndex: '2000',
    });

    this.makeBtn(this.shootBtn, 'shoot', 72, 'rgba(220,50,50,0.75)', '🔫');
    this.makeBtn(this.jumpBtn, 'jump', 52, 'rgba(50,50,220,0.75)', '⬆');
    this.makeBtn(this.reloadBtn, 'reload', 48, 'rgba(50,160,50,0.75)', '↻');

    // Weapon switch button (edge-triggered, cycles to next weapon)
    this.makeWeaponBtn();

    const topRow = document.createElement('div');
    Object.assign(topRow.style, { display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' });
    topRow.append(this.weaponBtn, this.reloadBtn, this.jumpBtn);
    this.container.append(topRow, this.shootBtn);

    // Pause button — top-left corner, separate from main container
    Object.assign(this.pauseBtn.style, {
      position: 'fixed', top: '20px', left: '20px',
      width: '44px', height: '44px', borderRadius: '8px',
      backgroundColor: 'rgba(0,0,0,0.55)', opacity: '0.8',
      display: 'none', justifyContent: 'center', alignItems: 'center',
      fontSize: '20px', userSelect: 'none', touchAction: 'none',
      border: '2px solid rgba(255,255,255,0.35)',
      boxShadow: '0 2px 8px rgba(0,0,0,0.4)', zIndex: '2000',
    });
    this.pauseBtn.textContent = '⏸';
    this.pauseBtn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.pauseJustPressed = true;
      this.pauseBtn.style.opacity = '1';
    }, { passive: false });
    this.pauseBtn.addEventListener('touchend', (e) => {
      e.preventDefault();
      this.pauseBtn.style.opacity = '0.8';
    }, { passive: false });
    this.pauseBtn.addEventListener('touchcancel', (e) => {
      e.preventDefault();
      this.pauseBtn.style.opacity = '0.8';
    }, { passive: false });
  }

  private makeBtn(
    el: HTMLDivElement,
    action: keyof Omit<ActionButtonState, 'weaponSwitch'>,
    size: number,
    color: string,
    icon: string,
  ): void {
    Object.assign(el.style, {
      width: `${size}px`, height: `${size}px`, borderRadius: '50%',
      backgroundColor: color, opacity: '0.7',
      display: 'flex', justifyContent: 'center', alignItems: 'center',
      fontSize: `${Math.round(size * 0.38)}px`, userSelect: 'none', touchAction: 'none',
      border: '2px solid rgba(255,255,255,0.4)',
      boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
      transition: 'transform 0.08s, opacity 0.08s',
    });
    el.textContent = icon;
    el.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.state[action] = true;
      el.style.transform = 'scale(0.85)'; el.style.opacity = '1';
    }, { passive: false });
    el.addEventListener('touchend', (e) => {
      e.preventDefault();
      this.state[action] = false;
      el.style.transform = 'scale(1)'; el.style.opacity = '0.7';
    }, { passive: false });
    el.addEventListener('touchcancel', (e) => {
      e.preventDefault();
      this.state[action] = false;
      el.style.transform = 'scale(1)'; el.style.opacity = '0.7';
    }, { passive: false });
  }

  private makeWeaponBtn(): void {
    const size = 44;
    Object.assign(this.weaponBtn.style, {
      width: `${size}px`, height: `${size}px`, borderRadius: '8px',
      backgroundColor: 'rgba(200,150,50,0.75)', opacity: '0.75',
      display: 'flex', justifyContent: 'center', alignItems: 'center',
      fontSize: '16px', userSelect: 'none', touchAction: 'none',
      border: '2px solid rgba(255,255,255,0.4)',
      boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
      transition: 'transform 0.08s, opacity 0.08s',
      color: '#fff', fontWeight: '700',
    });
    this.weaponBtn.textContent = '⇄';
    this.weaponBtn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      // Edge-triggered: set to 1 for one poll cycle
      this.state.weaponSwitch = 1;
      this.weaponBtn.style.transform = 'scale(0.85)'; this.weaponBtn.style.opacity = '1';
    }, { passive: false });
    this.weaponBtn.addEventListener('touchend', (e) => {
      e.preventDefault();
      this.weaponBtn.style.transform = 'scale(1)'; this.weaponBtn.style.opacity = '0.75';
    }, { passive: false });
    this.weaponBtn.addEventListener('touchcancel', (e) => {
      e.preventDefault();
      this.weaponBtn.style.transform = 'scale(1)'; this.weaponBtn.style.opacity = '0.75';
    }, { passive: false });
  }

  /** Returns true if pause was just pressed since the last call, then resets the flag. */
  consumePause(): boolean {
    const pressed = this.pauseJustPressed;
    this.pauseJustPressed = false;
    return pressed;
  }

  /** Returns current state; resets edge-triggered fields. */
  getState(): ActionButtonState {
    const s = { ...this.state };
    this.state.weaponSwitch = 0; // Reset after reading
    return s;
  }

  show(): void {
    if (!document.body.contains(this.container)) document.body.appendChild(this.container);
    this.container.style.display = 'flex';
    if (!document.body.contains(this.pauseBtn)) document.body.appendChild(this.pauseBtn);
    this.pauseBtn.style.display = 'flex';
  }

  hide(): void {
    this.container.style.display = 'none';
    this.pauseBtn.style.display = 'none';
  }

  dispose(): void {
    if (document.body.contains(this.container)) document.body.removeChild(this.container);
    if (document.body.contains(this.pauseBtn)) document.body.removeChild(this.pauseBtn);
  }
}
