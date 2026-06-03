export class HUD {
  private container: HTMLDivElement;
  private topRight: HTMLDivElement;
  private healthFill: HTMLDivElement;
  private healthText: HTMLSpanElement;
  private ammoText: HTMLSpanElement;
  private reserveText: HTMLSpanElement;
  private scoreText: HTMLSpanElement;
  private waveText: HTMLSpanElement;
  private weaponText: HTMLSpanElement;
  private reloadIndicator: HTMLDivElement;

  constructor() {
    this.container = document.createElement('div');
    this.topRight = document.createElement('div');
    this.healthFill = document.createElement('div');
    this.healthText = document.createElement('span');
    this.ammoText = document.createElement('span');
    this.reserveText = document.createElement('span');
    this.scoreText = document.createElement('span');
    this.waveText = document.createElement('span');
    this.weaponText = document.createElement('span');
    this.reloadIndicator = document.createElement('div');
    this.init();
  }

  private init(): void {
    Object.assign(this.container.style, {
      position: 'fixed', bottom: '20px', left: '20px', right: '20px',
      display: 'none', justifyContent: 'space-between', alignItems: 'flex-end',
      pointerEvents: 'none', fontFamily: "'Segoe UI', Arial, sans-serif",
      zIndex: '1000', userSelect: 'none',
    });

    // ── Health (left) ──
    const healthCol = document.createElement('div');
    Object.assign(healthCol.style, { display: 'flex', flexDirection: 'column', gap: '4px' });
    const hl = document.createElement('span');
    hl.textContent = 'HEALTH';
    Object.assign(hl.style, { color: '#aaa', fontSize: '10px', letterSpacing: '2px', fontWeight: '600' });
    healthCol.appendChild(hl);
    const hbg = document.createElement('div');
    Object.assign(hbg.style, { width: '160px', height: '18px', backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: '4px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.15)' });
    Object.assign(this.healthFill.style, { width: '100%', height: '100%', backgroundColor: '#4CAF50', transition: 'width 0.3s ease, background-color 0.3s ease', borderRadius: '3px' });
    hbg.appendChild(this.healthFill);
    healthCol.appendChild(hbg);
    Object.assign(this.healthText.style, { color: '#fff', fontSize: '13px', fontWeight: '600' });
    this.healthText.textContent = '100';
    healthCol.appendChild(this.healthText);
    this.container.appendChild(healthCol);

    // ── Weapon / reload (center) ──
    const centerCol = document.createElement('div');
    Object.assign(centerCol.style, { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' });
    Object.assign(this.weaponText.style, { color: '#ccc', fontSize: '12px', letterSpacing: '1px' });
    this.weaponText.textContent = 'PISTOL';
    centerCol.appendChild(this.weaponText);
    Object.assign(this.reloadIndicator.style, { color: '#ffaa00', fontSize: '13px', fontWeight: '700', opacity: '0', transition: 'opacity 0.2s', letterSpacing: '1px' });
    this.reloadIndicator.textContent = 'RELOADING...';
    centerCol.appendChild(this.reloadIndicator);
    this.container.appendChild(centerCol);

    // ── Ammo (right) ──
    const ammoCol = document.createElement('div');
    Object.assign(ammoCol.style, { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' });
    const al = document.createElement('span');
    al.textContent = 'AMMO';
    Object.assign(al.style, { color: '#aaa', fontSize: '10px', letterSpacing: '2px', fontWeight: '600' });
    ammoCol.appendChild(al);
    Object.assign(this.ammoText.style, { color: '#fff', fontSize: '32px', fontWeight: '700', textShadow: '0 2px 8px rgba(0,0,0,0.6)', lineHeight: '1' });
    this.ammoText.textContent = '12';
    ammoCol.appendChild(this.ammoText);
    Object.assign(this.reserveText.style, { color: '#aaa', fontSize: '13px', fontWeight: '400' });
    this.reserveText.textContent = '/ 48';
    ammoCol.appendChild(this.reserveText);
    this.container.appendChild(ammoCol);

    // ── Score + wave (top right — hidden until game starts) ──
    Object.assign(this.topRight.style, {
      position: 'fixed', top: '20px', right: '20px',
      textAlign: 'right', pointerEvents: 'none',
      zIndex: '1000', fontFamily: "'Segoe UI', Arial, sans-serif",
      userSelect: 'none', display: 'none',
    });
    Object.assign(this.scoreText.style, { color: '#fff', fontSize: '22px', fontWeight: '700', textShadow: '0 2px 6px rgba(0,0,0,0.5)', display: 'block' });
    this.scoreText.textContent = '0';
    this.topRight.appendChild(this.scoreText);
    Object.assign(this.waveText.style, { color: '#aaa', fontSize: '14px', display: 'block', marginTop: '4px' });
    this.waveText.textContent = 'WAVE 1';
    this.topRight.appendChild(this.waveText);

    document.body.appendChild(this.container);
    document.body.appendChild(this.topRight);
  }

  show(): void {
    this.container.style.display = 'flex';
    this.topRight.style.display = 'block';
  }

  hide(): void {
    this.container.style.display = 'none';
    this.topRight.style.display = 'none';
  }

  updateHealth(current: number, max: number): void {
    const pct = (current / max) * 100;
    this.healthFill.style.width = `${pct}%`;
    this.healthText.textContent = `${Math.round(current)}`;
    if (pct > 60) this.healthFill.style.backgroundColor = '#4CAF50';
    else if (pct > 30) this.healthFill.style.backgroundColor = '#FFC107';
    else this.healthFill.style.backgroundColor = '#F44336';
  }

  updateAmmo(current: number, reserve: number): void {
    this.ammoText.textContent = `${current}`;
    this.reserveText.textContent = `/ ${reserve}`;
    const low = current <= 3;
    this.ammoText.style.color = low ? '#F44336' : '#fff';
    this.reserveText.style.color = low ? '#cc3333' : '#aaa';
  }

  updateScore(score: number): void { this.scoreText.textContent = `${score}`; }
  updateWave(wave: number): void { this.waveText.textContent = `WAVE ${wave}`; }
  updateWeapon(name: string): void { this.weaponText.textContent = name.toUpperCase(); }

  showReloading(show: boolean): void {
    this.reloadIndicator.style.opacity = show ? '1' : '0';
  }

  dispose(): void {
    if (document.body.contains(this.container)) document.body.removeChild(this.container);
    if (document.body.contains(this.topRight)) document.body.removeChild(this.topRight);
  }
}
