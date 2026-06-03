/**
 * Input system — unified keyboard/mouse/touch facade.
 * Produces a single InputSnapshot each frame regardless of device.
 */

export interface InputSnapshot {
  /** Normalized movement vector (-1..1) */
  moveX: number;
  moveY: number;
  /** Whether sprint is held */
  sprint: boolean;
  /** Whether jump was pressed this frame */
  jump: boolean;
  /** Whether shoot is held */
  shoot: boolean;
  /** Whether reload was pressed this frame */
  reload: boolean;
  /** Whether weapon switch was requested (1=next, -1=prev, 0=none) */
  weaponSwitch: number;
  /** Mouse/touch look delta (pixels) */
  lookX: number;
  lookY: number;
  /** Whether pointer is locked / game is active */
  pointerLocked: boolean;
  /** Whether pause was pressed this frame */
  pause: boolean;
}

export function createEmptySnapshot(): InputSnapshot {
  return {
    moveX: 0, moveY: 0,
    sprint: false,
    jump: false,
    shoot: false,
    reload: false,
    weaponSwitch: 0,
    lookX: 0, lookY: 0,
    pointerLocked: false,
    pause: false,
  };
}

type KeyAction =
  | 'forward' | 'backward' | 'left' | 'right'
  | 'jump' | 'sprint' | 'reload' | 'pause';

const DEFAULT_KEY_BINDINGS: Record<string, KeyAction> = {
  'KeyW': 'forward',
  'ArrowUp': 'forward',
  'KeyS': 'backward',
  'ArrowDown': 'backward',
  'KeyA': 'left',
  'ArrowLeft': 'left',
  'KeyD': 'right',
  'ArrowRight': 'right',
  'Space': 'jump',
  'ShiftLeft': 'sprint',
  'ShiftRight': 'sprint',
  'KeyR': 'reload',
  'Escape': 'pause',
  'KeyP': 'pause',
};

export class InputSystem {
  private keyState = new Map<KeyAction, boolean>();
  private keyJustPressed = new Set<KeyAction>();
  private mouseDeltaX = 0;
  private mouseDeltaY = 0;
  private mouseButton0 = false;
  private pointerLocked = false;
  private weaponSwitchDir = 0;

  private keyBindings: Record<string, KeyAction>;
  private domElement: HTMLElement | null = null;

  // Mobile state
  private mobileMoveX = 0;
  private mobileMoveY = 0;
  private mobileShoot = false;
  private mobileJump = false;
  private mobileReload = false;
  private mobileSprint = false;
  private mobileLookX = 0;
  private mobileLookY = 0;
  private isMobile = false;

  private boundHandlers: {
    onKeyDown: (e: KeyboardEvent) => void;
    onKeyUp: (e: KeyboardEvent) => void;
    onMouseDown: (e: MouseEvent) => void;
    onMouseUp: (e: MouseEvent) => void;
    onMouseMove: (e: MouseEvent) => void;
    onWheel: (e: WheelEvent) => void;
    onPointerLockChange: () => void;
    onContextMenu: (e: Event) => void;
  };

  constructor() {
    this.keyBindings = { ...DEFAULT_KEY_BINDINGS };
    this.isMobile = this.detectMobile();

    this.boundHandlers = {
      onKeyDown: this.handleKeyDown.bind(this),
      onKeyUp: this.handleKeyUp.bind(this),
      onMouseDown: this.handleMouseDown.bind(this),
      onMouseUp: this.handleMouseUp.bind(this),
      onMouseMove: this.handleMouseMove.bind(this),
      onWheel: this.handleWheel.bind(this),
      onPointerLockChange: this.handlePointerLockChange.bind(this),
      onContextMenu: (e: Event) => e.preventDefault(),
    };
  }

  private detectMobile(): boolean {
    return (
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0
    );
  }

  attach(domElement: HTMLElement): void {
    this.domElement = domElement;

    document.addEventListener('keydown', this.boundHandlers.onKeyDown);
    document.addEventListener('keyup', this.boundHandlers.onKeyUp);
    document.addEventListener('mousedown', this.boundHandlers.onMouseDown);
    document.addEventListener('mouseup', this.boundHandlers.onMouseUp);
    document.addEventListener('mousemove', this.boundHandlers.onMouseMove);
    document.addEventListener('wheel', this.boundHandlers.onWheel);
    document.addEventListener('pointerlockchange', this.boundHandlers.onPointerLockChange);
    document.addEventListener('contextmenu', this.boundHandlers.onContextMenu);
  }

  detach(): void {
    document.removeEventListener('keydown', this.boundHandlers.onKeyDown);
    document.removeEventListener('keyup', this.boundHandlers.onKeyUp);
    document.removeEventListener('mousedown', this.boundHandlers.onMouseDown);
    document.removeEventListener('mouseup', this.boundHandlers.onMouseUp);
    document.removeEventListener('mousemove', this.boundHandlers.onMouseMove);
    document.removeEventListener('wheel', this.boundHandlers.onWheel);
    document.removeEventListener('pointerlockchange', this.boundHandlers.onPointerLockChange);
    document.removeEventListener('contextmenu', this.boundHandlers.onContextMenu);
    this.domElement = null;
  }

