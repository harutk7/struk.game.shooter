export interface JoystickState { active: boolean; x: number; y: number; angle: number; distance: number; }

export class VirtualJoystick {
  private container: HTMLDivElement;
  private base: HTMLDivElement;
  private stick: HTMLDivElement;
  private state: JoystickState = { active: false, x: 0, y: 0, angle: 0, distance: 0 };
  private baseRadius = 60;
  private stickRadius = 28;
  private maxDistance = 48;
  private touchId: number | null = null;
  private baseX = 0;
  private baseY = 0;
  private deadZone = 0.1;

  constructor(side: 'left' | 'right' = 'left') {
    this.container = document.createElement('div');
    this.base = document.createElement('div');
    this.stick = document.createElement('div');
    Object.assign(this.container.style, { position: 'fixed', bottom: '40px', [side]: '40px', width: `${this.baseRadius * 2}px`, height: `${this.baseRadius * 2}px`, zIndex: '2000', touchAction: 'none', display: 'none' });
    Object.assign(this.base.style, { position: 'absolute', width: '100%', height: '100%', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.12)', border: '2px solid rgba(255,255,255,0.25)', boxSizing: 'border-box' });
    Object.assign(this.stick.style, { position: 'absolute', width: `${this.stickRadius * 2}px`, height: `${this.stickRadius * 2}px`, borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.5)', border: '2px solid rgba(255,255,255,0.7)', left: `${this.baseRadius - this.stickRadius}px`, top: `${this.baseRadius - this.stickRadius}px`, boxSizing: 'border-box', transition: 'none' });
    this.container.append(this.base, this.stick);
    this.container.addEventListener('touchstart', this.onStart.bind(this), { passive: false });
    document.addEventListener('touchmove', this.onMove.bind(this), { passive: false });
    document.addEventListener('touchend', this.onEnd.bind(this), { passive: false });
    document.addEventListener('touchcancel', this.onEnd.bind(this), { passive: false });
  }

  private onStart(e: TouchEvent): void {
    e.preventDefault();
    if (this.touchId !== null) return;
    const t = e.changedTouches[0];
    this.touchId = t.identifier;
    const r = this.container.getBoundingClientRect();
    this.baseX = r.left + this.baseRadius;
    this.baseY = r.top + this.baseRadius;
    this.updateStick(t.clientX, t.clientY);
  }

  private onMove(e: TouchEvent): void {
    if (this.touchId === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === this.touchId) {
        e.preventDefault();
        this.updateStick(e.changedTouches[i].clientX, e.changedTouches[i].clientY);
        break;
      }
    }
  }

  private onEnd(e: TouchEvent): void {
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === this.touchId) {
        this.touchId = null;
        this.stick.style.left = `${this.baseRadius - this.stickRadius}px`;
        this.stick.style.top = `${this.baseRadius - this.stickRadius}px`;
        this.state = { active: false, x: 0, y: 0, angle: 0, distance: 0 };
        break;
      }
    }
  }

  private updateStick(tx: number, ty: number): void {
    let dx = tx - this.baseX;
    let dy = ty - this.baseY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);
    const clamped = Math.min(dist, this.maxDistance);
    if (dist > this.maxDistance) { dx = Math.cos(angle) * this.maxDistance; dy = Math.sin(angle) * this.maxDistance; }
    this.stick.style.left = `${this.baseRadius - this.stickRadius + dx}px`;
    this.stick.style.top = `${this.baseRadius - this.stickRadius + dy}px`;
    const nd = clamped / this.maxDistance;
    this.state.active = nd > this.deadZone;
    this.state.x = this.state.active ? dx / this.maxDistance : 0;
    this.state.y = this.state.active ? -dy / this.maxDistance : 0;
    this.state.angle = angle;
    this.state.distance = nd;
  }

  getState(): JoystickState { return { ...this.state }; }
  show(): void { if (!document.body.contains(this.container)) document.body.appendChild(this.container); this.container.style.display = 'block'; }
  hide(): void { this.container.style.display = 'none'; }
  dispose(): void { if (document.body.contains(this.container)) document.body.removeChild(this.container); }
}
