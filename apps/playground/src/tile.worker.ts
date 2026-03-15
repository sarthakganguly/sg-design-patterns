import { PatternEngine } from '@sg-pattern-engine/core';
import { algorithms } from '@sg-pattern-engine/algorithms';
import type { PatternConfig, Tile } from '@sg-pattern-engine/core';

const engine = new PatternEngine();
algorithms.forEach(algo => engine.registerAlgorithm(algo));

interface WorkerInput {
  config: PatternConfig;
  tile: Tile;
}

self.onmessage = async (e: MessageEvent<WorkerInput>) => {
  const { config, tile } = e.data;
  try {
    const output = await engine.generateTile(config, tile);
    if ('data' in output && output.data instanceof Float32Array) {
      // Zero-copy transfer — avoids cloning the Float32Array across threads
      self.postMessage({ result: output }, [output.data.buffer]);
    } else {
      self.postMessage({ result: output });
    }
  } catch (err: any) {
    self.postMessage({ error: err?.message ?? String(err) });
  }
};