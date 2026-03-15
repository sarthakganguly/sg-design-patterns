import { PatternConfig } from '../types';

export interface AnimationFrame {
  frameIndex: number;
  totalFrames: number;
  time: number;       // seconds elapsed 0..duration
  progress: number;   // 0..1
  seed: string;       // per-frame derived seed
}

export type FrameCallback = (frame: AnimationFrame) => void | Promise<void>;

export class AnimationLoop {
  private rafId: number | null = null;
  private startTime: number | null = null;
  private frameIndex = 0;

  constructor(private config: PatternConfig) {}

  get totalFrames(): number {
    const fps      = this.config.fps      ?? 30;
    const duration = Math.min(this.config.duration ?? 5, 30);
    return Math.floor(fps * duration);
  }

  /**
   * Drives a browser requestAnimationFrame loop.
   * Calls `onFrame` for each frame; respects `loop` and `duration` from config.
   */
  start(onFrame: FrameCallback): void {
    this.stop();
    this.frameIndex = 0;
    this.startTime = null;

    const tick = async (now: number) => {
        if (this.startTime === null) this.startTime = now;
        const elapsed  = (now - this.startTime) / 1000;
        const fps      = this.config.fps ?? 30;
        const total    = this.totalFrames;

        const expectedFrame = Math.floor(elapsed * fps);

        if (expectedFrame > this.frameIndex) {
            this.frameIndex = expectedFrame;

            if (this.frameIndex >= total) {
            if (this.config.loop) {
                this.frameIndex = 0;
                this.startTime = now;
            } else {
                this.stop();
                return;
            }
            }

            const progress = this.frameIndex / Math.max(total - 1, 1);
            await onFrame({
            frameIndex:  this.frameIndex,
            totalFrames: total,
            time:        this.frameIndex / fps,
            progress,
            seed:        `${this.config.seed}_frame_${this.frameIndex}`,
            });
        }

        this.rafId = requestAnimationFrame(tick);
        };

    this.rafId = requestAnimationFrame(tick);
  }

  /**
   * Renders all frames offline (no RAF) and returns them in order.
   * Useful for export / Node.js.
   */
  async renderAll(onFrame: FrameCallback): Promise<void> {
    const total = this.totalFrames;
    const fps   = this.config.fps ?? 30;

    for (let i = 0; i < total; i++) {
      await onFrame({
        frameIndex:  i,
        totalFrames: total,
        time:        i / fps,
        progress:    i / Math.max(total - 1, 1),
        seed:        `${this.config.seed}_frame_${i}`,
      });
    }
  }

  stop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  get isRunning(): boolean {
    return this.rafId !== null;
  }
}