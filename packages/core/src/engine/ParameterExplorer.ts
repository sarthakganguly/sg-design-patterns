import { PatternConfig } from '../types';
import { PRNG } from '../math/RNG';

export interface ExplorationConfig {
  baseConfig: Partial<PatternConfig>;
  ranges: Record<string, [number, number]>;
  samples: number;
}

export class ParameterExplorer {
  /**
   * Generates multiple variations of a configuration for parameter space exploration.
   */
  public static generateSpace(exploreConfig: ExplorationConfig, seed: string = 'explore'): PatternConfig[] {
    const rng = new PRNG(seed);
    const configs: PatternConfig[] =[];
    const keys = Object.keys(exploreConfig.ranges);

    for (let i = 0; i < exploreConfig.samples; i++) {
      const config: any = { ...exploreConfig.baseConfig, seed: rng.random().toString() };
      
      for (const key of keys) {
        const [min, max] = exploreConfig.ranges[key];
        config[key] = rng.range(min, max);
      }

      configs.push(config as PatternConfig);
    }

    return configs;
  }
}