/**
 * Deterministic PRNG using cyrb128 (string hash to seeds) and sfc32 (random generation).
 * Ensures identical floating point sequences across Node, Browser, and Web Workers.
 */
export class PRNG {
  private a: number;
  private b: number;
  private c: number;
  private d: number;

  constructor(seed: string | number) {
    const strSeed = seed.toString();
    const[a, b, c, d] = this.cyrb128(strSeed);
    this.a = a;
    this.b = b;
    this.c = c;
    this.d = d;
    // Warm up
    for (let i = 0; i < 15; i++) this.next();
  }

  private cyrb128(str: string): [number, number, number, number] {
    let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762;
    for (let i = 0, k; i < str.length; i++) {
      k = str.charCodeAt(i);
      h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
      h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
      h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
      h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
    }
    h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
    h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
    h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
    h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
    return[(h1^h2^h3^h4)>>>0, (h2^h1)>>>0, (h3^h1)>>>0, (h4^h1)>>>0];
  }

  private next(): number {
    this.a >>>= 0; this.b >>>= 0; this.c >>>= 0; this.d >>>= 0; 
    let t = (this.a + this.b) | 0;
    this.a = this.b ^ this.b >>> 9;
    this.b = this.c + (this.c << 3) | 0;
    this.c = (this.c << 21 | this.c >>> 11);
    this.d = this.d + 1 | 0;
    t = t + this.d | 0;
    this.c = this.c + t | 0;
    return (t >>> 0) / 4294967296;
  }

  public random(): number {
    return this.next();
  }

  public range(min: number, max: number): number {
    return min + this.random() * (max - min);
  }

  public int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }

  public pick<T>(arr: T[]): T {
    return arr[this.int(0, arr.length - 1)];
  }
}