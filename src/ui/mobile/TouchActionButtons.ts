export interface ActionButtonState {
  shoot: boolean;
  reload: boolean;
  jump: boolean;
}

export class TouchActionButtons {
  private container: HTMLDivElement;
  private shootButton: HTMLDivElement;
  private reloadButton: HTMLDivElement;
  private jumpButton: HTMLDivElement;
  
  private state: ActionButtonState = {
    shoot: false,
    reload: false,
    jump: false,
  };

  constructor() {
    this.container = document.createElement('div');
    this.shootButton = document.createElement('div');
    this.reloadButton = document.createElement('div');
    this.jumpButton = document.createElement('div');
    this.init();
  }

  private init(): void {
    Object.assign(this.container.style, {
      position: 'fixed',
      bottom: '30px',
      right: '30px',
      display: 'flex',
      flexDirection: 'column',
      gap: '15px',
      zIndex: '2000',
    });

    this.createButton(this.shootButton, '🔫', 'shoot', 80, '#ff4444');
    this.createButton(this.jumpButton, '⬆️', 'jump', 60, '#4444ff');
    this.createButton(this.reloadButton, '🔄', 'reload', 50, '#44aa44');

    const topRow = document.createElement('div');
    Object.assign(topRow.style, {
      display: 'flex',
      gap: '10px',
      justifyContent: 'flex-end',
    });
    topRow.appendChild(this.reloadButton);
    topRow.appendChild(this.jumpButton);

    this.container.appendChild(topRow);
    this.container.appendChild(this.shootButton);
  }

  private createButton(
    button: HTMLDivElement,
    icon: string,
    action: keyof ActionButtonState,
    size: number,
    color: string
  ): void {
    Object.assign(button.style, {
      width: `${size}px`,
      height: `${size}px`,
      borderRadius: '50%',
      backgroundColor: color,
      opacity: '0.7',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      fontSize: `${size * 0.4}px`,
      userSelect: 'none',
      touchAction: 'none',
      border: '3px solid rgba(255, 255, 255, 0.5)',
      boxShadow: '0 4px 8px rgba(0, 0, 0, 0.3)',
      transition: 'transform 0.1s, opacity 0.1s',
    });
    button.textContent = icon;

    button.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.state[action] = true;
      button.style.transform = 'scale(0.9)';
      button.style.opacity = '1';
    }, { passive: false });

    button.addEventListener('touchend', (e) => {
      e.preventDefault();
      this.state[action] = false;
      button.style.transform = 'scale(1)';
      button.style.opacity = '0.7';
    }, { passive: false });

    button.addEventListener('touchcancel', (e) => {
      e.preventDefault();
      this.state[action] = false;
      button.style.transform = 'scale(1)';
      button.style.opacity = '0.7';
    }, { passive: false });
  }

  public getState(): ActionButtonState {
    return { ...this.state };
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

  public dispose(): void {
    if (document.body.contains(this.container)) {
      document.body.removeChild(this.container);
    }
  }
}
