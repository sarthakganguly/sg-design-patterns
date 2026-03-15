import { PatternConfig } from '../types';

export type RGB = [number, number, number];

function hslToRgb(h: number, s: number, l: number): RGB {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h * 12) % 12;
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [f(0), f(8), f(4)];
}

function hsvToRgb(h: number, s: number, v: number): RGB {
  const c = v * s;
  const x = c * (1 - Math.abs((h * 6) % 2 - 1));
  const m = v - c;
  let r = 0, g = 0, b = 0;
  if      (h < 1/6) { r=c; g=x; }
  else if (h < 2/6) { r=x; g=c; }
  else if (h < 3/6) { g=c; b=x; }
  else if (h < 4/6) { g=x; b=c; }
  else if (h < 5/6) { r=x; b=c; }
  else              { r=c; b=x; }
  return [r+m, g+m, b+m];
}

function hexToRgb(hex: string): RGB {
  const c = hex.replace('#', '');
  return [
    parseInt(c.slice(0,2), 16) / 255,
    parseInt(c.slice(2,4), 16) / 255,
    parseInt(c.slice(4,6), 16) / 255,
  ];
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpRgb(a: RGB, b: RGB, t: number): RGB {
  return [lerp(a[0],b[0],t), lerp(a[1],b[1],t), lerp(a[2],b[2],t)];
}

export class ColorMapper {
  private config: PatternConfig;
  private parsedPalette: RGB[];

  constructor(config: PatternConfig) {
    this.config = config;
    this.parsedPalette = (config.palette ?? []).map(hexToRgb);
  }

  /** Map a scalar value 0–1 to an RGB triple 0–1 based on config.colorMode */
  map(value: number): RGB {
    const v = Math.max(0, Math.min(1, value));
    const mode = this.config.colorMode ?? 'grayscale';

    switch (mode) {
      case 'hsl':
        return hslToRgb(v, 0.8, 0.5);

      case 'hsv':
        return hsvToRgb(v, 0.9, v);

      case 'gradient': {
        const a = this.parsedPalette[0] ?? ([0,0,0.2] as RGB);
        const b = this.parsedPalette[1] ?? ([1,0.8,0.2] as RGB);
        return lerpRgb(a, b, v);
      }

      case 'palette': {
        if (this.parsedPalette.length === 0) return [v, v, v];
        const scaled = v * (this.parsedPalette.length - 1);
        const lo = Math.floor(scaled);
        const hi = Math.min(lo + 1, this.parsedPalette.length - 1);
        return lerpRgb(this.parsedPalette[lo], this.parsedPalette[hi], scaled - lo);
      }

      case 'grayscale':
      default:
        return [v, v, v];
    }
  }

  /** Convert a 0–1 RGB triple to clamped 0–255 integers */
  static toBytes(rgb: RGB): [number, number, number] {
    return [
      Math.round(Math.max(0, Math.min(1, rgb[0])) * 255),
      Math.round(Math.max(0, Math.min(1, rgb[1])) * 255),
      Math.round(Math.max(0, Math.min(1, rgb[2])) * 255),
    ];
  }
}