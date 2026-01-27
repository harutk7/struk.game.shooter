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

import { MobileControlsManager } from './MobileControlsManager';

export class InputManager {
  private keyState: KeyState;
  private keyMap: Map<string, keyof KeyState>;
  private mobileControls: MobileControlsManager | null = null;

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

  public setMobileControls(controls: MobileControlsManager): void {
    this.mobileControls = controls;
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
    const state = { ...this.keyState };
    
    if (this.mobileControls && this.mobileControls.isEnabled()) {
      const movement = this.mobileControls.getMovement();
      const actions = this.mobileControls.getActions();
      
      if (movement.active) {
        if (movement.y > 0.3) state.forward = true;
        if (movement.y < -0.3) state.backward = true;
        if (movement.x < -0.3) state.left = true;
        if (movement.x > 0.3) state.right = true;
      }
      
      if (actions.shoot) state.shoot = true;
      if (actions.reload) state.reload = true;
      if (actions.jump) state.jump = true;
    }
    
    return state;
  }

  public getAnalogMovement(): { x: number; y: number } {
    if (this.mobileControls && this.mobileControls.isEnabled()) {
      const movement = this.mobileControls.getMovement();
      if (movement.active) {
        return { x: movement.x, y: movement.y };
      }
    }
    
    let x = 0, y = 0;
    if (this.keyState.forward) y += 1;
    if (this.keyState.backward) y -= 1;
    if (this.keyState.left) x -= 1;
    if (this.keyState.right) x += 1;
    
    return { x, y };
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
