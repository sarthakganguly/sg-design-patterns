import React, { useRef, useEffect, useCallback } from 'react';
import { PatternConfig, AnimationLoop } from '@sg-pattern-engine/core';
import { CanvasRenderer } from '@sg-pattern-engine/renderers';
import { usePatternEngine } from '../hooks/usePatternEngine';

interface Props {
  config: PatternConfig;
  workerFactory?: () => Worker;
}

export const PatternCanvas: React.FC<Props> = ({ config, workerFactory }) => {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const loopRef      = useRef<AnimationLoop | null>(null);
  const { generate } = usePatternEngine(workerFactory);

  const renderFrame = useCallback(async (frameSeed?: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const frameConfig = frameSeed ? { ...config, seed: frameSeed } : config;
    const results = await generate(frameConfig);
    const renderer = new CanvasRenderer();
    results.forEach(({ output, tile }) => {
      renderer.render(ctx, output, tile, frameConfig);
    });
  }, [config, generate]);

  useEffect(() => {
    loopRef.current?.stop();
    if (config.animate) {
      const loop = new AnimationLoop(config);
      loopRef.current = loop;
      loop.start(async (frame) => {
        const speed = config.evolutionSpeed ?? 0.1;
        const seed  = speed >= 1
          ? frame.seed
          : `${config.seed}_${Math.floor(frame.frameIndex * speed)}`;
        await renderFrame(seed);
      });
    } else {
      renderFrame();
    }
    return () => { loopRef.current?.stop(); };
  }, [config, renderFrame]);

  return <canvas ref={canvasRef} width={config.width} height={config.height} />;
};