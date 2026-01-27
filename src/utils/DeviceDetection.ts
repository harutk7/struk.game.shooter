export class DeviceDetection {
  private static _isMobile: boolean | null = null;
  private static _isTouch: boolean | null = null;

  public static isMobile(): boolean {
    if (this._isMobile === null) {
      this._isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      );
    }
    return this._isMobile;
  }

  public static isTouchDevice(): boolean {
    if (this._isTouch === null) {
      this._isTouch = (
        'ontouchstart' in window ||
        navigator.maxTouchPoints > 0 ||
        (navigator as any).msMaxTouchPoints > 0
      );
    }
    return this._isTouch;
  }

  public static isPortrait(): boolean {
    return window.innerHeight > window.innerWidth;
  }

  public static isLandscape(): boolean {
    return window.innerWidth > window.innerHeight;
  }

  public static getScreenSize(): { width: number; height: number } {
    return {
      width: window.innerWidth,
      height: window.innerHeight,
    };
  }

  public static reset(): void {
    this._isMobile = null;
    this._isTouch = null;
  }
}
