export class GameClock {
  private lastTime: number = 0;
  private deltaTime: number = 0;
  private elapsedTime: number = 0;
  private isRunning: boolean = false;

  constructor() {
    this.lastTime = performance.now();
  }

  public start(): void {
    this.isRunning = true;
    this.lastTime = performance.now();
  }

  public stop(): void {
    this.isRunning = false;
  }

  public update(): number {
    const currentTime = performance.now();
    this.deltaTime = (currentTime - this.lastTime) / 1000;
    this.lastTime = currentTime;

    this.deltaTime = Math.min(this.deltaTime, 0.1);

    if (this.isRunning) {
      this.elapsedTime += this.deltaTime;
    }

    return this.deltaTime;
  }

  public getDeltaTime(): number {
    return this.deltaTime;
  }

  public getElapsedTime(): number {
    return this.elapsedTime;
  }

  public reset(): void {
    this.elapsedTime = 0;
    this.lastTime = performance.now();
    this.deltaTime = 0;
  }
}
