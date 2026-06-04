export class Crosshair {
  private container: HTMLDivElement;
  private top: HTMLDivElement;
  private bottom: HTMLDivElement;
  private left: HTMLDivElement;
  private right: HTMLDivElement;
  // Hit marker (4 ticks) — added in T5
  private hitMarker: HTMLDivElement;
  private gap = 6;
  /** Current crosshair expansion from movement/recoil. */
  private currentSpread = 0;
  /** Recoil kick (0..1) — pushes the crosshair upward. */
  private recoilKick = 0;
  /** Last hit confirmation timestamp (for hit marker). */
  private lastHitAt = 0;

  constructor() {
    this.container = document.createElement('div');
    this.top = document.createElement('div');
    this.bottom = document.createElement('div');
    this.left = document.createElement('div');
    this.right = document.createElement('div');
    this.hitMarker = document.createElement('div');
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

    // Hit marker: 4 small ticks at ~12px out from the center, made of 8px line segments
    Object.assign(this.hitMarker.style, {
      position: 'absolute', width: '24px', height: '24px', left: '-12px', top: '-12px',
      pointerEvents: 'none', opacity: '0', transition: 'opacity 0.08s',
    });
    const tickPositions: Array<[string, string, string, string]> = [
      // [top, left, width, height] of each tick
      ['0px',     '8px',  '8px', '2px'],   // top
      ['14px',    '8px',  '8px', '2px'],   // bottom
      ['8px',     '0px',  '2px', '8px'],   // left
      ['8px',     '14px', '2px', '8px'],   // right
    ];
    for (const [top, left, w, h] of tickPositions) {
      const t = document.createElement('div');
      Object.assign(t.style, {
        position: 'absolute', top, left, width: w, height: h,
        backgroundColor: '#ffffff',
        boxShadow: '0 0 2px rgba(0,0,0,0.7)',
      });
      this.hitMarker.appendChild(t);
    }

    const dot = document.createElement('div');
    Object.assign(dot.style, { position: 'absolute', width: '3px', height: '3px', backgroundColor: 'rgba(255,255,255,0.5)', borderRadius: '50%', left: '-1.5px', top: '-1.5px' });
    this.container.append(this.top, this.bottom, this.left, this.right, this.hitMarker, dot);
  }

  show(): void {
    if (!document.body.contains(this.container)) document.body.appendChild(this.container);
    this.container.style.display = 'block';
  }
  hide(): void { this.container.style.display = 'none'; }

  /**
   * Set movement spread (0..1). Crosshair expands with movement.
   * (Kept for backward-compat — internal state also reads recoilKick.)
   */
  setSpread(spread: number): void {
    this.currentSpread = spread;
    this.applyLayout();
  }

  /**
   * Drive recoil-induced crosshair expansion.
   * magnitude: 0..1 (e.g. 0.5 for a strong kick)
   * (T5 polish: crosshair opens up when the gun fires, then closes.)
   */
  setRecoilKick(magnitude: number): void {
    this.recoilKick = Math.max(this.recoilKick, Math.min(1, magnitude));
  }

  /**
   * Tick: decay recoil kick, refresh hit-marker visibility.
   * Call once per frame.
   */
  tick(dt: number, now: number): void {
    this.recoilKick = Math.max(0, this.recoilKick - dt * 4);
    this.applyLayout();

    // Hit marker fades out
    if (this.lastHitAt > 0) {
      const age = (now - this.lastHitAt) / 150; // 150ms life
      if (age >= 1) {
        this.hitMarker.style.opacity = '0';
        this.lastHitAt = 0;
      } else {
        this.hitMarker.style.opacity = `${1 - age}`;
      }
    }
  }

  private applyLayout(): void {
    const total = this.currentSpread * 8 + this.gap + this.recoilKick * 14;
    const yShift = -this.recoilKick * 3; // crosshair pulls UP when the gun kicks UP
    this.top.style.top = `${-(total + 10) + yShift}px`;
    this.bottom.style.top = `${total + yShift}px`;
    this.left.style.left = `${-(total + 10)}px`;
    this.right.style.left = `${total}px`;
  }

  flashHit(): void {
    [this.top, this.bottom, this.left, this.right].forEach(el => el.style.backgroundColor = 'rgba(255,50,50,0.9)');
    setTimeout(() => {
      [this.top, this.bottom, this.left, this.right].forEach(el => el.style.backgroundColor = 'rgba(255,255,255,0.85)');
    }, 80);
  }

  /**
   * Confirmed-hit hit marker (T5 polish). Brief white "X" tick around the
   * crosshair. Distinct from flashHit() which is a damage flash.
   */
  showHitMarker(): void {
    this.lastHitAt = performance.now();
    this.hitMarker.style.opacity = '1';
  }

  dispose(): void {
    if (document.body.contains(this.container)) document.body.removeChild(this.container);
  }
}
