# @sg-pattern-engine/core

The core engine, types, math, fields, tiling, and utilities for PatternEngine.

## Install

\`\`\`bash
npm install @sg-pattern-engine/core
\`\`\`

## Includes

- `PatternEngine` — algorithm registry and tile orchestration
- `PRNG` — deterministic seeded random number generator (cyrb128 + sfc32)
- `ScalarField` / `VectorField` — typed 2D field containers with bilinear sampling
- `FieldManager` — scoped field lifecycle management
- `TileRenderer` — subdivides canvas into tiles for parallel rendering
- `WorkerPool` — universal browser/Node worker thread pool
- `SymmetryTransform` — mirror, radial, and kaleidoscope symmetry
- `ColorMapper` — scalar-to-RGB mapping with grayscale, HSL, HSV, gradient, palette modes
- `AnimationLoop` — RAF-driven animation with offline batch mode
- `BufferPool` — pooled Float32Array allocations to reduce GC pressure
- `ParameterExplorer` — batch config generation for parameter space exploration

## Documentation

See the [full documentation](https://github.com/sarthakganguly/sg-design-patterns#).