import { AlgorithmOutput, Tile, PatternConfig, ColorMapper, SymmetryTransform, ScalarField } from '@sg-pattern-engine/core';

export class CanvasRenderer {
  public render(
    ctx: CanvasRenderingContext2D,
    output: AlgorithmOutput,
    tile: Tile,
    config?: PatternConfig
  ): void {

    if (output.type === 'scalarField') {
      let field = new ScalarField(output.width, output.height, output.data);

      // Apply symmetry if config present
      if (config) {
        field = SymmetryTransform.apply(field, config);
      }

      const mapper = new ColorMapper(config ?? { width: output.width, height: output.height, seed: 0, algorithm: '', renderer: '' });
      const imageData = ctx.createImageData(output.width, output.height);

      for (let i = 0; i < output.width * output.height; i++) {
        const rgb = ColorMapper.toBytes(mapper.map(field.data[i]));
        const idx = i * 4;
        imageData.data[idx]     = rgb[0];
        imageData.data[idx + 1] = rgb[1];
        imageData.data[idx + 2] = rgb[2];
        imageData.data[idx + 3] = 255;
      }
      ctx.putImageData(imageData, tile.offsetX, tile.offsetY);

    } else if (output.type === 'vectorField') {
      const imageData = ctx.createImageData(output.width, output.height);
      const pixelCount = output.width * output.height;
      for (let i = 0; i < pixelCount; i++) {
        const dx = output.data[i * 2];
        const dy = output.data[i * 2 + 1];
        const angle      = Math.atan2(dy, dx);
        const hue        = ((angle / Math.PI) * 180 + 180) % 360;
        const magnitude  = Math.sqrt(dx * dx + dy * dy);
        const brightness = Math.min(magnitude, 1);
        const [r, g, b]  = this.hslToRgb(hue / 360, 0.8, 0.3 + brightness * 0.5);
        const idx = i * 4;
        imageData.data[idx]     = r;
        imageData.data[idx + 1] = g;
        imageData.data[idx + 2] = b;
        imageData.data[idx + 3] = 255;
      }
      ctx.putImageData(imageData, tile.offsetX, tile.offsetY);
    }
  }

  private hslToRgb(h: number, s: number, l: number): [number, number, number] {
    const a = s * Math.min(l, 1 - l);
    const f = (n: number) => {
      const k = (n + h * 12) % 12;
      return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    };
    return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
  }
}