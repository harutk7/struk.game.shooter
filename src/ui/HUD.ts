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
  private waveBreakOverlay: HTMLDivElement;
  private waveBreakTitle: HTMLSpanElement;
  private waveBreakCountdown: HTMLSpanElement;
  private audioButton: HTMLButtonElement;
  private audioPanel: HTMLDivElement;
  private volumeSlider: HTMLInputElement;
  private onMasterVolumeChange: ((v: number) => void) | null = null;

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
    this.waveBreakOverlay = document.createElement('div');
    this.waveBreakTitle = document.createElement('span');
    this.waveBreakCountdown = document.createElement('span');
    this.audioButton = document.createElement('button');
    this.audioPanel = document.createElement('div');
    this.volumeSlider = document.createElement('input');
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

    // ── Score + wave (top right) ──
    Object.assign(this.topRight.style, {
      position: 'fixed', top: '20px', right: '20px',
      textAlign: 'right', pointerEvents: 'none',
      zIndex: '1000', fontFamily: "'Segoe UI', Arial, sans-serif",
      userSelect: 'none', display: 'none',
    });

    const scoreLabel = document.createElement('span');
    Object.assign(scoreLabel.style, { color: '#888', fontSize: '10px', letterSpacing: '2px', fontWeight: '600', display: 'block', marginBottom: '2px' });
    scoreLabel.textContent = 'SCORE';
    this.topRight.appendChild(scoreLabel);

    Object.assign(this.scoreText.style, { color: '#fff', fontSize: '22px', fontWeight: '700', textShadow: '0 2px 6px rgba(0,0,0,0.5)', display: 'block' });
    this.scoreText.textContent = '0';
    this.topRight.appendChild(this.scoreText);

    Object.assign(this.waveText.style, { color: '#aaa', fontSize: '14px', display: 'block', marginTop: '4px' });
    this.waveText.textContent = 'WAVE 1';
    this.topRight.appendChild(this.waveText);

    // ── Wave break overlay (center screen) ──
    Object.assign(this.waveBreakOverlay.style, {
      position: 'fixed', top: '50%', left: '50%',
      transform: 'translate(-50%, -50%)',
      textAlign: 'center', pointerEvents: 'none',
      zIndex: '2200', fontFamily: "'Segoe UI', Arial, sans-serif",
      userSelect: 'none', display: 'none',
      flexDirection: 'column', alignItems: 'center', gap: '8px',
    });

    Object.assign(this.waveBreakTitle.style, {
      color: '#ffcc00', fontSize: 'clamp(20px, 4vw, 32px)',
      fontWeight: '700', letterSpacing: '4px',
      textShadow: '0 0 20px rgba(255,200,0,0.6), 0 2px 6px rgba(0,0,0,0.6)',
    });
    this.waveBreakOverlay.appendChild(this.waveBreakTitle);

    Object.assign(this.waveBreakCountdown.style, {
      color: '#fff', fontSize: 'clamp(14px, 2.5vw, 20px)',
      fontWeight: '400', letterSpacing: '2px', opacity: '0.8',
    });
    this.waveBreakOverlay.appendChild(this.waveBreakCountdown);

    this.initAudioControls();

    document.body.appendChild(this.container);
    document.body.appendChild(this.topRight);
    document.body.appendChild(this.waveBreakOverlay);
    document.body.appendChild(this.audioButton);
    document.body.appendChild(this.audioPanel);
  }

  /**
   * A small speaker button (top-left) that toggles a panel holding the master
   * volume slider. Always visible so the player can mute from any screen.
   */
  private initAudioControls(): void {
    Object.assign(this.audioButton.style, {
      position: 'fixed', top: '16px', left: '16px',
      width: '40px', height: '40px', borderRadius: '8px',
      border: '1px solid rgba(255,255,255,0.2)',
      backgroundColor: 'rgba(0,0,0,0.55)', color: '#fff',
      fontSize: '18px', cursor: 'pointer', zIndex: '2300',
      pointerEvents: 'auto', lineHeight: '1',
    });
    this.audioButton.textContent = '🔊';
    this.audioButton.setAttribute('aria-label', 'Audio settings');

    Object.assign(this.audioPanel.style, {
      position: 'fixed', top: '64px', left: '16px',
      display: 'none', flexDirection: 'column', gap: '6px',
      padding: '12px 14px', borderRadius: '8px',
      border: '1px solid rgba(255,255,255,0.2)',
      backgroundColor: 'rgba(0,0,0,0.75)', color: '#fff',
      fontFamily: "'Segoe UI', Arial, sans-serif", fontSize: '12px',
      zIndex: '2300', pointerEvents: 'auto', userSelect: 'none',
      minWidth: '160px',
    });

    const label = document.createElement('span');
    label.textContent = 'MASTER VOLUME';
    Object.assign(label.style, { color: '#aaa', fontSize: '10px', letterSpacing: '2px', fontWeight: '600' });
    this.audioPanel.appendChild(label);

    this.volumeSlider.type = 'range';
    this.volumeSlider.min = '0';
    this.volumeSlider.max = '100';
    this.volumeSlider.value = '100';
    Object.assign(this.volumeSlider.style, { width: '100%', cursor: 'pointer' });
    this.audioPanel.appendChild(this.volumeSlider);

    const toggle = () => {
      const open = this.audioPanel.style.display !== 'none';
      this.audioPanel.style.display = open ? 'none' : 'flex';
    };
    this.audioButton.addEventListener('click', toggle);

    this.volumeSlider.addEventListener('input', () => {
      const v = Number(this.volumeSlider.value) / 100;
      this.audioButton.textContent = v === 0 ? '🔇' : '🔊';
      if (this.onMasterVolumeChange) this.onMasterVolumeChange(v);
    });
  }

  /** Wire the master-volume slider to a sink (the AudioManager in the game). */
  setOnMasterVolumeChange(cb: (v: number) => void): void {
    this.onMasterVolumeChange = cb;
  }

  show(): void {
    this.container.style.display = 'flex';
    this.topRight.style.display = 'block';
  }

  hide(): void {
    this.container.style.display = 'none';
    this.topRight.style.display = 'none';
    this.waveBreakOverlay.style.display = 'none';
  }

  /** Push the bottom HUD bar up on mobile to clear joystick/button controls. */
  setMobileLayout(): void {
    this.container.style.bottom = '180px';
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

  showWaveBreak(nextWave: number, duration: number): void {
    this.waveBreakTitle.textContent = `WAVE ${nextWave - 1} COMPLETE`;
    this.waveBreakCountdown.textContent = `WAVE ${nextWave} INCOMING...`;
    this.waveBreakOverlay.style.display = 'flex';
    void this.waveBreakOverlay.offsetWidth; // force reflow for animation
    this.updateWaveBreak(duration);
  }

  updateWaveBreak(timeLeft: number): void {
    const secs = Math.ceil(Math.max(0, timeLeft));
    this.waveBreakCountdown.textContent = `NEXT WAVE IN ${secs}...`;
  }

  hideWaveBreak(): void {
    this.waveBreakOverlay.style.display = 'none';
  }

  dispose(): void {
    if (document.body.contains(this.container)) document.body.removeChild(this.container);
    if (document.body.contains(this.topRight)) document.body.removeChild(this.topRight);
    if (document.body.contains(this.waveBreakOverlay)) document.body.removeChild(this.waveBreakOverlay);
    if (document.body.contains(this.audioButton)) document.body.removeChild(this.audioButton);
    if (document.body.contains(this.audioPanel)) document.body.removeChild(this.audioPanel);
  }
}
