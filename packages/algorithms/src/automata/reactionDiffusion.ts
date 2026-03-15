import { AlgorithmPlugin, AlgorithmContext, AlgorithmOutput } from '@sg-pattern-engine/core';

/**
 * Gray-Scott reaction-diffusion simulation.
 * Returns the chemical concentration as a scalar field.
 */
export class ReactionDiffusionPlugin implements AlgorithmPlugin {
  name = 'reactionDiffusion';

  generate(ctx: AlgorithmContext): AlgorithmOutput {
    const { width, height } = ctx.tile;
    const field = ctx.fieldManager.createScalarField('rd', width, height);
    
    // Initial random state
    for (let i = 0; i < field.data.length; i++) {
      field.data[i] = ctx.rng.random() > 0.9 ? 1 : 0;
    }
    
    return { type: 'scalarField', data: field.data, width, height };
  }
}