  /** Request pointer lock on the attached element. */
  lockPointer(): void {
    if (this.isMobile) {
      this.pointerLocked = true;
      return;
    }
    this.domElement?.requestPointerLock();
  }

  /** Exit pointer lock. */
  unlockPointer(): void {
    if (this.isMobile) {
      this.pointerLocked = false;
      return;
    }
    document.exitPointerLock();
  }

  /** Feed mobile input from touch controls. */
  setMobileInput(data: {
    moveX?: number; moveY?: number;
    shoot?: boolean; jump?: boolean; reload?: boolean;
    lookX?: number; lookY?: number;
    sprint?: boolean; weaponSwitch?: number;
  }): void {
    if (data.moveX !== undefined) this.mobileMoveX = data.moveX;
    if (data.moveY !== undefined) this.mobileMoveY = data.moveY;
    if (data.shoot !== undefined) this.mobileShoot = data.shoot;
    if (data.jump !== undefined) this.mobileJump = data.jump;
    if (data.reload !== undefined) this.mobileReload = data.reload;
    if (data.sprint !== undefined) this.mobileSprint = data.sprint;
    if (data.lookX !== undefined) this.mobileLookX += data.lookX;
    if (data.lookY !== undefined) this.mobileLookY += data.lookY;
    if (data.weaponSwitch !== undefined && data.weaponSwitch !== 0) this.weaponSwitchDir = data.weaponSwitch;
  }

  /** Poll the current input snapshot. Call once per frame. */
  poll(): InputSnapshot {
    const snap = createEmptySnapshot();

    // Keyboard movement
    if (this.keyState.get('forward')) snap.moveY += 1;
    if (this.keyState.get('backward')) snap.moveY -= 1;
    if (this.keyState.get('left')) snap.moveX -= 1;
    if (this.keyState.get('right')) snap.moveX += 1;

    // Mobile movement overlay
    if (this.isMobile) {
      snap.moveX = this.mobileMoveX || snap.moveX;
      snap.moveY = this.mobileMoveY || snap.moveY;
    }

    // Normalize movement
    const len = Math.sqrt(snap.moveX * snap.moveX + snap.moveY * snap.moveY);
    if (len > 1) {
      snap.moveX /= len;
      snap.moveY /= len;
    }

    snap.sprint = (this.keyState.get('sprint') ?? false) || this.mobileSprint;
    snap.shoot = this.mouseButton0 || this.mobileShoot;
    snap.pointerLocked = this.pointerLocked;

    // Jump / reload / pause — just-pressed (edge-triggered)
    snap.jump = this.keyJustPressed.has('jump') || this.mobileJump;
    snap.reload = this.keyJustPressed.has('reload') || this.mobileReload;
    snap.pause = this.keyJustPressed.has('pause');

    // Reset edge-triggered mobile inputs (sprint is level-triggered, stays as set)
    this.mobileJump = false;
    this.mobileReload = false;

    // Look
    snap.lookX = this.mouseDeltaX + this.mobileLookX;
    snap.lookY = this.mouseDeltaY + this.mobileLookY;

    // Weapon switch
    snap.weaponSwitch = this.weaponSwitchDir;

    // Clear per-frame accumulators
    this.mouseDeltaX = 0;
    this.mouseDeltaY = 0;
    this.mobileLookX = 0;
    this.mobileLookY = 0;
    this.weaponSwitchDir = 0;
    this.keyJustPressed.clear();

    return snap;
  }

  rebindKey(code: string, action: KeyAction | null): void {
    if (action === null) {
      delete this.keyBindings[code];
    } else {
      this.keyBindings[code] = action;
    }
  }

  get isMobileDevice(): boolean {
    return this.isMobile;
  }

  /* ── Private handlers ── */

  private handleKeyDown(e: KeyboardEvent): void {
    const action = this.keyBindings[e.code];
    if (!action) return;

    if (!this.keyState.get(action)) {
      this.keyJustPressed.add(action);
    }
    this.keyState.set(action, true);

    // Weapon switch via number keys
    if (e.code === 'Digit1') this.weaponSwitchDir = -1;
    if (e.code === 'Digit2') this.weaponSwitchDir = 1;
  }

  private handleKeyUp(e: KeyboardEvent): void {
    const action = this.keyBindings[e.code];
    if (action) {
      this.keyState.set(action, false);
    }
  }

  private handleMouseDown(e: MouseEvent): void {
    if (e.button === 0) this.mouseButton0 = true;
  }

  private handleMouseUp(e: MouseEvent): void {
    if (e.button === 0) this.mouseButton0 = false;
  }

  private handleMouseMove(e: MouseEvent): void {
    this.mouseDeltaX += e.movementX || 0;
    this.mouseDeltaY += e.movementY || 0;
  }

  private handleWheel(e: WheelEvent): void {
    if (e.deltaY > 0) this.weaponSwitchDir = 1;
    else if (e.deltaY < 0) this.weaponSwitchDir = -1;
  }

  private handlePointerLockChange(): void {
    this.pointerLocked = document.pointerLockElement === this.domElement;
  }
}
