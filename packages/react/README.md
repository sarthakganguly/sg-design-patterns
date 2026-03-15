# @sg-pattern-engine/react

React component and hook for PatternEngine.

## Install

\`\`\`bash
npm install @sg-pattern-engine/react
\`\`\`

## Usage

\`\`\`tsx
import { PatternCanvas } from '@sg-pattern-engine/react';

function makeWorker() {
  return new Worker(
    new URL('./tile.worker.ts', import.meta.url),
    { type: 'module' }
  );
}

<PatternCanvas
  config={{
    width: 1024,
    height: 1024,
    seed: 'hello',
    algorithm: 'perlin',
    renderer: 'canvas',
    colorMode: 'hsl',
    symmetryType: 'kaleidoscope',
    symmetryCount: 8,
  }}
  workerFactory={makeWorker}
/>
\`\`\`

## Documentation

See the [full documentation](https://github.com/your-username/sg-design-patterns#readme).