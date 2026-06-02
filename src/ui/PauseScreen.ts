export class PauseScreen {
  private element: HTMLDivElement;
  private onResume: (() => void) | null = null;
  private onQuit: (() => void) | null = null;

  constructor() {
    this.element = document.createElement('div');
    Object.assign(this.element.style, {
      position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
      backgroundColor: 'rgba(0,0,0,0.6)', display: 'none',
      flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
      zIndex: '2500', fontFamily: "'Segoe UI', Arial, sans-serif", userSelect: 'none',
    });
    const title = document.createElement('h1');
    title.textContent = 'PAUSED';
    Object.assign(title.style, { color: '#fff', fontSize: '48px', fontWeight: '700', letterSpacing: '6px', marginBottom: '40px' });
    this.element.appendChild(title);
    const bs: Partial<CSSStyleDeclaration> = { padding: '14px 50px', fontSize: '18px', fontWeight: '600', border: 'none', borderRadius: '6px', cursor: 'pointer', letterSpacing: '2px', marginBottom: '12px', width: '200px' };
    const rb = document.createElement('button');
    rb.textContent = 'RESUME';
    Object.assign(rb.style, bs, { backgroundColor: '#4CAF50', color: '#fff' });
    rb.addEventListener('click', () => this.onResume?.());
    this.element.appendChild(rb);
    const qb = document.createElement('button');
    qb.textContent = 'QUIT';
    Object.assign(qb.style, bs, { backgroundColor: '#555', color: '#ccc' });
    qb.addEventListener('click', () => this.onQuit?.());
    this.element.appendChild(qb);
  }

  show(): void {
    if (!document.body.contains(this.element)) document.body.appendChild(this.element);
    this.element.style.display = 'flex';
  }
  hide(): void { this.element.style.display = 'none'; }
  setOnResume(cb: () => void): void { this.onResume = cb; }
  setOnQuit(cb: () => void): void { this.onQuit = cb; }
  dispose(): void { if (document.body.contains(this.element)) document.body.removeChild(this.element); }
}
