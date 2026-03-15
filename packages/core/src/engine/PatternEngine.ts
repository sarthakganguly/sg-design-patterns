import { AlgorithmPlugin, PatternConfig, AlgorithmOutput, Tile } from '../types';
import { Logger } from '../utils/Logger';
import { FieldManager } from '../fields/FieldManager';
import { PRNG } from '../math/RNG';
import { TileRenderer } from './TileRenderer';

export class PatternEngine {
  private algorithms: Map<string, AlgorithmPlugin> = new Map();
  private logger = new Logger('PatternEngine');

  constructor() {
    this.logger.info('Engine initialized');
  }

  public registerAlgorithm(plugin: AlgorithmPlugin) {
    if (this.algorithms.has(plugin.name)) {
      this.logger.warn(`Overwriting existing algorithm: ${plugin.name}`);
    }
    this.algorithms.set(plugin.name, plugin);
    this.logger.debug(`Registered algorithm: ${plugin.name}`);
  }

  public getAvailableAlgorithms(): string[] {
    return Array.from(this.algorithms.keys());
  }

  /**
   * Generates geometry/fields for a specific tile.
   * This is safe to run inside a Worker thread.
   */
  public async generateTile(config: PatternConfig, tile: Tile): Promise<AlgorithmOutput> {
    const start = performance.now();
    const algorithm = this.algorithms.get(config.algorithm);

    if (!algorithm) {
      throw new Error(`Algorithm '${config.algorithm}' not found`);
    }

    // Isolate randomness to the tile to ensure deterministic parallel rendering
    const tileSeed = `${config.seed}_${tile.id}`;
    const rng = new PRNG(tileSeed);
    const fieldManager = new FieldManager();

    const context = {
      rng,
      fieldManager,
      tile,
      config,
      logger: this.logger
    };

    const output = await algorithm.generate(context);
    
    // Clear cache to prevent memory leaks in workers
    fieldManager.clear();

    const end = performance.now();
    this.logger.debug(`Tile ${tile.id} generated in ${(end - start).toFixed(2)}ms`);

    return output;
  }

  /**
   * Helper to get tiles for a given config
   */
  public getTiles(config: PatternConfig): Tile[] {
    return TileRenderer.generateTiles(
      config.width, 
      config.height, 
      config.tileSize || 512
    );
  }
}