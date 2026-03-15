import React, { useState, useMemo } from 'react';
import { PatternCanvas } from '@sg-pattern-engine/react';
import { PatternConfig } from '@sg-pattern-engine/core';

// ── Worker factory ────────────────────────────────────────────────────────────
// Defined outside component so the reference is stable across renders.
// usePatternEngine uses it as a useEffect dependency.
function makeWorker() {
  return new Worker(
    new URL('./tile.worker.ts', import.meta.url),
    { type: 'module' }
  );
}

// ── Gray-Scott presets ────────────────────────────────────────────────────────
const RD_PRESETS: Record<string, { f: number; k: number; label: string }> = {
  coral:    { f: 0.0545, k: 0.062,  label: 'Coral'    },
  mitosis:  { f: 0.0367, k: 0.0649, label: 'Mitosis'  },
  worms:    { f: 0.058,  k: 0.065,  label: 'Worms'    },
  spots:    { f: 0.035,  k: 0.060,  label: 'Spots'    },
  solitons: { f: 0.030,  k: 0.060,  label: 'Solitons' },
  custom:   { f: 0.0545, k: 0.062,  label: 'Custom'   },
};

const TILE_SIZES  = [128, 256, 512, 1024] as const;
const CANVAS_SIZES = [512, 1024, 2048] as const;

// ── Small UI primitives ───────────────────────────────────────────────────────
const Label: React.FC<{ children: React.ReactNode; htmlFor?: string }> = ({ children, htmlFor }) => (
  <label htmlFor={htmlFor} className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">
    {children}
  </label>
);

const Select: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = (props) => (
  <select
    {...props}
    className="w-full bg-slate-800 border border-slate-600 text-slate-200 p-2 rounded text-sm focus:outline-none focus:border-blue-500"
  />
);

const SliderRow: React.FC<{
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  format?: (v: number) => string;
  onChange: (v: number) => void;
}> = ({ label, value, min, max, step = 0.001, format, onChange }) => (
  <div>
    <Label>
      {label}
      <span className="ml-1 text-slate-300 normal-case tracking-normal">
        {format ? format(value) : value}
      </span>
    </Label>
    <input
      type="range" min={min} max={max} step={step} value={value}
      className="w-full accent-blue-500"
      onChange={e => onChange(Number(e.target.value))}
    />
  </div>
);

const SegmentedButtons = <T extends string | number>({
  options, value, onChange, format,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  format?: (v: T) => string;
}) => (
  <div className="flex gap-1">
    {options.map(o => (
      <button
        key={String(o)}
        onClick={() => onChange(o)}
        className={`flex-1 py-1 rounded text-xs font-mono transition-colors
          ${value === o
            ? 'bg-blue-600 text-white'
            : 'bg-slate-700 text-slate-400 hover:bg-slate-600 hover:text-slate-200'
          }`}
      >
        {format ? format(o) : String(o)}
      </button>
    ))}
  </div>
);

const Divider = () => <div className="border-t border-slate-700 my-1" />;

const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest pt-1">
    {children}
  </p>
);

