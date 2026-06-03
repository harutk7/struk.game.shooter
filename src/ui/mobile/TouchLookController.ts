export interface LookState { deltaX: number; deltaY: number; active: boolean; }

export class TouchLookController {
  private element: HTMLDivElement;
  private touchId: number | null = null;
  private lastX = 0; private lastY = 0;
  private sensitivity = 1;
  private state: LookState = { deltaX: 0, deltaY: 0, active: false };
  public onLook: ((dx: number, dy: number) => void) | null = null;

  constructor() {
    this.element = document.createElement('div');
    Object.assign(this.element.style, { position: 'fixed', top: '0', right: '0', width: '50%', height: '100%', zIndex: '1500', touchAction: 'none', display: 'none' });
    this.element.addEventListener('touchstart', this.onStart.bind(this), { passive: false });
    this.element.addEventListener('touchmove', this.onMove.bind(this), { passive: false });
    this.element.addEventListener('touchend', this.onEnd.bind(this), { passive: false });
    this.element.addEventListener('touchcancel', this.onEnd.bind(this), { passive: false });
  }

  private onStart(e: TouchEvent): void {
    e.preventDefault();
    if (this.touchId !== null) return;
    const t = e.changedTouches[0];
    this.touchId = t.identifier;
    this.lastX = t.clientX; this.lastY = t.clientY;
    this.state.active = true;
  }

  private onMove(e: TouchEvent): void {
    if (this.touchId === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === this.touchId) {
        e.preventDefault();
        const t = e.changedTouches[i];
        const dx = (t.clientX - this.lastX) * this.sensitivity;
        const dy = (t.clientY - this.lastY) * this.sensitivity;
        this.lastX = t.clientX; this.lastY = t.clientY;
        this.state.deltaX = dx; this.state.deltaY = dy;
        this.onLook?.(dx, dy);
        break;
      }
    }
  }

  private onEnd(e: TouchEvent): void {
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === this.touchId) {
        this.touchId = null;
        this.state.active = false; this.state.deltaX = 0; this.state.deltaY = 0;
        break;
      }
    }
  }

  setSensitivity(v: number): void { this.sensitivity = Math.max(0.1, Math.min(1, v)); }
  getState(): LookState { return { ...this.state }; }
  show(): void { if (!document.body.contains(this.element)) document.body.appendChild(this.element); this.element.style.display = 'block'; }
  hide(): void { this.element.style.display = 'none'; }
  dispose(): void { if (document.body.contains(this.element)) document.body.removeChild(this.element); }
}
