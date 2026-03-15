import { AlgorithmOutput } from '@sg-pattern-engine/core';

export class SVGRenderer {
  /**
   * Converts point-based geometry into SVG path data.
   */
  public render(output: AlgorithmOutput): string {
    if (output.type === 'points') {
      const circles = output.data.map(p => 
        `<circle cx="${p.x}" cy="${p.y}" r="2" fill="black" />`
      ).join('');
      return `<svg xmlns="http://www.w3.org/2000/svg">${circles}</svg>`;
    }
    return '<svg xmlns="http://www.w3.org/2000/svg"></svg>';
  }
}