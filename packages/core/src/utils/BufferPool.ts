/**
 * Prevents GC pauses by pooling large TypedArrays needed for 16K image tile generation.
 */
export class BufferPool {
  private static float32Pool: Map<number, Float32Array[]> = new Map();

  public static acquireFloat32(size: number): Float32Array {
    const list = this.float32Pool.get(size);
    if (list && list.length > 0) {
      const arr = list.pop()!;
      arr.fill(0); // Zero out before reuse
      return arr;
    }
    return new Float32Array(size);
  }

  public static releaseFloat32(arr: Float32Array): void {
    const size = arr.length;
    if (!this.float32Pool.has(size)) {
      this.float32Pool.set(size,[]);
    }
    // Limit pool size to prevent infinite memory growth
    if (this.float32Pool.get(size)!.length < 20) {
      this.float32Pool.get(size)!.push(arr);
    }
  }

  public static clear(): void {
    this.float32Pool.clear();
  }
}