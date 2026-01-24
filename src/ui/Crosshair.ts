export class Crosshair {
  private element: HTMLDivElement;

  constructor() {
    this.element = document.createElement('div');
    this.init();
  }

  private init(): void {
    Object.assign(this.element.style, {
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      width: '20px',
      height: '20px',
      pointerEvents: 'none',
      zIndex: '1000',
    });

    const createLine = (isHorizontal: boolean) => {
      const line = document.createElement('div');
      Object.assign(line.style, {
        position: 'absolute',
        backgroundColor: 'white',
        boxShadow: '0 0 2px black',
      });

      if (isHorizontal) {
        Object.assign(line.style, {
          width: '12px',
          height: '2px',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
        });
      } else {
        Object.assign(line.style, {
          width: '2px',
          height: '12px',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
        });
      }

      return line;
    };

    this.element.appendChild(createLine(true));
    this.element.appendChild(createLine(false));

    const dot = document.createElement('div');
    Object.assign(dot.style, {
      position: 'absolute',
      width: '4px',
      height: '4px',
      backgroundColor: 'white',
      borderRadius: '50%',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      boxShadow: '0 0 2px black',
    });
    this.element.appendChild(dot);
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

  public getElement(): HTMLDivElement {
    return this.element;
  }

  public dispose(): void {
    if (document.body.contains(this.element)) {
      document.body.removeChild(this.element);
    }
  }
}
