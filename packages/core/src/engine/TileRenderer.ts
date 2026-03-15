import { Tile } from '../types';

export class TileRenderer {
  /**
   * Subdivides a massive resolution into manageable rendering tiles.
   * Crucial for supporting up to 16384x16384 rendering.
   */
  public static generateTiles(width: number, height: number, tileSize: number = 512): Tile[] {
    const tiles: Tile[] =[];
    const cols = Math.ceil(width / tileSize);
    const rows = Math.ceil(height / tileSize);

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const offsetX = x * tileSize;
        const offsetY = y * tileSize;
        const currentWidth = Math.min(tileSize, width - offsetX);
        const currentHeight = Math.min(tileSize, height - offsetY);

        tiles.push({
          id: `tile_${x}_${y}`,
          offsetX,
          offsetY,
          width: currentWidth,
          height: currentHeight,
          totalWidth: width,
          totalHeight: height,
        });
      }
    }

    return tiles;
  }
}