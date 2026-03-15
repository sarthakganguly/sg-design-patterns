import { useState, useCallback } from 'react';
import { PatternEngine, PatternConfig, Tile, AlgorithmOutput } from '@sg-pattern-engine/core';
import { algorithms } from '@sg-pattern-engine/algorithms';

export const usePatternEngine = () => {
  const [engine] = useState(() => {
    const e = new PatternEngine();
    algorithms.forEach(algo => e.registerAlgorithm(algo));
    return e;
  });

  const generate = useCallback(async (config: PatternConfig): Promise<{ output: AlgorithmOutput; tile: Tile }[]> => {
    const tiles = engine.getTiles(config);
    const results = [];

    for (const tile of tiles) {
      const output = await engine.generateTile(config, tile);
      results.push({ output, tile });
    }
    return results;
  }, [engine]);

  return { engine, generate };
};