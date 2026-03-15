import { BufferPool } from '../utils/BufferPool';

export class ScalarField {
  public data: Float32Array;

  constructor(public width: number, public height: number, data?: Float32Array) {
    this.data = data || BufferPool.acquireFloat32(width * height);
  }

  public set(x: number, y: number, value: number): void {
    if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
      this.data[y * this.width + x] = value;
    }
  }

  public get(x: number, y: number): number {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return 0;
    return this.data[y * this.width + x];
  }

  /**
   * Bilinear interpolation for smooth continuous sampling
   */
  public sample(x: number, y: number, tileable: boolean = false): number {
    if (tileable) {
      x = ((x % this.width) + this.width) % this.width;
      y = ((y % this.height) + this.height) % this.height;
    }

    const x0 = Math.floor(x);
    const x1 = Math.ceil(x);
    const y0 = Math.floor(y);
    const y1 = Math.ceil(y);

    const tx = x - x0;
    const ty = y - y0;

    const v00 = this.get(x0, y0);
    const v10 = this.get(x1, y0);
    const v01 = this.get(x0, y1);
    const v11 = this.get(x1, y1);

    const top = v00 * (1 - tx) + v10 * tx;
    const bottom = v01 * (1 - tx) + v11 * tx;

    return top * (1 - ty) + bottom * ty;
  }

  public release(): void {
    BufferPool.releaseFloat32(this.data);
  }
}