// ── Main app ──────────────────────────────────────────────────────────────────
export default function App() {
  const [config, setConfig] = useState<PatternConfig>({
    width:         1024,
    height:        1024,
    seed:          '42',
    algorithm:     'perlin',
    renderer:      'canvas',
    tileSize:      512,
    // color
    colorMode:     'grayscale',
    palette:       ['#0a0a2e', '#f5a623'],
    // geometry
    scale:         0.01,
    density:       60,
    // symmetry
    symmetryType:  'none',
    symmetryCount: 6,
    // rd
    iterations:    2000,
    feedRate:      0.0545,
    killRate:      0.062,
    // animation
    animate:        false,
    fps:            24,
    duration:       8,
    loop:           true,
    evolutionSpeed: 0.05,
  });

  const [rdPreset, setRdPreset] = useState<string>('coral');
  const [workerCount, setWorkerCount] = useState<number>(
    () => navigator.hardwareConcurrency ?? 4
  );

  const set = (patch: Partial<PatternConfig>) =>
    setConfig(c => ({ ...c, ...patch }));

  // Derived tile count display
  const tileSize  = config.tileSize ?? 512;
  const tileCount = Math.ceil(config.width / tileSize) *
                    Math.ceil(config.height / tileSize);

  // Colour pickers — only meaningful for gradient / palette modes
  const showPaletteA = config.colorMode === 'gradient' || config.colorMode === 'palette';
  const showPaletteB = config.colorMode === 'gradient';

  // Algorithm-specific visibility
  const isRD       = config.algorithm === 'reactionDiffusion';
  const isVoronoi  = config.algorithm === 'voronoi';
  const isPerlin   = config.algorithm === 'perlin';
  const showScale  = isPerlin;
  const showDensity = isVoronoi;

  // Stable worker factory memo — only changes if workerCount changes (via key)
  const workerFactoryKey = workerCount; // used as PatternCanvas key to remount pool

  function applyRdPreset(name: string) {
    setRdPreset(name);
    if (name !== 'custom') {
      const p = RD_PRESETS[name];
      set({ feedRate: p.f, killRate: p.k });
    }
  }

  return (
    <div className="flex h-screen bg-slate-950 text-slate-200 font-sans">

      {/* ── Sidebar ────────────────────────────────────────────────────────── */}
      <aside className="w-72 flex flex-col border-r border-slate-800 overflow-y-auto shrink-0">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800">
          <h1 className="text-base font-semibold text-white tracking-tight">
            Pattern Engine
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">Procedural generation playground</p>
        </div>

        <div className="px-5 py-4 space-y-4 flex-1">

          {/* ── Generation ─────────────────────────────────────────────────── */}
          <SectionTitle>Generation</SectionTitle>

          <div>
            <Label>Algorithm</Label>
            <Select value={config.algorithm} onChange={e => set({ algorithm: e.target.value })}>
              <option value="perlin">Perlin noise</option>
              <option value="flowField">Flow field</option>
              <option value="voronoi">Voronoi</option>
              <option value="reactionDiffusion">Reaction diffusion</option>
            </Select>
          </div>

          {/* Scale — only for perlin */}
          {showScale && (
            <SliderRow
              label="Scale"
              value={config.scale ?? 0.01}
              min={0.001} max={0.05} step={0.001}
              format={v => v.toFixed(3)}
              onChange={v => set({ scale: v })}
            />
          )}

          {/* Density — only for voronoi */}
          {showDensity && (
            <SliderRow
              label="Point density"
              value={config.density ?? 60}
              min={5} max={300} step={1}
              format={v => `${Math.round(v)} pts`}
              onChange={v => set({ density: Math.round(v) })}
            />
          )}

          {/* Reaction-diffusion controls */}
          {isRD && (
            <>
              <div>
                <Label>Preset</Label>
                <div className="grid grid-cols-3 gap-1">
                  {Object.entries(RD_PRESETS).map(([key, { label }]) => (
                    <button
                      key={key}
                      onClick={() => applyRdPreset(key)}
                      className={`py-1 px-2 rounded text-xs transition-colors
                        ${rdPreset === key
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                        }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <SliderRow
                label="Feed rate (f)"
                value={config.feedRate ?? 0.0545}
                min={0.01} max={0.1} step={0.0001}
                format={v => v.toFixed(4)}
                onChange={v => { set({ feedRate: v }); setRdPreset('custom'); }}
              />

              <SliderRow
                label="Kill rate (k)"
                value={config.killRate ?? 0.062}
                min={0.04} max={0.075} step={0.0001}
                format={v => v.toFixed(4)}
                onChange={v => { set({ killRate: v }); setRdPreset('custom'); }}
              />

              <SliderRow
                label="Iterations"
                value={config.iterations ?? 2000}
                min={100} max={5000} step={100}
                format={v => `${Math.round(v).toLocaleString()}`}
                onChange={v => set({ iterations: Math.round(v) })}
              />
              <p className="text-xs text-slate-500 -mt-2">
                Higher = more developed pattern. Slow on main thread — use workers.
              </p>
            </>
          )}

          <Divider />

          {/* ── Color ──────────────────────────────────────────────────────── */}
          <SectionTitle>Color</SectionTitle>

          <div>
            <Label>Mode</Label>
            <Select
              value={config.colorMode ?? 'grayscale'}
              onChange={e => set({ colorMode: e.target.value as any })}
            >
              <option value="grayscale">Grayscale</option>
              <option value="hsl">HSL cycle</option>
              <option value="hsv">HSV cycle</option>
              <option value="gradient">Two-colour gradient</option>
              <option value="palette">Multi-stop palette</option>
            </Select>
          </div>

          {showPaletteA && (
            <div>
              <Label>
                {config.colorMode === 'gradient' ? 'Colour A (dark end)' : 'Palette start'}
              </Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={config.palette?.[0] ?? '#0a0a2e'}
                  className="w-8 h-8 rounded cursor-pointer bg-transparent border-0"
                  onChange={e => {
                    const p = [...(config.palette ?? ['#0a0a2e', '#f5a623'])];
                    p[0] = e.target.value;
                    set({ palette: p });
                  }}
                />
                <span className="text-xs text-slate-400 font-mono">
                  {config.palette?.[0] ?? '#0a0a2e'}
                </span>
              </div>
            </div>
          )}

          {showPaletteB && (
            <div>
              <Label>Colour B (bright end)</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={config.palette?.[1] ?? '#f5a623'}
                  className="w-8 h-8 rounded cursor-pointer bg-transparent border-0"
                  onChange={e => {
                    const p = [...(config.palette ?? ['#0a0a2e', '#f5a623'])];
                    p[1] = e.target.value;
                    set({ palette: p });
                  }}
                />
                <span className="text-xs text-slate-400 font-mono">
                  {config.palette?.[1] ?? '#f5a623'}
                </span>
              </div>
            </div>
          )}

          {config.colorMode === 'palette' && (
            <div className="space-y-2">
              <Label>Palette stops</Label>
              {(config.palette ?? ['#0a0a2e', '#f5a623']).map((hex, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="color" value={hex}
                    className="w-7 h-7 rounded cursor-pointer bg-transparent border-0 shrink-0"
                    onChange={e => {
                      const p = [...(config.palette ?? [])];
                      p[idx] = e.target.value;
                      set({ palette: p });
                    }}
                  />
                  <span className="text-xs text-slate-400 font-mono flex-1">{hex}</span>
                  {(config.palette?.length ?? 0) > 2 && (
                    <button
                      onClick={() => {
                        const p = [...(config.palette ?? [])];
                        p.splice(idx, 1);
                        set({ palette: p });
                      }}
                      className="text-slate-600 hover:text-red-400 text-xs"
                    >✕</button>
                  )}
                </div>
              ))}
              <button
                onClick={() => set({ palette: [...(config.palette ?? []), '#ffffff'] })}
                className="text-xs text-blue-400 hover:text-blue-300"
              >
                + Add stop
              </button>
            </div>
          )}

          <Divider />

          {/* ── Symmetry ───────────────────────────────────────────────────── */}
          <SectionTitle>Symmetry</SectionTitle>

          <div>
            <Label>Type</Label>
            <Select
              value={config.symmetryType ?? 'none'}
              onChange={e => set({ symmetryType: e.target.value as any })}
            >
              <option value="none">None</option>
              <option value="mirror">Mirror (horizontal)</option>
              <option value="radial">Radial</option>
              <option value="kaleidoscope">Kaleidoscope</option>
            </Select>
          </div>

          {(config.symmetryType === 'radial' || config.symmetryType === 'kaleidoscope') && (
            <SliderRow
              label="Segments"
              value={config.symmetryCount ?? 6}
              min={2} max={16} step={1}
              format={v => `${Math.round(v)}`}
              onChange={v => set({ symmetryCount: Math.round(v) })}
            />
          )}

          <Divider />

          {/* ── Tiling & resolution ────────────────────────────────────────── */}
          <SectionTitle>Resolution &amp; Tiling</SectionTitle>

          <div>
            <Label>
              Canvas size
            </Label>
            <SegmentedButtons
              options={CANVAS_SIZES}
              value={config.width as typeof CANVAS_SIZES[number]}
              onChange={s => set({ width: s, height: s })}
              format={s => `${s}`}
            />
          </div>

          <div>
            <Label>
              Tile size
              <span className="ml-1 normal-case tracking-normal text-slate-500">
                → {tileCount} tile{tileCount !== 1 ? 's' : ''}
              </span>
            </Label>
            <SegmentedButtons
              options={TILE_SIZES}
              value={tileSize as typeof TILE_SIZES[number]}
              onChange={s => set({ tileSize: s })}
              format={s => `${s}`}
            />
            <p className="text-xs text-slate-500 mt-1">
              Smaller = more parallelism. Larger = less overhead.
            </p>
          </div>

          <div>
            <Label>
              Worker threads
              <span className="ml-1 normal-case tracking-normal text-slate-500">
                (max {navigator.hardwareConcurrency ?? 4})
              </span>
            </Label>
            <SegmentedButtons
              options={[1, 2, 4, 8] as const}
              value={workerCount as 1 | 2 | 4 | 8}
              onChange={n => setWorkerCount(n)}
              format={n => `${n}`}
            />
          </div>

          <Divider />

          {/* ── Animation ──────────────────────────────────────────────────── */}
          <SectionTitle>Animation</SectionTitle>

          <div className="flex items-center justify-between">
            <Label>Enable</Label>
            <button
              onClick={() => set({ animate: !config.animate })}
              className={`relative w-10 h-5 rounded-full transition-colors ${
                config.animate ? 'bg-blue-600' : 'bg-slate-700'
              }`}
            >
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                config.animate ? 'translate-x-5' : ''
              }`} />
            </button>
          </div>

          {config.animate && (
            <>
              <SliderRow
                label="Duration"
                value={config.duration ?? 8}
                min={1} max={30} step={1}
                format={v => `${Math.round(v)}s`}
                onChange={v => set({ duration: Math.round(v) })}
              />
              <SliderRow
                label="FPS"
                value={config.fps ?? 24}
                min={1} max={60} step={1}
                format={v => `${Math.round(v)}`}
                onChange={v => set({ fps: Math.round(v) })}
              />
              <SliderRow
                label="Evolution speed"
                value={config.evolutionSpeed ?? 0.05}
                min={0.01} max={1} step={0.01}
                format={v => v.toFixed(2)}
                onChange={v => set({ evolutionSpeed: v })}
              />
              <div className="flex items-center justify-between">
                <Label>Loop</Label>
                <button
                  onClick={() => set({ loop: !config.loop })}
                  className={`relative w-10 h-5 rounded-full transition-colors ${
                    config.loop ? 'bg-blue-600' : 'bg-slate-700'
                  }`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                    config.loop ? 'translate-x-5' : ''
                  }`} />
                </button>
              </div>
            </>
          )}

        </div>

        {/* ── Generate button ─────────────────────────────────────────────── */}
        <div className="px-5 py-4 border-t border-slate-800">
          <button
            className="w-full bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white py-2.5 rounded text-sm font-semibold transition-colors"
            onClick={() => set({ seed: Math.random().toString() })}
          >
            Generate new seed
          </button>
        </div>
      </aside>

      {/* ── Canvas ─────────────────────────────────────────────────────────── */}
      <main className="flex-1 flex items-center justify-center overflow-auto p-6 bg-slate-950">
        <div
          className="shadow-2xl ring-1 ring-slate-700 bg-black"
          style={{
            width:     config.width,
            height:    config.height,
            maxWidth:  'calc(100vw - 20rem)',
            maxHeight: 'calc(100vh - 3rem)',
          }}
        >
          {/*
            Key on workerCount so the pool is fully remounted when thread
            count changes — avoids stale pool with wrong size.
          */}
          <PatternCanvas
            key={workerFactoryKey}
            config={config}
            workerFactory={makeWorker}
          />
        </div>
      </main>

    </div>
  );
}