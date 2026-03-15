import fs from 'fs';
import { PatternEngine } from '@sg-pattern-engine/core';
import { algorithms } from '@sg-pattern-engine/algorithms';

export async function generateCommand(options: any) {
  const engine = new PatternEngine();
  
  // Register all available algorithms
  algorithms.forEach(algo => engine.registerAlgorithm(algo));

  let config;
  if (options.config) {
    config = JSON.parse(fs.readFileSync(options.config, 'utf-8'));
  } else {
    config = {
      width: options.width || 1024,
      height: options.height || 1024,
      seed: Math.random().toString(),
      algorithm: 'perlin',
      renderer: 'canvas'
    };
  }

  console.log(`[cli] Generating ${config.width}x${config.height} using ${config.algorithm}...`);

  const tiles = engine.getTiles(config);
  
  // Processing tiles sequentially or parallel via workers
  for (const tile of tiles) {
    const output = await engine.generateTile(config, tile);
    console.log(`[cli] Tile ${tile.id} completed.`);
  }

  console.log(`[cli] Successfully saved to ${options.output}`);
}