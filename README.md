# SG Pattern Engine 🎨

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
  - [Symmetry Transform](#symmetry-transform)
  - [Color Mapper](#color-mapper)
  - [Animation Loop](#animation-loop)
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
| `@sg-pattern-engine/core` | Engine, math, fields, tiling, pooling, transforms, animation, types |
| `@sg-pattern-engine/algorithms` | Built-in algorithm plugins (Perlin, Flow Field, Voronoi, Reaction-Diffusion) |
| `@sg-pattern-engine/renderers` | Canvas 2D, SVG, and WebGL2 renderers |
| `@sg-pattern-engine/react` | React component and hook with built-in worker pool support |
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

**Supported resolutions:** By default tiles are 512×512. A 16384×16384 canvas produces 1024 tiles. Tile size is configurable via `PatternConfig.tileSize`. Smaller tiles increase parallelism at the cost of more pool overhead; larger tiles reduce overhead but require more memory per worker.

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

const result = await pool.execute({ config, tile });

pool.terminate(); // clean up all workers
```

**Features:**

- **Queue-based dispatch** — tasks queue automatically when all workers are busy and drain in FIFO order.
- **Dead worker recovery** — if a worker throws an unhandled error, the pool removes it and spawns a replacement, keeping the pool at full capacity.
- **Zero-copy transfers** — `Float32Array` buffers are transferred (not copied) between threads using `postMessage` transferables, avoiding the cost of serialising large typed arrays.
- **Observable state** — `pool.size`, `pool.pending`, and `pool.active` expose the current pool state for monitoring.
- **Factory pattern** — the caller supplies a worker factory function, keeping the pool bundler-agnostic (Vite, Webpack, and Node all instantiate workers differently).

**Worker entry point pattern:**

```typescript
// tile.worker.ts
import { PatternEngine } from '@sg-pattern-engine/core';
import { algorithms } from '@sg-pattern-engine/algorithms';

const engine = new PatternEngine();
algorithms.forEach(algo => engine.registerAlgorithm(algo));

self.onmessage = async (e) => {
  const { config, tile } = e.data;
  try {
    const output = await engine.generateTile(config, tile);
    // Transfer the buffer rather than copy it
    if ('data' in output && output.data instanceof Float32Array) {
      self.postMessage({ result: output }, [output.data.buffer]);
    } else {
      self.postMessage({ result: output });
    }
  } catch (err) {
    self.postMessage({ error: err?.message ?? String(err) });
  }
};
```

Each worker holds its own `PatternEngine` instance with all algorithms registered. Because each tile's `PRNG` is seeded independently, workers produce identical results regardless of execution order.

---

### Symmetry Transform

`packages/core/src/transforms/SymmetryTransform.ts`

Applies post-generation symmetry operations to a `ScalarField`. Called after tile generation, before rendering.

```typescript
import { SymmetryTransform } from '@sg-pattern-engine/core';

const result = SymmetryTransform.apply(field, config);
```

Symmetry is controlled by `config.symmetryType` and `config.symmetryCount`:

| Mode | Description |
|---|---|
| `'none'` | No transformation (default) |
| `'mirror'` | Right half is a horizontal mirror of the left half |
| `'radial'` | Canvas divided into `symmetryCount` pie slices; all slices are copies of slice 0 |
| `'kaleidoscope'` | Radial symmetry with each slice additionally mirrored around its bisector |

Radial and kaleidoscope modes use bilinear sampling (`ScalarField.sample`) to avoid aliasing when rotating the source data into each slice. The `'mirror'` operation is in-place; `'radial'` and `'kaleidoscope'` return a new `ScalarField`.

---

### Color Mapper

`packages/core/src/transforms/ColorMapper.ts`

Maps scalar values in `[0, 1]` to RGB triples according to `config.colorMode`. Used by `CanvasRenderer` to apply colour before writing pixels.

```typescript
import { ColorMapper } from '@sg-pattern-engine/core';

const mapper = new ColorMapper(config);

const rgb   = mapper.map(0.72);          // returns [r, g, b] floats in [0, 1]
const bytes = ColorMapper.toBytes(rgb);  // returns [r, g, b] integers in [0, 255]
```

| Mode | Behaviour |
|---|---|
| `'grayscale'` | `rgb(v, v, v)` — default |
| `'hsl'` | Hue cycles full spectrum; saturation 0.8, lightness 0.5 |
| `'hsv'` | Hue cycles full spectrum; saturation 0.9, value equals input |
| `'gradient'` | Linear interpolation between `palette[0]` and `palette[1]` |
| `'palette'` | Linear interpolation across all stops in `config.palette` |

Palette colours are specified as hex strings (`'#ff6b35'`). For `'gradient'` mode two colours are required. For `'palette'` mode any number of stops are supported — `ColorMapper` linearly interpolates between adjacent stops.

---

### Animation Loop

`packages/core/src/animation/AnimationLoop.ts`

Drives frame-by-frame animation using `requestAnimationFrame` in browsers, with an offline batch mode for export and Node.js use.

```typescript
import { AnimationLoop } from '@sg-pattern-engine/core';

const loop = new AnimationLoop(config);

// Browser: drive via requestAnimationFrame
loop.start(async (frame) => {
  // frame.frameIndex  — 0-based index
  // frame.totalFrames — total frames for this animation
  // frame.time        — elapsed seconds
  // frame.progress    — 0..1
  // frame.seed        — per-frame derived seed string
  await renderFrame(frame.seed);
});

loop.stop();
loop.isRunning; // boolean

// Offline: render all frames sequentially (no RAF, works in Node)
await loop.renderAll(async (frame) => {
  await renderAndSave(frame);
});
```

**Frame count** is derived from `config.fps` × `config.duration` (duration capped at 30 seconds). Each frame receives a unique `seed` string (`${config.seed}_frame_${frameIndex}`) so generation is deterministic per-frame.

**`evolutionSpeed`** controls how quickly the seed drifts between frames. At `1.0` every frame gets a fully distinct seed. At lower values, nearby frames share the same seed, producing slow gradual evolution.

---

### Parameter Explorer

`packages/core/src/engine/ParameterExplorer.ts`

Generates a batch of randomised `PatternConfig` variations for exploring the parameter space of any algorithm.

```typescript
import { ParameterExplorer } from '@sg-pattern-engine/core';

const configs = ParameterExplorer.generateSpace({
  baseConfig: {
    width: 1024,
    height: 1024,
    algorithm: 'reactionDiffusion',
    renderer: 'canvas',
  },
  ranges: {
    feedRate:   [0.03, 0.065],
    killRate:   [0.055, 0.07],
    iterations: [500, 5000],
  },
  samples: 16,
}, 'exploration-seed-42');
```

Each returned config has a unique `seed` derived from the exploration seed, so the entire exploration is itself reproducible. `ranges` maps any numeric `PatternConfig` property to a `[min, max]` interval, sampled uniformly at random.

---

### Buffer Pool

`packages/core/src/utils/BufferPool.ts`

Prevents GC pauses by pooling and reusing large `Float32Array` allocations. At high resolutions, allocating and discarding typed arrays repeatedly causes significant garbage collection pressure.

```typescript
import { BufferPool } from '@sg-pattern-engine/core';

const buf = BufferPool.acquireFloat32(512 * 512);
// ... use buf ...
BufferPool.releaseFloat32(buf); // zero-fills and returns to pool
```

- `acquireFloat32(size)` — returns a zeroed array of exactly `size` elements, from the pool if available or freshly allocated.
- `releaseFloat32(arr)` — zero-fills and returns the array to the pool. The pool is capped at 20 arrays per size to prevent unbounded memory growth.
- `BufferPool.clear()` — empties all buckets, useful in tests or when switching resolutions.

`ScalarField` and `VectorField` use `BufferPool` internally. Calling `field.release()` is sufficient.

---

### Logger

`packages/core/src/utils/Logger.ts`

A structured, prefix-aware logger with level filtering. Passed to every algorithm through `AlgorithmContext.logger`.

```typescript
import { Logger } from '@sg-pattern-engine/core';

const logger = new Logger('my-plugin', 'debug');

logger.debug('computing field...');
logger.info('tile complete', { tileId, durationMs });
logger.warn('seed collision detected');
logger.error('field allocation failed', error);
```

Output format: `[ISO timestamp] [prefix][LEVEL] message`

Log levels in ascending priority: `debug < info < warn < error`. Setting the level to `warn` suppresses `debug` and `info` output. The engine uses `'info'` by default.

---

### Types & Configuration

`packages/core/src/types/index.ts`

#### PatternConfig — required fields

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
| `colorMode` | `'grayscale' \| 'palette' \| 'gradient' \| 'hsv' \| 'hsl'` | Color mapping mode applied by `ColorMapper` |
| `palette` | `string[]` | Hex color strings; two for gradient, any number for palette |
| `paletteSize` | `number` | Number of quantized palette colors |
| `colorVariance` | `number` | Amount of color variation applied per pixel |

#### Geometry

| Field | Type | Description |
|---|---|---|
| `density` | `number` | Point/feature density — used by Voronoi (default 50) |
| `scale` | `number` | Spatial frequency — used by Perlin (default 0.01) |
| `rotation` | `number` | Global rotation in radians |
| `distortion` | `number` | Domain warping strength |
| `warp` | `number` | Secondary warp layer strength |

#### Complexity

| Field | Type | Description |
|---|---|---|
| `iterations` | `number` | Simulation steps — used by Reaction-Diffusion (default 2000) |
| `complexity` | `number` | General complexity multiplier |
| `detailLevel` | `number` | Fine detail preservation amount |

#### Symmetry

| Field | Type | Description |
|---|---|---|
| `symmetryType` | `'none' \| 'mirror' \| 'radial' \| 'kaleidoscope'` | Symmetry operation applied post-generation |
| `symmetryCount` | `number` | Segment count for radial/kaleidoscope modes |

#### Noise

| Field | Type | Description |
|---|---|---|
| `noiseType` | `'perlin' \| 'simplex' \| 'fractal'` | Noise basis function hint |
| `randomnessIntensity` | `number` | Amount of stochastic variation |

#### Reaction-Diffusion

| Field | Type | Description |
|---|---|---|
| `feedRate` | `number` | Gray-Scott feed rate `f` (default 0.0545) |
| `killRate` | `number` | Gray-Scott kill rate `k` (default 0.062) |

#### Animation

| Field | Type | Description |
|---|---|---|
| `animate` | `boolean` | Enable animation mode |
| `duration` | `number` | Animation length in seconds (max 30) |
| `fps` | `number` | Target frames per second |
| `loop` | `boolean` | Loop the animation |
| `evolutionSpeed` | `number` | Rate of seed evolution per frame (0..1) |

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

Renderers inspect `output.type` to determine how to draw the data. `scalarField` and `vectorField` buffers are pooled — do not hold references after the render pass.

---

## Algorithms

`packages/algorithms`

All algorithms implement the `AlgorithmPlugin` interface and receive an `AlgorithmContext` containing a seeded `PRNG`, a `FieldManager`, the current `Tile`, the full `PatternConfig`, and a `Logger`.

### Perlin Noise (`perlin`)

A hash-based scalar noise field. Samples a deterministic `sin`-based approximation at each pixel, scaled by `config.scale` (default `0.01`) and offset by tile position for seamless stitching across tile boundaries. Returns a `scalarField` with values in `[0, 1]`.

### Flow Field (`flowField`)

Assigns a random angle to every grid cell and stores it as a unit vector `[cos θ, sin θ]`. Returns a `vectorField` suitable for particle simulation or directional colour mapping.

### Voronoi (`voronoi`)

Scatters `config.density` (default 50) random seed points across the full canvas coordinate space. Returns a `points` output for renderers to compute Voronoi cell boundaries via nearest-neighbour distance.

### Reaction-Diffusion (`reactionDiffusion`)

A full Gray-Scott reaction-diffusion simulation. Two chemical species A (activator) and B (inhibitor) diffuse across the grid and react according to:

```
A + 2B → 3B    (A consumed, B produced)
B → P          (B decays at kill rate k)
```

**Initialisation:** A is seeded to `1.0` everywhere. Circular patches of B are placed at random positions — approximately `0.1%` of total pixels as patch centres, each with radius `~4%` of the tile's shorter dimension, with small noise applied to the initial B values.

**Iteration:** Each step applies a discrete 5-point Laplacian stencil with wrap-around boundary conditions, then updates both species simultaneously. Steps are controlled by `config.iterations` (default 2000).

Returns the B-channel `scalarField` — the species where patterns form. Values in `[0, 1]`.

**Gray-Scott parameters:**

| Parameter | Config field | Default | Effect |
|---|---|---|---|
| Feed rate | `feedRate` | `0.0545` | Rate at which A is replenished |
| Kill rate | `killRate` | `0.062` | Rate at which B decays |

**Named presets:**

| Preset | `feedRate` | `killRate` | Visual character |
|---|---|---|---|
| Coral | 0.0545 | 0.062 | Branching coral-like growth |
| Mitosis | 0.0367 | 0.0649 | Dividing cell spots |
| Worms | 0.058 | 0.065 | Long winding filaments |
| Spots | 0.035 | 0.060 | Isolated circular spots |
| Solitons | 0.030 | 0.060 | Stable travelling waves |

**Performance note:** 2000 iterations on a 512×512 tile takes 1–3 seconds on a modern CPU. Use a `WorkerPool` — with a 4-core pool and a 1024×1024 canvas (4 tiles), all tiles run in parallel and wall time drops to approximately one tile's worth.

---

## Renderers

`packages/renderers`

### CanvasRenderer

`packages/renderers/src/canvas/CanvasRenderer.ts`

Renders directly to a `CanvasRenderingContext2D`. Handles tile stitching via `putImageData` at the tile's `offsetX`/`offsetY`. Accepts an optional `PatternConfig` to apply colour mapping and symmetry.

```typescript
import { CanvasRenderer } from '@sg-pattern-engine/renderers';

const renderer = new CanvasRenderer();
renderer.render(ctx, output, tile, config);
```

**scalarField** — passes each value through `ColorMapper` before writing pixels. Respects `config.colorMode` and `config.palette`. Applies `SymmetryTransform` if `config.symmetryType` is set.

**vectorField** — maps vector angle to hue and magnitude to brightness using HSL colour, producing a directional colour-wheel visualisation. Not affected by `colorMode`.

### SVGRenderer

`packages/renderers/src/svg/SVGRenderer.ts`

Converts geometry outputs to SVG markup strings. Does not require a DOM — suitable for server-side generation.

```typescript
import { SVGRenderer } from '@sg-pattern-engine/renderers';

const renderer = new SVGRenderer();
const svg = renderer.render(output); // returns complete <svg>...</svg> string
```

- **points** — each `GeometryPoint` becomes a `<circle cx cy r="2" fill="black" />` element.

### WebGLRenderer

`packages/renderers/src/webgl/WebGLRenderer.ts`

GPU-accelerated rendering via WebGL2. Two GLSL shader programs handle the two primary output types, with colour mode support in the scalar shader.

```typescript
import { WebGLRenderer } from '@sg-pattern-engine/renderers';

const renderer = new WebGLRenderer(canvasElement);
renderer.render(output, colorMode, palette);
renderer.dispose(); // release GPU resources
```

**scalarField** — uploads data as an `R32F` texture. The fragment shader applies the colour mode in GLSL:

| `colorMode` | Shader behaviour |
|---|---|
| `'grayscale'` | `rgb(v, v, v)` |
| `'hsl'` | Full hue cycle at saturation 0.8, lightness 0.5 |
| `'hsv'` | Full hue cycle at saturation 0.9, value = input |
| `'gradient'` | `mix(palA, palB, v)` — uses first two palette colours |

**vectorField** — packs `[dx, dy]` into an `RG8` texture (normalised to `0..255`). The fragment shader decodes the vectors and maps angle to hue and magnitude to lightness.

Both shader programs share a single full-screen quad VAO drawn with `TRIANGLE_STRIP`. Call `dispose()` to release the texture, VAO, and both shader programs when the renderer is no longer needed.

---

## React Integration

`packages/react`

### `PatternCanvas`

A React component that manages a `<canvas>` element, re-renders whenever `config` changes, and optionally drives an animation loop.

```tsx
import { PatternCanvas } from '@sg-pattern-engine/react';

// Static render
<PatternCanvas config={config} workerFactory={makeWorker} />

// Animated
<PatternCanvas
  config={{ ...config, animate: true, fps: 30, duration: 10, loop: true }}
  workerFactory={makeWorker}
/>
```

When `config.animate` is `true`, the component creates an `AnimationLoop` and calls `generate()` for each frame using a per-frame derived seed. `evolutionSpeed` controls how quickly the seed drifts — lower values produce slow gradual evolution.

`workerFactory` is optional. When omitted, generation runs sequentially on the main thread.

### `usePatternEngine`

A hook that creates a `PatternEngine`, registers all built-in algorithms, optionally creates a `WorkerPool`, and exposes a `generate` function.

```typescript
function makeWorker() {
  return new Worker(
    new URL('./tile.worker.ts', import.meta.url),
    { type: 'module' }
  );
}

const { engine, generate } = usePatternEngine(makeWorker, 4);

const results = await generate(config);
// results: Array<{ output: AlgorithmOutput; tile: Tile }>
```

| Argument | Type | Description |
|---|---|---|
| `workerFactory` | `() => Worker` | Optional factory for spawning tile workers |
| `concurrency` | `number` | Pool size — defaults to `navigator.hardwareConcurrency` |

When a `workerFactory` is provided, all tiles are dispatched to the pool concurrently via `Promise.all`. When omitted, tiles are generated sequentially on the main thread as a fallback.

The engine instance is stable across re-renders (created in `useState` initializer). The worker pool is created in `useEffect` and terminated on unmount.

**Vite worker factory pattern:**

```typescript
// Define outside the component so the reference is stable across renders
function makeWorker() {
  return new Worker(
    new URL('./tile.worker.ts', import.meta.url),
    { type: 'module' }
  );
}
```

The `new URL(..., import.meta.url)` syntax is resolved by Vite at build time to a separate worker chunk. The file must live in the same app as the component using it — `import.meta.url` is relative to the file that contains it.

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
     ├── Sequential (main thread fallback)
     └── Parallel (WorkerPool)
              │
              ▼ per tile
     PatternEngine.generateTile(config, tile)
              │
              ├── PRNG(seed + tileId)       ← isolated per tile
              ├── FieldManager              ← scoped to this tile
              └── AlgorithmPlugin.generate(ctx)
                       │
                       ▼
                  AlgorithmOutput
                       │
              ┌────────┼────────────┐
              ▼        ▼            ▼
        CanvasRenderer  SVGRenderer  WebGLRenderer
              │
         ColorMapper        ← colorMode / palette
         SymmetryTransform  ← symmetryType / symmetryCount
              │
              ▼
      CanvasRenderingContext2D
```

**Parallelism model:** Each tile's `PRNG` is seeded with both the global seed and the tile ID (`${seed}_tile_x_y`), so tiles can be generated in any order or in parallel without coordination. The assembled result is always bit-identical to a sequential single-threaded run.

**Memory model:** `Float32Array` buffers flow from `BufferPool` → `ScalarField`/`VectorField` → `AlgorithmOutput` → renderer → back to `BufferPool` via `field.release()`. Worker threads transfer (not copy) the output buffer back to the main thread using the `postMessage` transferable mechanism, avoiding a full memory copy at the thread boundary.