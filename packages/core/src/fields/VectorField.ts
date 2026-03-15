import { BufferPool } from '../utils/BufferPool';

export class VectorField {
  public data: Float32Array; // Interleaved [dx, dy, dx, dy...]

  constructor(public width: number, public height: number, data?: Float32Array) {
    this.data = data || BufferPool.acquireFloat32(width * height * 2);
  }

  public set(x: number, y: number, dx: number, dy: number): void {
    if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
      const idx = (y * this.width + x) * 2;
      this.data[idx] = dx;
      this.data[idx + 1] = dy;
    }
  }

  public get(x: number, y: number): [number, number] {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return [0, 0];
    const idx = (y * this.width + x) * 2;
    return [this.data[idx], this.data[idx + 1]];
  }

  public sample(x: number, y: number, tileable: boolean = false): [number, number] {
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

    const [dx00, dy00] = this.get(x0, y0);
    const [dx10, dy10] = this.get(x1, y0);
    const [dx01, dy01] = this.get(x0, y1);
    const [dx11, dy11] = this.get(x1, y1);

    const topX = dx00 * (1 - tx) + dx10 * tx;
    const bottomX = dx01 * (1 - tx) + dx11 * tx;
    const resX = topX * (1 - ty) + bottomX * ty;

    const topY = dy00 * (1 - tx) + dy10 * tx;
    const bottomY = dy01 * (1 - tx) + dy11 * tx;
    const resY = topY * (1 - ty) + bottomY * ty;

    return [resX, resY];
  }

  public release(): void {
    BufferPool.releaseFloat32(this.data);
  }
}