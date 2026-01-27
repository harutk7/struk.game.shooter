export interface LookState {
  deltaX: number;
  deltaY: number;
  active: boolean;
}

export class TouchLookController {
  private element: HTMLDivElement;
  private touchId: number | null = null;
  private lastX: number = 0;
  private lastY: number = 0;
  private sensitivity: number = 0.3;
  
  private state: LookState = {
    deltaX: 0,
    deltaY: 0,
    active: false,
  };

  public onLook: ((deltaX: number, deltaY: number) => void) | null = null;

  constructor() {
    this.element = document.createElement('div');
    this.init();
  }

  private init(): void {
    Object.assign(this.element.style, {
      position: 'fixed',
      top: '0',
      right: '0',
      width: '50%',
      height: '70%',
      zIndex: '1500',
      touchAction: 'none',
    });

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.element.addEventListener('touchstart', this.onTouchStart.bind(this), { passive: false });
    this.element.addEventListener('touchmove', this.onTouchMove.bind(this), { passive: false });
    this.element.addEventListener('touchend', this.onTouchEnd.bind(this), { passive: false });
    this.element.addEventListener('touchcancel', this.onTouchEnd.bind(this), { passive: false });
  }

  private onTouchStart(e: TouchEvent): void {
    e.preventDefault();
    
    if (this.touchId !== null) return;
    
    const touch = e.changedTouches[0];
    this.touchId = touch.identifier;
    this.lastX = touch.clientX;
    this.lastY = touch.clientY;
    this.state.active = true;
  }

  private onTouchMove(e: TouchEvent): void {
    if (this.touchId === null) return;
    
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === this.touchId) {
        e.preventDefault();
        
        const deltaX = (touch.clientX - this.lastX) * this.sensitivity;
        const deltaY = (touch.clientY - this.lastY) * this.sensitivity;
        
        this.lastX = touch.clientX;
        this.lastY = touch.clientY;
        
        this.state.deltaX = deltaX;
        this.state.deltaY = deltaY;
        
        if (this.onLook) {
          this.onLook(deltaX, deltaY);
        }
        
        break;
      }
    }
  }

  private onTouchEnd(e: TouchEvent): void {
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === this.touchId) {
        this.touchId = null;
        this.state.active = false;
        this.state.deltaX = 0;
        this.state.deltaY = 0;
        break;
      }
    }
  }

  public setSensitivity(value: number): void {
    this.sensitivity = Math.max(0.1, Math.min(1.0, value));
  }

  public getState(): LookState {
    return { ...this.state };
  }

  public show(): void {
    if (!document.body.contains(this.element)) {
      document.body.appendChild(this.element);
    }
    this.element.style.display = 'block';
  }

  public hide(): void {
    this.element.style.display = 'none';
  }

  public dispose(): void {
    if (document.body.contains(this.element)) {
      document.body.removeChild(this.element);
    }
  }
}
