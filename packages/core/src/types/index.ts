export type ColorMode = 'grayscale' | 'palette' | 'gradient' | 'hsv' | 'hsl';
export type SymmetryType = 'none' | 'mirror' | 'radial' | 'kaleidoscope' | 'tiling';
export type NoiseType = 'perlin' | 'simplex' | 'fractal';

export interface PatternConfig {
  width: number;
  height: number;
  seed: string | number;
  algorithm: string;
  renderer: string;
  
  // Color
  bitDepth?: 8 | 16 | 32;
  colorMode?: ColorMode;
  palette?: string[];
  paletteSize?: number;
  colorVariance?: number;

  // Geometry
  density?: number;
  scale?: number;
  rotation?: number;
  distortion?: number;
  warp?: number;

  // Complexity
  iterations?: number;
  complexity?: number;
  detailLevel?: number;

  // Symmetry
  symmetryType?: SymmetryType;
  symmetryCount?: number;

  // Noise
  noiseType?: NoiseType;
  randomnessIntensity?: number;

  // Animation
  animate?: boolean;
  duration?: number; // max 30
  fps?: number;
  loop?: boolean;
  evolutionSpeed?: number;

  // Tile rendering
  tileable?: boolean;
  tileSize?: number; // default 512
}

export interface Tile {
  id: string;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
  totalWidth: number;
  totalHeight: number;
}

export interface GeometryPoint { x: number; y: number; value?: number; }
export interface GeometryPolyline { points: GeometryPoint[]; closed: boolean; }
export interface GeometryPolygon { vertices: GeometryPoint[]; }

export type AlgorithmOutput = 
  | { type: 'points'; data: GeometryPoint[] }
  | { type: 'polylines'; data: GeometryPolyline[] }
  | { type: 'polygons'; data: GeometryPolygon[] }
  | { type: 'scalarField'; data: Float32Array; width: number; height: number }
  | { type: 'vectorField'; data: Float32Array; width: number; height: number };

export interface AlgorithmContext {
  rng: import('../math/RNG').PRNG;
  fieldManager: import('../fields/FieldManager').FieldManager;
  tile: Tile;
  config: PatternConfig;
  logger: import('../utils/Logger').Logger;
}

export interface AlgorithmPlugin {
  name: string;
  generate(ctx: AlgorithmContext): AlgorithmOutput | Promise<AlgorithmOutput>;
}