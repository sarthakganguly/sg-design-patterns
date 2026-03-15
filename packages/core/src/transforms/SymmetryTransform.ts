import { ScalarField } from '../fields/ScalarField';
import { PatternConfig } from '../types';

export class SymmetryTransform {
  /**
   * Applies symmetry to a ScalarField in-place.
   * Works on the full-canvas field — call after stitching tiles.
   * For per-tile pre-pass symmetry, use applyToTile().
   */
  static apply(field: ScalarField, config: PatternConfig): ScalarField {
    const { symmetryType, symmetryCount = 4 } = config;
    if (!symmetryType || symmetryType === 'none') return field;

    switch (symmetryType) {
      case 'mirror':    return this.mirror(field);
      case 'radial':    return this.radial(field, symmetryCount);
      case 'kaleidoscope': return this.kaleidoscope(field, symmetryCount);
      case 'tiling':    return field; // already tileable at generation time
      default:          return field;
    }
  }

  /** Horizontal mirror: right half is flipped copy of left half */
  private static mirror(field: ScalarField): ScalarField {
    const { width, height } = field;
    for (let y = 0; y < height; y++) {
      for (let x = Math.floor(width / 2); x < width; x++) {
        field.set(x, y, field.get(width - 1 - x, y));
      }
    }
    return field;
  }

  /**
   * Radial symmetry: divide canvas into `segments` pie slices.
   * All slices are copies of slice 0, rotated.
   */
  private static radial(field: ScalarField, segments: number): ScalarField {
    const { width, height } = field;
    const cx = width  / 2;
    const cy = height / 2;
    const sliceAngle = (Math.PI * 2) / segments;
    const out = new ScalarField(width, height);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const dx = x - cx;
        const dy = y - cy;
        let angle = Math.atan2(dy, dx);
        const radius = Math.sqrt(dx * dx + dy * dy);

        // Fold into first slice
        angle = ((angle % sliceAngle) + sliceAngle) % sliceAngle;

        const sx = cx + radius * Math.cos(angle);
        const sy = cy + radius * Math.sin(angle);
        out.set(x, y, field.sample(sx, sy));
      }
    }
    return out;
  }

  /**
   * Kaleidoscope: radial + mirror within each slice.
   * Each slice is mirrored around its bisector, producing reflection symmetry.
   */
  private static kaleidoscope(field: ScalarField, segments: number): ScalarField {
    const { width, height } = field;
    const cx = width  / 2;
    const cy = height / 2;
    const sliceAngle = (Math.PI * 2) / segments;
    const halfSlice  = sliceAngle / 2;
    const out = new ScalarField(width, height);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const dx = x - cx;
        const dy = y - cy;
        let angle = Math.atan2(dy, dx);
        const radius = Math.sqrt(dx * dx + dy * dy);

        angle = ((angle % sliceAngle) + sliceAngle) % sliceAngle;
        // Mirror around half-slice bisector
        if (angle > halfSlice) angle = sliceAngle - angle;

        const sx = cx + radius * Math.cos(angle);
        const sy = cy + radius * Math.sin(angle);
        out.set(x, y, field.sample(sx, sy));
      }
    }
    return out;
  }
}