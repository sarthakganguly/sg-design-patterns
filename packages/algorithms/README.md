# @sg-pattern-engine/algorithms

Built-in algorithm plugins for PatternEngine.

## Install

\`\`\`bash
npm install @sg-pattern-engine/core @sg-pattern-engine/algorithms
\`\`\`

## Algorithms

| Name | Output | Description |
|---|---|---|
| `perlin` | `scalarField` | Hash-based Perlin noise |
| `flowField` | `vectorField` | Random unit vector field |
| `voronoi` | `points` | Scattered Voronoi seed points |
| `reactionDiffusion` | `scalarField` | Full Gray-Scott simulation |

## Usage

\`\`\`typescript
import { PatternEngine } from '@sg-pattern-engine/core';
import { algorithms } from '@sg-pattern-engine/algorithms';

const engine = new PatternEngine();
algorithms.forEach(algo => engine.registerAlgorithm(algo));
\`\`\`

## Documentation

See the [full documentation](https://github.com/sarthakganguly/sg-design-patterns#readme).