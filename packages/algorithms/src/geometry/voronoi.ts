import { AlgorithmPlugin, AlgorithmContext, AlgorithmOutput } from '@sg-pattern-engine/core';

export class VoronoiPlugin implements AlgorithmPlugin {
  name = 'voronoi';

  generate(ctx: AlgorithmContext): AlgorithmOutput {
    const pointsCount = ctx.config.density || 50;
    const points = [];

    for (let i = 0; i < pointsCount; i++) {
      points.push({
        x: ctx.rng.random() * ctx.tile.totalWidth,
        y: ctx.rng.random() * ctx.tile.totalHeight
      });
    }

    return { type: 'points', data: points };
  }
}