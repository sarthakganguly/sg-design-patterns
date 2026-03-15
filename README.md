# PatternEngine 🎨

A production-grade, deterministic, procedural pattern and animation engine built for high-resolution output across Node.js, browsers, and React applications.

---

## Table of Contents

- [Overview](#overview)
- [Packages](#packages)
- [Core Library](#core-library)
  - [PatternEngine](#patternengine)
  - [Deterministic RNG](#deterministic-rng-prng)
  - [Field System](#field-system)
  - [Tile Renderer](#tile-renderer)
  - [Worker Pool](#worker-pool)
  - [Parameter Explorer](#parameter-explorer)
  - [Buffer Pool](#buffer-pool)
  - [Logger](#logger)
  - [Types & Configuration](#types--configuration)
- [Algorithms](#algorithms)
- [Renderers](#renderers)
- [React Integration](#react-integration)
- [CLI](#cli)
- [Getting Started](#getting-started)
- [Architecture](#architecture)

---

## Overview

PatternEngine solves three hard problems in generative art systems:

1. **Determinism** — the same seed always produces the exact same output, across every environment and across parallel workers.
2. **Scale** — images up to 16384×16384 are supported via automatic tile subdivision and optional multi-threaded rendering.
3. **Extensibility** — algorithms and renderers are plugins; the engine imposes no opinion on what you generate or how you draw it.

---

## Packages

The repository is a pnpm monorepo with the following packages:

| Package | Description |
|---|---|
| `@sg-pattern-engine/core` | Engine, math, fields, tiling, pooling, types |
| `@sg-pattern-engine/algorithms` | Built-in algorithm plugins (Perlin, Flow Field, Voronoi, Reaction-Diffusion) |
| `@sg-pattern-engine/renderers` | Canvas, SVG, and WebGL renderers |
| `@sg-pattern-engine/react` | React component and hook |
| `@sg-pattern-engine/cli` | Command-line interface for batch generation |

---

## Core Library

### PatternEngine

`packages/core/src/engine/PatternEngine.ts`

The central orchestrator. Maintains a registry of algorithm plugins and coordinates tile-based generation.

```typescript
import { PatternEngine } from '@sg-pattern-engine/core';
import { PerlinNoisePlugin } from '@sg-pattern-engine/algorithms';

const engine = new PatternEngine();
engine.registerAlgorithm(new PerlinNoisePlugin());

const config = {
  width: 2048,
  height: 2048,
  seed: 'my-seed',
  algorithm: 'perlin',
  renderer: 'canvas',
};

const tiles = engine.getTiles(config);
for (const tile of tiles) {
  const output = await engine.generateTile(config, tile);
  // pass output to a renderer
}
```

**Key behaviours:**

- `registerAlgorithm(plugin)` — registers a plugin by its `name` property. Registering a duplicate name logs a warning and replaces the previous plugin.
- `getAvailableAlgorithms()` — returns an array of registered algorithm names.
- `generateTile(config, tile)` — runs the algorithm for one tile. Safe to call from a Worker thread. Creates an isolated `PRNG` seeded with `${config.seed}_${tile.id}` so every tile is independently deterministic. Clears the `FieldManager` after generation to prevent memory leaks.
- `getTiles(config)` — delegates to `TileRenderer.generateTiles()` using `config.tileSize` (default 512).

---

### Deterministic RNG (`PRNG`)

`packages/core/src/math/RNG.ts`

A seedable pseudo-random number generator that produces identical floating-point sequences across Node.js, browsers, and Web Workers. Built on two algorithms:

- **cyrb128** — hashes an arbitrary string seed into four 32-bit integers.
- **sfc32** — a fast, high-quality generator driven by those four integers.

The generator is warmed up with 15 iterations after seeding to avoid low-entropy early values.

```typescript
import { PRNG } from '@sg-pattern-engine/core';

const rng = new PRNG('my-seed');

rng.random();            // float in [0, 1)
rng.range(10, 50);       // float in [10, 50)
rng.int(1, 6);           // integer in [1, 6]
rng.pick(['a','b','c']); // random element
```

**Determinism guarantee:** Two `PRNG` instances constructed with the same seed will produce the exact same sequence of values, regardless of platform or call environment. This is the foundation for reproducible tile rendering in parallel workers.

---

### Field System

Fields are the primary data structure passed between algorithms and renderers. They represent a 2D grid of values stored in a `Float32Array` for memory efficiency.

#### ScalarField

`packages/core/src/fields/ScalarField.ts`

Stores a single floating-point value per pixel. Used by algorithms like Perlin noise and Reaction-Diffusion.

```typescript
const field = new ScalarField(512, 512);

field.set(x, y, 0.75);       // write a value
field.get(x, y);              // read a value (returns 0 outside bounds)
field.sample(2.7, 3.4);      // bilinear interpolation
field.sample(x, y, true);    // tileable bilinear interpolation
field.release();              // return buffer to pool
```

**Bilinear interpolation** (`sample`) computes a smooth weighted average across the four nearest grid points, enabling sub-pixel precision when compositing or warping fields.

**Tileable sampling** wraps coordinates using modular arithmetic before interpolation, ensuring seamless tiling across tile boundaries.

#### VectorField

`packages/core/src/fields/VectorField.ts`

Stores a 2D vector `[dx, dy]` per pixel in an interleaved `Float32Array` (`[dx0, dy0, dx1, dy1, ...]`). Used by flow field algorithms.

```typescript
const field = new VectorField(512, 512);

field.set(x, y, dx, dy);      // write a vector
field.get(x, y);               // returns [dx, dy]
field.sample(2.7, 3.4);       // bilinear interpolation on both components
field.sample(x, y, true);     // tileable variant
field.release();               // return buffer to pool
```

Bilinear interpolation is applied independently to both `dx` and `dy` components, preserving smooth directional flow across the field.

#### FieldManager

`packages/core/src/fields/FieldManager.ts`

Manages the lifecycle of fields within a single tile generation pass. The engine calls `fieldManager.clear()` after every tile to release all buffers back to the pool.

```typescript
const manager = new FieldManager();

const scalar = manager.createScalarField('heightmap', 512, 512);
const vector = manager.createVectorField('flow', 512, 512);

manager.getScalarField('heightmap');  // retrieve by id
manager.getVectorField('flow');

manager.clear(); // releases all fields back to BufferPool
```

Calling `createScalarField` or `createVectorField` with an id that already exists returns the existing field rather than allocating a new one.

---

### Tile Renderer

`packages/core/src/engine/TileRenderer.ts`

Subdivides a large canvas into a grid of smaller tiles for parallel or sequential rendering. Critical for supporting resolutions beyond what fits comfortably in a single memory allocation.

```typescript
import { TileRenderer } from '@sg-pattern-engine/core';

const tiles = TileRenderer.generateTiles(4096, 4096, 512);
// returns 64 Tile objects in row-major order
```

Each `Tile` carries:

| Field | Description |
|---|---|
| `id` | Unique identifier, e.g. `"tile_2_3"` |
| `offsetX` / `offsetY` | Position within the full canvas |
| `width` / `height` | Actual pixel dimensions (edge tiles may be smaller) |
| `totalWidth` / `totalHeight` | Full canvas dimensions, available to algorithms |

Edge tiles at the right and bottom boundaries are automatically sized to the remainder, so odd-dimension canvases are handled correctly.

**Supported resolutions:** By default tiles are 512×512. A 16384×16384 canvas produces 1024 tiles. Tile size is configurable via `PatternConfig.tileSize`.

---

### Worker Pool

`packages/core/src/engine/WorkerPool.ts`

A universal thread pool that works with both browser `Web Workers` and Node.js `worker_threads` without modification. The pool is environment-detected at runtime — no bundler configuration required.

```typescript
import { WorkerPool } from '@sg-pattern-engine/core';

const pool = new WorkerPool(
  () => new Worker('./tile.worker.js'), // factory — called once per worker
  navigator.hardwareConcurrency        // pool size, defaults to CPU count
);

const result = await pool.execute({ tileId: 'tile_0_0', config });

pool.terminate(); // clean up all workers
```

**Features:**

- **Queue-based dispatch** — tasks queue automatically when all workers are busy and drain in order.
- **Dead worker recovery** — if a worker throws an unhandled error, the pool removes it and spawns a replacement, keeping the pool at full capacity.
- **Backpressure** — the internal queue is unbounded; callers control concurrency by limiting how many `execute()` promises they create simultaneously.
- **Universal message protocol** — workers post `{ result }` on success or `{ error: string }` on failure.

Default pool size falls back to 4 if `navigator.hardwareConcurrency` is unavailable (e.g. in some Node environments).

---

### Parameter Explorer

`packages/core/src/engine/ParameterExplorer.ts`

Generates a batch of `PatternConfig` variations by sampling parameter ranges with a seeded RNG. Useful for exploring the parameter space, building preview grids, or automated testing.

```typescript
import { ParameterExplorer } from '@sg-pattern-engine/core';

const configs = ParameterExplorer.generateSpace({
  baseConfig: {
    width: 512,
    height: 512,
    algorithm: 'perlin',
    renderer: 'canvas',
  },
  ranges: {
    scale: [0.005, 0.05],
    density: [10, 100],
    complexity: [1, 8],
  },
  samples: 12,
}, 'exploration-seed');
```

Each returned config inherits all `baseConfig` fields and has each range parameter independently sampled. The exploration seed ensures the same set of variations is generated every time.

---

### Buffer Pool

`packages/core/src/utils/BufferPool.ts`

Prevents garbage collection pauses during high-frequency tile generation by recycling `Float32Array` allocations. Particularly important when generating many tiles at high resolution.

```typescript
import { BufferPool } from '@sg-pattern-engine/core';

const buf = BufferPool.acquireFloat32(512 * 512);  // reuses if available
// ... use buf ...
BufferPool.releaseFloat32(buf);  // returns to pool

BufferPool.clear(); // drain the pool entirely
```

**Implementation details:**

- Buffers are keyed by length — a pool entry for size N only serves requests for exactly size N.
- Acquired buffers are zeroed (`fill(0)`) before being returned to the caller.
- Each size bucket is capped at 20 entries to prevent unbounded memory growth when tile sizes vary widely.

`ScalarField` and `VectorField` both use `BufferPool` internally — when you call `field.release()` or `fieldManager.clear()`, the underlying `Float32Array` is returned to the pool for reuse by the next tile.

---

### Logger

`packages/core/src/utils/Logger.ts`

A lightweight structured logger with level filtering and timestamp prefixes.

```typescript
import { Logger } from '@sg-pattern-engine/core';

const log = new Logger('my-module', 'debug');

log.debug('Starting generation', { tileId });
log.info('Tile complete');
log.warn('Algorithm not found, using fallback');
log.error('Worker crashed', err);
```

Log levels in ascending priority: `debug` → `info` → `warn` → `error`. Messages below the configured level are silently suppressed. Output format:

```
[2024-01-15T10:23:41.123Z] [my-module][INFO] Tile complete
```

---

### Types & Configuration

`packages/core/src/types/index.ts`

The `PatternConfig` interface is the single configuration object passed to the engine. All fields except the required four are optional.

#### Required

| Field | Type | Description |
|---|---|---|
| `width` | `number` | Output width in pixels |
| `height` | `number` | Output height in pixels |
| `seed` | `string \| number` | Determinism seed — same seed = same output |
| `algorithm` | `string` | Name of the registered algorithm plugin to use |
| `renderer` | `string` | Hint to the consumer about the intended renderer |

#### Color

| Field | Type | Description |
|---|---|---|
| `bitDepth` | `8 \| 16 \| 32` | Bit depth per channel |
| `colorMode` | `'grayscale' \| 'palette' \| 'gradient' \| 'hsv' \| 'hsl'` | Color mapping mode |
| `palette` | `string[]` | Array of hex color strings for palette mode |
| `paletteSize` | `number` | Number of quantized palette colors |
| `colorVariance` | `number` | Amount of color variation applied per pixel |

#### Geometry

| Field | Type | Description |
|---|---|---|
| `density` | `number` | Point/feature density (algorithm-dependent) |
| `scale` | `number` | Spatial frequency of the pattern |
| `rotation` | `number` | Global rotation in radians |
| `distortion` | `number` | Domain warping strength |
| `warp` | `number` | Secondary warp layer strength |

#### Complexity

| Field | Type | Description |
|---|---|---|
| `iterations` | `number` | Simulation steps or fractal octaves |
| `complexity` | `number` | General complexity multiplier |
| `detailLevel` | `number` | Fine detail preservation amount |

#### Symmetry

| Field | Type | Description |
|---|---|---|
| `symmetryType` | `'none' \| 'mirror' \| 'radial' \| 'kaleidoscope' \| 'tiling'` | Symmetry operation applied post-generation |
| `symmetryCount` | `number` | Radial repeat count for radial/kaleidoscope modes |

#### Noise

| Field | Type | Description |
|---|---|---|
| `noiseType` | `'perlin' \| 'simplex' \| 'fractal'` | Noise basis function hint |
| `randomnessIntensity` | `number` | Amount of stochastic variation |

#### Animation

| Field | Type | Description |
|---|---|---|
| `animate` | `boolean` | Enable animation mode |
| `duration` | `number` | Animation length in seconds (max 30) |
| `fps` | `number` | Target frames per second |
| `loop` | `boolean` | Loop the animation |
| `evolutionSpeed` | `number` | Rate of parameter evolution per frame |

#### Tiling

| Field | Type | Description |
|---|---|---|
| `tileable` | `boolean` | Generate seamlessly tileable output |
| `tileSize` | `number` | Internal render tile size in pixels (default 512) |

#### Output Types

Algorithms return one of five typed output shapes:

```typescript
type AlgorithmOutput =
  | { type: 'points';      data: GeometryPoint[] }
  | { type: 'polylines';   data: GeometryPolyline[] }
  | { type: 'polygons';    data: GeometryPolygon[] }
  | { type: 'scalarField'; data: Float32Array; width: number; height: number }
  | { type: 'vectorField'; data: Float32Array; width: number; height: number }
```

Renderers inspect `output.type` to determine how to draw the data.

---

## Algorithms

`packages/algorithms`

All algorithms implement the `AlgorithmPlugin` interface and receive an `AlgorithmContext` containing a seeded `PRNG`, a `FieldManager`, the current `Tile`, the full `PatternConfig`, and a `Logger`.

### Perlin Noise (`perlin`)

A hash-based scalar noise field. Samples a deterministic `sin`-based approximation at each pixel, scaled by `config.scale` (default `0.01`) and offset by tile position for seamless stitching. Returns a `scalarField` with values in `[0, 1]`.

### Flow Field (`flowField`)

Assigns a random angle to every grid cell and stores it as a unit vector `[cos θ, sin θ]`. Returns a `vectorField` suitable for particle simulation or directional colour mapping.

### Voronoi (`voronoi`)

Scatters `config.density` (default 50) random seed points across the full canvas coordinate space using the tile's `totalWidth`/`totalHeight`. Returns a `points` output for renderers to compute Voronoi regions.

### Reaction-Diffusion (`reactionDiffusion`)

A Gray-Scott simulation initialised with sparse random activation (~10% of cells). Returns a `scalarField` representing the chemical concentration grid at the initial state, ready for further simulation steps.

---

## Renderers

`packages/renderers`

### CanvasRenderer

Renders directly to a `CanvasRenderingContext2D`. Handles tile stitching via `putImageData` at the tile's `offsetX`/`offsetY`.

- **scalarField** — maps `[0, 1]` values to grayscale RGBA pixels.
- **vectorField** — maps angle to hue and magnitude to brightness using HSL colour, producing a directional colour wheel visualisation.

### SVGRenderer

Converts geometry outputs to SVG markup strings.

- **points** — each `GeometryPoint` becomes a `<circle>` element.
- Returns a complete `<svg>` string ready to inject into the DOM or write to a file.

### WebGLRenderer

GPU-accelerated rendering via `WebGL2`. Accepts a canvas element at construction and uploads `scalarField` data as a texture for real-time rendering via custom fragment shaders.

---

## React Integration

`packages/react`

### `PatternCanvas`

A React component that manages a `<canvas>` element and re-renders whenever `config` changes.

```tsx
import { PatternCanvas } from '@sg-pattern-engine/react';

<PatternCanvas config={{
  width: 1024,
  height: 1024,
  seed: 'abc',
  algorithm: 'perlin',
  renderer: 'canvas',
}} />
```

### `usePatternEngine`

A hook that creates a `PatternEngine`, registers all built-in algorithms once on mount, and exposes a `generate` function.

```typescript
const { engine, generate } = usePatternEngine();

const results = await generate(config);
// results: Array<{ output: AlgorithmOutput; tile: Tile }>
```

The engine is memoised via `useState` initializer — algorithm registration runs exactly once and never races with render effects.

---

## CLI

`packages/cli`

```bash
pattern-engine generate --width 2048 --height 2048 --output result.png
pattern-engine generate --config ./my-config.json --output result.png
```

| Flag | Description |
|---|---|
| `-c, --config <path>` | Path to a JSON `PatternConfig` file |
| `-w, --width <number>` | Canvas width (ignored if `--config` is used) |
| `-h, --height <number>` | Canvas height (ignored if `--config` is used) |
| `-o, --output <path>` | Output file path (default: `output.png`) |

When no config file is provided, the CLI defaults to a 1024×1024 Perlin noise render with a random seed.

---

## Getting Started

```bash
# Install dependencies
pnpm install

# Start the playground (Vite dev server on :5173)
pnpm run playground

# Build all packages
pnpm run build

# Run tests
pnpm run test
```

---

## Architecture

```
PatternConfig
     │
     ▼
PatternEngine.getTiles()
     │
     ▼
TileRenderer ──► [ Tile, Tile, Tile, ... ]
     │
     ▼
PatternEngine.generateTile(config, tile)
     │
     ├── PRNG(seed + tileId)       ← isolated per tile
     ├── FieldManager              ← scoped to this tile
     └── AlgorithmPlugin.generate(ctx)
              │
              ▼
         AlgorithmOutput
              │
     ┌────────┼────────┐
     ▼        ▼        ▼
Canvas      SVG      WebGL
Renderer  Renderer  Renderer
```

Each tile is fully self-contained: its `PRNG` is seeded with both the global seed and the tile ID, so tiles can be generated in any order or in parallel without coordination, and the assembled result is always identical to a sequential single-threaded run.