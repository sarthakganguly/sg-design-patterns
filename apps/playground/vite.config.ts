import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@sg-pattern-engine/core': path.resolve(__dirname, '../../packages/core/src/index.ts'),
      '@sg-pattern-engine/react': path.resolve(__dirname, '../../packages/react/src/index.ts'),
      '@sg-pattern-engine/renderers': path.resolve(__dirname, '../../packages/renderers/src/index.ts'),
      '@sg-pattern-engine/algorithms': path.resolve(__dirname, '../../packages/algorithms/src/index.ts'),
    }
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
  }
});