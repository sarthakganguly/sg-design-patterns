import { PerlinNoisePlugin } from './noise/perlin';
import { FlowFieldPlugin } from './particles/flowField';
import { VoronoiPlugin } from './geometry/voronoi';
import { ReactionDiffusionPlugin } from './automata/reactionDiffusion';

export const algorithms = [
  new PerlinNoisePlugin(),
  new FlowFieldPlugin(),
  new VoronoiPlugin(),
  new ReactionDiffusionPlugin()
];

export * from './noise/perlin';
export * from './particles/flowField';
export * from './geometry/voronoi';
export * from './automata/reactionDiffusion';