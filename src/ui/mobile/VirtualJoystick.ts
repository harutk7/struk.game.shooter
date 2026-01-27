export interface JoystickState {
  active: boolean;
  x: number;
  y: number;
  angle: number;
  distance: number;
}

export class VirtualJoystick {
  private container: HTMLDivElement;
  private base: HTMLDivElement;
  private stick: HTMLDivElement;
  private state: JoystickState;
  
  private baseRadius: number = 60;
  private stickRadius: number = 30;
  private maxDistance: number = 50;
  
  private touchId: number | null = null;
  private baseX: number = 0;
  private baseY: number = 0;

  constructor(side: 'left' | 'right' = 'left') {
    this.container = document.createElement('div');
    this.base = document.createElement('div');
    this.stick = document.createElement('div');
    
    this.state = {
      active: false,
      x: 0,
      y: 0,
      angle: 0,
      distance: 0,
    };

    this.init(side);
  }

  private init(side: 'left' | 'right'): void {
    Object.assign(this.container.style, {
      position: 'fixed',
      bottom: '30px',
      [side]: '30px',
      width: `${this.baseRadius * 2}px`,
      height: `${this.baseRadius * 2}px`,
      zIndex: '2000',
      touchAction: 'none',
    });

    Object.assign(this.base.style, {
      position: 'absolute',
      width: '100%',
      height: '100%',
      borderRadius: '50%',
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
      border: '3px solid rgba(255, 255, 255, 0.4)',
      boxSizing: 'border-box',
    });

    Object.assign(this.stick.style, {
      position: 'absolute',
      width: `${this.stickRadius * 2}px`,
      height: `${this.stickRadius * 2}px`,
      borderRadius: '50%',
      backgroundColor: 'rgba(255, 255, 255, 0.6)',
      border: '2px solid rgba(255, 255, 255, 0.8)',
      left: `${this.baseRadius - this.stickRadius}px`,
      top: `${this.baseRadius - this.stickRadius}px`,
      transition: 'none',
      boxSizing: 'border-box',
    });

    this.container.appendChild(this.base);
    this.container.appendChild(this.stick);

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.container.addEventListener('touchstart', this.onTouchStart.bind(this), { passive: false });
    document.addEventListener('touchmove', this.onTouchMove.bind(this), { passive: false });
    document.addEventListener('touchend', this.onTouchEnd.bind(this), { passive: false });
    document.addEventListener('touchcancel', this.onTouchEnd.bind(this), { passive: false });
  }

  private onTouchStart(e: TouchEvent): void {
    e.preventDefault();
    
    if (this.touchId !== null) return;
    
    const touch = e.changedTouches[0];
    this.touchId = touch.identifier;
    
    const rect = this.container.getBoundingClientRect();
    this.baseX = rect.left + this.baseRadius;
    this.baseY = rect.top + this.baseRadius;
    
    this.updateStickPosition(touch.clientX, touch.clientY);
  }

  private onTouchMove(e: TouchEvent): void {
    if (this.touchId === null) return;
    
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === this.touchId) {
        e.preventDefault();
        this.updateStickPosition(touch.clientX, touch.clientY);
        break;
      }
    }
  }

  private onTouchEnd(e: TouchEvent): void {
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === this.touchId) {
        this.touchId = null;
        this.resetStick();
        break;
      }
    }
  }

  private updateStickPosition(touchX: number, touchY: number): void {
    let deltaX = touchX - this.baseX;
    let deltaY = touchY - this.baseY;
    
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    const angle = Math.atan2(deltaY, deltaX);
    
    const clampedDistance = Math.min(distance, this.maxDistance);
    
    if (distance > this.maxDistance) {
      deltaX = Math.cos(angle) * this.maxDistance;
      deltaY = Math.sin(angle) * this.maxDistance;
    }
    
    this.stick.style.left = `${this.baseRadius - this.stickRadius + deltaX}px`;
    this.stick.style.top = `${this.baseRadius - this.stickRadius + deltaY}px`;
    
    this.state.active = true;
    this.state.x = deltaX / this.maxDistance;
    this.state.y = -deltaY / this.maxDistance;
    this.state.angle = angle;
    this.state.distance = clampedDistance / this.maxDistance;
  }

  private resetStick(): void {
    this.stick.style.left = `${this.baseRadius - this.stickRadius}px`;
    this.stick.style.top = `${this.baseRadius - this.stickRadius}px`;
    
    this.state.active = false;
    this.state.x = 0;
    this.state.y = 0;
    this.state.angle = 0;
    this.state.distance = 0;
  }

  public getState(): JoystickState {
    return { ...this.state };
  }

  public show(): void {
    if (!document.body.contains(this.container)) {
      document.body.appendChild(this.container);
    }
    this.container.style.display = 'block';
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
