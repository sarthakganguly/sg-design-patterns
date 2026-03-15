import { AlgorithmPlugin, AlgorithmContext, AlgorithmOutput } from '@sg-pattern-engine/core';

/**
 * Gray-Scott reaction-diffusion.
 * Two chemical species A and B diffuse and react:
 *   A + 2B → 3B   (A is consumed, B is produced)
 *   B → P         (B decays at kill rate k)
 *
 * Classic parameter sets:
 *   Coral:    f=0.0545, k=0.062
 *   Mitosis:  f=0.0367, k=0.0649
 *   Solitons: f=0.030,  k=0.060
 *   Worms:    f=0.058,  k=0.065
 *   Spots:    f=0.035,  k=0.060
 */
export class ReactionDiffusionPlugin implements AlgorithmPlugin {
  name = 'reactionDiffusion';

  // Default Gray-Scott parameters — coral growth preset
  private readonly DA   = 1.0;    // diffusion rate of A
  private readonly DB   = 0.5;    // diffusion rate of B
  private readonly F    = 0.0545; // feed rate
  private readonly K    = 0.062;  // kill rate
  private readonly DT   = 1.0;    // time step

  generate(ctx: AlgorithmContext): AlgorithmOutput {
    const { width, height } = ctx.tile;
    const iterations = ctx.config.iterations ?? 2000;

    // Allocate two channels: A (activator) and B (inhibitor)
    // Flat arrays: index = y * width + x
    let A = new Float32Array(width * height);
    let B = new Float32Array(width * height);
    let nextA = new Float32Array(width * height);
    let nextB = new Float32Array(width * height);

    // Allow parameter overrides via config
    const f = ctx.config.feedRate ?? this.F;
    const k = ctx.config.killRate ?? this.K;
    const da = this.DA;
    const db = this.DB;
    const dt = this.DT;

    // ── Initialise ─────────────────────────────────────────────────────────
    // Fill A=1 everywhere, seed random B=1 patches
    A.fill(1.0);
    B.fill(0.0);

    const patchCount = Math.max(1, Math.floor(width * height * 0.001));
    const patchRadius = Math.max(3, Math.floor(Math.min(width, height) * 0.04));

    for (let p = 0; p < patchCount; p++) {
      const cx = Math.floor(ctx.rng.random() * width);
      const cy = Math.floor(ctx.rng.random() * height);
      for (let dy = -patchRadius; dy <= patchRadius; dy++) {
        for (let dx = -patchRadius; dx <= patchRadius; dx++) {
          if (dx * dx + dy * dy > patchRadius * patchRadius) continue;
          const nx = ((cx + dx) + width)  % width;
          const ny = ((cy + dy) + height) % height;
          const i  = ny * width + nx;
          A[i] = 0.5 + ctx.rng.random() * 0.1;
          B[i] = 0.25 + ctx.rng.random() * 0.1;
        }
      }
    }

    // ── Iterate Gray-Scott ──────────────────────────────────────────────────
    for (let iter = 0; iter < iterations; iter++) {
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const i = y * width + x;

          // Wrap-around neighbour indices
          const xL = (x - 1 + width)  % width;
          const xR = (x + 1)          % width;
          const yU = (y - 1 + height) % height;
          const yD = (y + 1)          % height;

          // Discrete Laplacian (5-point stencil)
          const lapA =
            A[yU * width + x ] +
            A[yD * width + x ] +
            A[y  * width + xL] +
            A[y  * width + xR] -
            4.0 * A[i];

          const lapB =
            B[yU * width + x ] +
            B[yD * width + x ] +
            B[y  * width + xL] +
            B[y  * width + xR] -
            4.0 * B[i];

          const a = A[i];
          const b = B[i];
          const reaction = a * b * b;

          nextA[i] = Math.max(0, Math.min(1, a + dt * (da * lapA - reaction + f * (1 - a))));
          nextB[i] = Math.max(0, Math.min(1, b + dt * (db * lapB + reaction - (k + f) * b)));
        }
      }

      // Swap buffers without allocation
      const tmpA = A; A = nextA; nextA = tmpA;
      const tmpB = B; B = nextB; nextB = tmpB;
    }

    // Return B channel — this is where the patterns form
    return { type: 'scalarField', data: B, width, height };
  }
}