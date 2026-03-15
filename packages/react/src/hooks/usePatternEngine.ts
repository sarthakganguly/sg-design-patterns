import { useState, useCallback, useEffect, useRef } from 'react';
import {
  PatternEngine,
  PatternConfig,
  Tile,
  AlgorithmOutput,
  WorkerPool,
} from '@sg-pattern-engine/core';
import { algorithms } from '@sg-pattern-engine/algorithms';

export interface TileResult {
  output: AlgorithmOutput;
  tile: Tile;
}

interface WorkerMessage {
  config: PatternConfig;
  tile: Tile;
}

export const usePatternEngine = (
  workerFactory?: () => Worker,
  concurrency?: number
) => {
  const [engine] = useState(() => {
    const e = new PatternEngine();
    algorithms.forEach(algo => e.registerAlgorithm(algo));
    return e;
  });

  const poolRef = useRef<WorkerPool<WorkerMessage, AlgorithmOutput> | null>(null);

  useEffect(() => {
    if (!workerFactory) return;
    const poolSize = concurrency ?? (navigator.hardwareConcurrency ?? 4);
    poolRef.current = new WorkerPool<WorkerMessage, AlgorithmOutput>(
      workerFactory,
      poolSize
    );
    return () => {
      poolRef.current?.terminate();
      poolRef.current = null;
    };
  }, [workerFactory, concurrency]);

  const generate = useCallback(async (config: PatternConfig): Promise<TileResult[]> => {
    const tiles = engine.getTiles(config);
    const pool  = poolRef.current;

    if (pool) {
      const outputs = await Promise.all(
        tiles.map(tile => pool.execute({ config, tile }))
      );
      return outputs.map((output, i) => ({ output, tile: tiles[i] }));
    } else {
      const results: TileResult[] = [];
      for (const tile of tiles) {
        const output = await engine.generateTile(config, tile);
        results.push({ output, tile });
      }
      return results;
    }
  }, [engine]);

  return { engine, generate };
};