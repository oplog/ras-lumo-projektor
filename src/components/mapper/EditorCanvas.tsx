import { useEffect, useMemo, useRef, useState } from 'react';
import { useLayoutStore } from '../../lib/store';
import type { Cell, Corner } from '../../lib/types';

/**
 * Read-only preview of the loaded layout.
 *
 * Renders the boundary outline + cells with names. Click a cell to select it
 * (highlights + jumps the sidebar's rename input to that row). No dragging,
 * no handles — boundary corners and cell positions come straight from the
 * "Otomatik Düzelt" output and shouldn't be hand-tweaked here.
 */
export function EditorCanvas() {
  const layout = useLayoutStore((s) => s.layout);
  const selectedCellIndex = useLayoutStore((s) => s.selectedCellIndex);
  const selectCell = useLayoutStore((s) => s.selectCell);

  const containerRef = useRef<HTMLDivElement>(null);
  const screen = layout.screen;

  const [scale, setScale] = useState(1);
  useEffect(() => {
    const updateScale = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const sx = rect.width / screen.width;
      const sy = rect.height / screen.height;
      setScale(Math.min(sx, sy));
    };
    updateScale();
    const ro = new ResizeObserver(updateScale);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [screen.width, screen.height]);

  const strokeFat = clamp(3 / scale, 1.5, 3);
  const strokeThin = clamp(1.5 / scale, 0.75, 1.5);

  const cells = layout.cells;
  const selectedCell = selectedCellIndex !== null ? cells[selectedCellIndex] ?? null : null;

  const cellColor = useMemo(
    () => (cell: Cell) =>
      `hsl(${(cell.rowIndex * 53 + cell.columnIndex * 31) % 360} 70% 60% / 0.18)`,
    [],
  );

  return (
    <div
      ref={containerRef}
      className="relative flex-1 min-w-0 bg-zinc-950 overflow-hidden flex items-center justify-center"
    >
      <div
        className="relative"
        style={{
          width: `${screen.width * scale}px`,
          height: `${screen.height * scale}px`,
          maxWidth: '100%',
          maxHeight: '100%',
        }}
      >
        <svg
          role="presentation"
          aria-hidden="true"
          viewBox={`0 0 ${screen.width} ${screen.height}`}
          preserveAspectRatio="xMidYMid meet"
          className="block w-full h-full bg-black border border-zinc-800/60 select-none"
        >
          <ReferenceGrid width={screen.width} height={screen.height} />

          <BoundaryOutline corners={layout.boundaryCorners} stroke={strokeFat} />

          {cells.map((cell, idx) => {
            const isSelected = idx === selectedCellIndex;
            return (
              <g key={`${cell.rowIndex}-${cell.columnIndex}-${idx}`}>
                <polygon
                  points={[
                    `${cell.topLeft.x},${cell.topLeft.y}`,
                    `${cell.topRight.x},${cell.topRight.y}`,
                    `${cell.bottomRight.x},${cell.bottomRight.y}`,
                    `${cell.bottomLeft.x},${cell.bottomLeft.y}`,
                  ].join(' ')}
                  fill={isSelected ? 'rgb(251 191 36 / 0.35)' : cellColor(cell)}
                  stroke={isSelected ? '#fbbf24' : 'rgb(255 255 255 / 0.55)'}
                  strokeWidth={isSelected ? strokeFat : strokeThin}
                  className="cursor-pointer"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    selectCell(idx === selectedCellIndex ? null : idx);
                  }}
                />
                <text
                  x={(cell.topLeft.x + cell.topRight.x + cell.bottomLeft.x + cell.bottomRight.x) / 4}
                  y={(cell.topLeft.y + cell.topRight.y + cell.bottomLeft.y + cell.bottomRight.y) / 4}
                  fill={isSelected ? '#fff' : 'rgb(255 255 255 / 0.85)'}
                  fontSize={Math.max(10, Math.min(20, cellTextSize(cell) / 4))}
                  fontWeight={isSelected ? 700 : 500}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  pointerEvents="none"
                >
                  {cell.name}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="absolute bottom-3 right-3 px-2.5 py-1 rounded-md bg-zinc-900/80 text-[11px] text-zinc-400 font-mono pointer-events-none">
        {screen.width}×{screen.height} · zoom {(scale * 100).toFixed(0)}%
      </div>
      {selectedCell && (
        <div className="absolute bottom-3 left-3 px-3 py-2 rounded-md bg-zinc-900/90 border border-zinc-700/60 text-xs text-zinc-200 max-w-sm">
          <div className="font-semibold">{selectedCell.name}</div>
          <div className="text-zinc-500 font-mono mt-0.5">
            r{selectedCell.rowIndex} · c{selectedCell.columnIndex}
          </div>
        </div>
      )}
    </div>
  );
}

function ReferenceGrid({ width, height }: { width: number; height: number }) {
  const stepX = width / 12;
  const stepY = height / 12;
  const lines: React.ReactNode[] = [];
  for (let i = 1; i < 12; i++) {
    lines.push(
      <line
        key={`vx-${i}`}
        x1={i * stepX}
        y1={0}
        x2={i * stepX}
        y2={height}
        stroke="rgb(255 255 255 / 0.04)"
        strokeWidth={1}
      />,
      <line
        key={`hy-${i}`}
        x1={0}
        y1={i * stepY}
        x2={width}
        y2={i * stepY}
        stroke="rgb(255 255 255 / 0.04)"
        strokeWidth={1}
      />,
    );
  }
  return <g>{lines}</g>;
}

function BoundaryOutline({
  corners,
  stroke,
}: {
  corners: [Corner, Corner, Corner, Corner];
  stroke: number;
}) {
  const [TL, TR, BL, BR] = corners;
  const points = [
    `${TL.x},${TL.y}`,
    `${TR.x},${TR.y}`,
    `${BR.x},${BR.y}`,
    `${BL.x},${BL.y}`,
  ].join(' ');
  return (
    <polygon
      points={points}
      fill="rgb(251 191 36 / 0.04)"
      stroke="rgb(251 191 36 / 0.7)"
      strokeWidth={stroke}
      strokeDasharray={`${stroke * 4} ${stroke * 2}`}
      pointerEvents="none"
    />
  );
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function cellTextSize(c: Cell): number {
  const w = Math.max(
    Math.abs(c.topRight.x - c.topLeft.x),
    Math.abs(c.bottomRight.x - c.bottomLeft.x),
  );
  const h = Math.max(
    Math.abs(c.bottomLeft.y - c.topLeft.y),
    Math.abs(c.bottomRight.y - c.topRight.y),
  );
  return Math.min(w, h);
}
