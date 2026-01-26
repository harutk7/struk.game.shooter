export class HUD {
  private container: HTMLDivElement;
  private healthBar: HTMLDivElement;
  private healthText: HTMLSpanElement;
  private ammoDisplay: HTMLDivElement;
  private ammoText: HTMLSpanElement;
  private reloadIndicator: HTMLDivElement;

  constructor() {
    this.container = document.createElement('div');
    this.healthBar = document.createElement('div');
    this.healthText = document.createElement('span');
    this.ammoDisplay = document.createElement('div');
    this.ammoText = document.createElement('span');
    this.reloadIndicator = document.createElement('div');
    
    this.init();
  }

  private init(): void {
    Object.assign(this.container.style, {
      position: 'fixed',
      bottom: '20px',
      left: '20px',
      right: '20px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      pointerEvents: 'none',
      fontFamily: 'Arial, sans-serif',
      zIndex: '1000',
    });

    const healthContainer = document.createElement('div');
    Object.assign(healthContainer.style, {
      display: 'flex',
      flexDirection: 'column',
      gap: '5px',
    });

    const healthLabel = document.createElement('span');
    healthLabel.textContent = 'HEALTH';
    Object.assign(healthLabel.style, {
      color: 'white',
      fontSize: '12px',
      textShadow: '1px 1px 2px black',
    });
    healthContainer.appendChild(healthLabel);

    const healthBarBg = document.createElement('div');
    Object.assign(healthBarBg.style, {
      width: '200px',
      height: '20px',
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      borderRadius: '3px',
      overflow: 'hidden',
      border: '2px solid rgba(255, 255, 255, 0.3)',
    });

    Object.assign(this.healthBar.style, {
      width: '100%',
      height: '100%',
      backgroundColor: '#4CAF50',
      transition: 'width 0.3s, background-color 0.3s',
    });
    healthBarBg.appendChild(this.healthBar);
    healthContainer.appendChild(healthBarBg);

    Object.assign(this.healthText.style, {
      color: 'white',
      fontSize: '14px',
      textShadow: '1px 1px 2px black',
    });
    this.healthText.textContent = '100/100';
    healthContainer.appendChild(this.healthText);

    this.container.appendChild(healthContainer);

    Object.assign(this.ammoDisplay.style, {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-end',
      gap: '5px',
    });

    const ammoLabel = document.createElement('span');
    ammoLabel.textContent = 'AMMO';
    Object.assign(ammoLabel.style, {
      color: 'white',
      fontSize: '12px',
      textShadow: '1px 1px 2px black',
    });
    this.ammoDisplay.appendChild(ammoLabel);

    Object.assign(this.ammoText.style, {
      color: 'white',
      fontSize: '32px',
      fontWeight: 'bold',
      textShadow: '2px 2px 4px black',
    });
    this.ammoText.textContent = '12 / 36';
    this.ammoDisplay.appendChild(this.ammoText);

    Object.assign(this.reloadIndicator.style, {
      color: '#ffaa00',
      fontSize: '16px',
      textShadow: '1px 1px 2px black',
      opacity: '0',
      transition: 'opacity 0.3s',
    });
    this.reloadIndicator.textContent = 'RELOADING...';
    this.ammoDisplay.appendChild(this.reloadIndicator);

    this.container.appendChild(this.ammoDisplay);
  }

  public show(): void {
    if (!document.body.contains(this.container)) {
      document.body.appendChild(this.container);
    }
    this.container.style.display = 'flex';
  }

  public hide(): void {
    this.container.style.display = 'none';
  }

  public updateHealth(current: number, max: number): void {
    const percentage = (current / max) * 100;
    this.healthBar.style.width = `${percentage}%`;
    this.healthText.textContent = `${Math.round(current)}/${max}`;

    if (percentage > 60) {
      this.healthBar.style.backgroundColor = '#4CAF50';
    } else if (percentage > 30) {
      this.healthBar.style.backgroundColor = '#FFC107';
    } else {
      this.healthBar.style.backgroundColor = '#F44336';
    }
  }

  public updateAmmo(current: number, reserve: number): void {
    this.ammoText.textContent = `${current} / ${reserve}`;
    
    if (current <= 3) {
      this.ammoText.style.color = '#F44336';
    } else {
      this.ammoText.style.color = 'white';
    }
  }

  public showReloading(show: boolean): void {
    this.reloadIndicator.style.opacity = show ? '1' : '0';
  }

  public getElement(): HTMLDivElement {
    return this.container;
  }

  public dispose(): void {
    if (document.body.contains(this.container)) {
      document.body.removeChild(this.container);
    }
  }
}
