import { AlgorithmPlugin, AlgorithmContext, AlgorithmOutput } from '@sg-pattern-engine/core';

export class FlowFieldPlugin implements AlgorithmPlugin {
  name = 'flowField';

  generate(ctx: AlgorithmContext): AlgorithmOutput {
    const { width, height } = ctx.tile;
    const field = ctx.fieldManager.createVectorField('flow', width, height);
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const angle = ctx.rng.random() * Math.PI * 2;
        field.set(x, y, Math.cos(angle), Math.sin(angle));
      }
    }
    return { type: 'vectorField', data: field.data, width, height };
  }
}