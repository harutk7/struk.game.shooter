export class StartOverlay {
  private element: HTMLDivElement;
  
  constructor() {
    this.element = document.createElement('div');
    this.init();
  }

  private init(): void {
    Object.assign(this.element.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: '999',
      cursor: 'pointer',
    });

    const title = document.createElement('h1');
    title.textContent = '3D SHOOTER';
    Object.assign(title.style, {
      color: 'white',
      fontSize: '48px',
      fontFamily: 'Arial, sans-serif',
      marginBottom: '20px',
      textShadow: '2px 2px 4px rgba(0,0,0,0.5)',
    });
    this.element.appendChild(title);

    const instructions = document.createElement('p');
    instructions.textContent = 'Click to Play';
    Object.assign(instructions.style, {
      color: '#aaa',
      fontSize: '24px',
      fontFamily: 'Arial, sans-serif',
      animation: 'pulse 2s infinite',
    });
    this.element.appendChild(instructions);

    const controls = document.createElement('div');
    controls.innerHTML = `
      <p style="color: #666; font-size: 14px; margin-top: 40px; font-family: Arial, sans-serif;">
        WASD - Move | Mouse - Look | Left Click - Shoot | ESC - Pause
      </p>
    `;
    this.element.appendChild(controls);

    const style = document.createElement('style');
    style.textContent = `
      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }
    `;
    document.head.appendChild(style);
  }

  public show(): void {
    if (!document.body.contains(this.element)) {
      document.body.appendChild(this.element);
    }
    this.element.style.display = 'flex';
  }

  public hide(): void {
    this.element.style.display = 'none';
  }

  public getElement(): HTMLDivElement {
    return this.element;
  }

  public dispose(): void {
    if (document.body.contains(this.element)) {
      document.body.removeChild(this.element);
    }
  }
}
