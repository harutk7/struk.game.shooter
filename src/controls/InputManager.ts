export interface KeyState {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  jump: boolean;
  sprint: boolean;
  reload: boolean;
  shoot: boolean;
}

export class InputManager {
  private keyState: KeyState;
  private keyMap: Map<string, keyof KeyState>;

  constructor() {
    this.keyState = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      jump: false,
      sprint: false,
      reload: false,
      shoot: false,
    };

    this.keyMap = new Map([
      ['KeyW', 'forward'],
      ['KeyS', 'backward'],
      ['KeyA', 'left'],
      ['KeyD', 'right'],
      ['Space', 'jump'],
      ['ShiftLeft', 'sprint'],
      ['ShiftRight', 'sprint'],
      ['KeyR', 'reload'],
    ]);

    this.init();
  }

  private init(): void {
    document.addEventListener('keydown', this.onKeyDown.bind(this));
    document.addEventListener('keyup', this.onKeyUp.bind(this));
    document.addEventListener('mousedown', this.onMouseDown.bind(this));
    document.addEventListener('mouseup', this.onMouseUp.bind(this));

    document.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private onKeyDown(event: KeyboardEvent): void {
    const action = this.keyMap.get(event.code);
    if (action) {
      this.keyState[action] = true;
    }
  }

  private onKeyUp(event: KeyboardEvent): void {
    const action = this.keyMap.get(event.code);
    if (action) {
      this.keyState[action] = false;
    }
  }

  private onMouseDown(event: MouseEvent): void {
    if (event.button === 0) {
      this.keyState.shoot = true;
    }
  }

  private onMouseUp(event: MouseEvent): void {
    if (event.button === 0) {
      this.keyState.shoot = false;
    }
  }

  public getKeyState(): KeyState {
    return { ...this.keyState };
  }

  public isMoving(): boolean {
    return this.keyState.forward || this.keyState.backward || 
           this.keyState.left || this.keyState.right;
  }

  public dispose(): void {
    document.removeEventListener('keydown', this.onKeyDown.bind(this));
    document.removeEventListener('keyup', this.onKeyUp.bind(this));
    document.removeEventListener('mousedown', this.onMouseDown.bind(this));
    document.removeEventListener('mouseup', this.onMouseUp.bind(this));
  }
}
