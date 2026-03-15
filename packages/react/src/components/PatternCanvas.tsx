import React, { useRef, useEffect } from 'react';
import { PatternConfig } from '@sg-pattern-engine/core';
import { CanvasRenderer } from '@sg-pattern-engine/renderers';
import { usePatternEngine } from '../hooks/usePatternEngine';

interface Props {
  config: PatternConfig;
}

export const PatternCanvas: React.FC<Props> = ({ config }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { generate } = usePatternEngine();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    generate(config).then(results => {
      const renderer = new CanvasRenderer();
      results.forEach(({ output, tile }) => {
        renderer.render(ctx, output, tile);
      });
    });
  }, [config, generate]);

  return <canvas ref={canvasRef} width={config.width} height={config.height} />;
};