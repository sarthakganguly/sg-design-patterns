import { AlgorithmPlugin, AlgorithmContext, AlgorithmOutput } from '@sg-pattern-engine/core';

// Simplified deterministic Perlin implementation
export class PerlinNoisePlugin implements AlgorithmPlugin {
  name = 'perlin';

  generate(ctx: AlgorithmContext): AlgorithmOutput {
    const { width, height } = ctx.tile;
    const field = ctx.fieldManager.createScalarField('perlin', width, height);
    const scale = ctx.config.scale || 0.01;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < ctx.tile.width; x++) {
        const val = this.noise(
          (ctx.tile.offsetX + x) * scale, 
          (ctx.tile.offsetY + y) * scale,
          ctx.rng.random()
        );
        field.set(x, y, val);
      }
    }
    return { type: 'scalarField', data: field.data, width, height };
  }

  private noise(x: number, y: number, seed: number): number {
    // Deterministic hash-based noise approximation
    return Math.sin(x * 12.9898 + y * 78.233 + seed * 43758.5453) * 0.5 + 0.5;
  }
}