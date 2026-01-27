import { VirtualJoystick, JoystickState } from '../ui/mobile/VirtualJoystick';
import { TouchLookController } from '../ui/mobile/TouchLookController';
import { TouchActionButtons, ActionButtonState } from '../ui/mobile/TouchActionButtons';
import { DeviceDetection } from '../utils/DeviceDetection';

export interface MobileInputState {
  movement: JoystickState;
  actions: ActionButtonState;
  lookActive: boolean;
}

export class MobileControlsManager {
  private joystick: VirtualJoystick;
  private lookController: TouchLookController;
  private actionButtons: TouchActionButtons;
  private enabled: boolean = false;

  public onLook: ((deltaX: number, deltaY: number) => void) | null = null;

  constructor() {
    this.joystick = new VirtualJoystick('left');
    this.lookController = new TouchLookController();
    this.actionButtons = new TouchActionButtons();

    this.lookController.onLook = (deltaX, deltaY) => {
      if (this.onLook) {
        this.onLook(deltaX, deltaY);
      }
    };

    if (DeviceDetection.isTouchDevice()) {
      this.enable();
    }

    window.addEventListener('orientationchange', () => {
      this.handleOrientationChange();
    });

    window.addEventListener('resize', () => {
      this.handleOrientationChange();
    });
  }

  private handleOrientationChange(): void {
    if (DeviceDetection.isPortrait() && this.enabled) {
      this.showOrientationWarning();
    } else {
      this.hideOrientationWarning();
    }
  }

  private orientationWarning: HTMLDivElement | null = null;

  private showOrientationWarning(): void {
    if (this.orientationWarning) return;

    this.orientationWarning = document.createElement('div');
    Object.assign(this.orientationWarning.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100%',
      padding: '10px',
      backgroundColor: 'rgba(255, 165, 0, 0.9)',
      color: 'white',
      textAlign: 'center',
      fontFamily: 'Arial, sans-serif',
      fontSize: '14px',
      zIndex: '3000',
    });
    this.orientationWarning.textContent = '📱 Rotate device to landscape for best experience';
    document.body.appendChild(this.orientationWarning);
  }

  private hideOrientationWarning(): void {
    if (this.orientationWarning && document.body.contains(this.orientationWarning)) {
      document.body.removeChild(this.orientationWarning);
      this.orientationWarning = null;
    }
  }

  public enable(): void {
    this.enabled = true;
    this.joystick.show();
    this.lookController.show();
    this.actionButtons.show();
    this.handleOrientationChange();
  }

  public disable(): void {
    this.enabled = false;
    this.joystick.hide();
    this.lookController.hide();
    this.actionButtons.hide();
    this.hideOrientationWarning();
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public getInputState(): MobileInputState {
    return {
      movement: this.joystick.getState(),
      actions: this.actionButtons.getState(),
      lookActive: this.lookController.getState().active,
    };
  }

  public getMovement(): JoystickState {
    return this.joystick.getState();
  }

  public getActions(): ActionButtonState {
    return this.actionButtons.getState();
  }

  public setLookSensitivity(value: number): void {
    this.lookController.setSensitivity(value);
  }

  public dispose(): void {
    this.joystick.dispose();
    this.lookController.dispose();
    this.actionButtons.dispose();
    this.hideOrientationWarning();
  }
}
