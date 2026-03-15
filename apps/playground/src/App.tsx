import React, { useState } from 'react';
import { PatternCanvas } from '@sg-pattern-engine/react';
import { PatternConfig } from '@sg-pattern-engine/core';

export default function App() {
  const [config, setConfig] = useState<PatternConfig>({
    width: 1024, height: 1024, seed: '123', algorithm: 'perlin', renderer: 'canvas'
  });

  return (
    <div className="flex h-screen bg-slate-900 text-white">
      <aside className="w-80 p-6 border-r border-slate-700 overflow-y-auto">
        <h1 className="text-xl font-bold mb-6">PatternEngine</h1>
        <div className="space-y-4">
          <label>Algorithm</label>
          <select 
            className="w-full bg-slate-800 p-2 rounded"
            onChange={(e) => setConfig({...config, algorithm: e.target.value})}
          >
            <option value="perlin">Perlin Noise</option>
            <option value="flowField">Flow Field</option>
            <option value="voronoi">Voronoi</option>
          </select>
          <button 
            className="w-full bg-blue-600 py-2 rounded font-semibold hover:bg-blue-500"
            onClick={() => setConfig({...config, seed: Math.random().toString()})}
          >
            Generate
          </button>
        </div>
      </aside>
      <main className="flex-1 flex items-center justify-center">
        <div className="shadow-2xl border border-slate-700 bg-black">
          <PatternCanvas config={config} />
        </div>
      </main>
    </div>
  );
}