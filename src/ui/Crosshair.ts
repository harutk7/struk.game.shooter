export class Crosshair {
  private container: HTMLDivElement;
  private top: HTMLDivElement;
  private bottom: HTMLDivElement;
  private left: HTMLDivElement;
  private right: HTMLDivElement;
  private gap = 6;

  constructor() {
    this.container = document.createElement('div');
    this.top = document.createElement('div');
    this.bottom = document.createElement('div');
    this.left = document.createElement('div');
    this.right = document.createElement('div');
    this.init();
  }

  private init(): void {
    Object.assign(this.container.style, {
      position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
      pointerEvents: 'none', zIndex: '1001', display: 'none',
    });
    const ls = (w: string, h: string, x: string, y: string) => {
      const d = document.createElement('div');
      Object.assign(d.style, {
        position: 'absolute', backgroundColor: 'rgba(255,255,255,0.85)',
        width: w, height: h, left: x, top: y,
        boxShadow: '0 0 2px rgba(0,0,0,0.5)', transition: 'all 0.08s ease-out',
      });
      return d;
    };
    this.top = ls('2px', '10px', '-1px', `-${this.gap + 10}px`);
    this.bottom = ls('2px', '10px', '-1px', `${this.gap}px`);
    this.left = ls('10px', '2px', `-${this.gap + 10}px`, '-1px');
    this.right = ls('10px', '2px', `${this.gap}px`, '-1px');
    const dot = document.createElement('div');
    Object.assign(dot.style, { position: 'absolute', width: '3px', height: '3px', backgroundColor: 'rgba(255,255,255,0.5)', borderRadius: '50%', left: '-1.5px', top: '-1.5px' });
    this.container.append(this.top, this.bottom, this.left, this.right, dot);
  }

  show(): void {
    if (!document.body.contains(this.container)) document.body.appendChild(this.container);
    this.container.style.display = 'block';
  }
  hide(): void { this.container.style.display = 'none'; }

  setSpread(spread: number): void {
    const g = this.gap + spread * 8;
    this.top.style.top = `-${g + 10}px`;
    this.bottom.style.top = `${g}px`;
    this.left.style.left = `-${g + 10}px`;
    this.right.style.left = `${g}px`;
  }

  flashHit(): void {
    [this.top, this.bottom, this.left, this.right].forEach(el => el.style.backgroundColor = 'rgba(255,50,50,0.9)');
    setTimeout(() => {
      [this.top, this.bottom, this.left, this.right].forEach(el => el.style.backgroundColor = 'rgba(255,255,255,0.85)');
    }, 80);
  }

  dispose(): void {
    if (document.body.contains(this.container)) document.body.removeChild(this.container);
  }
}
