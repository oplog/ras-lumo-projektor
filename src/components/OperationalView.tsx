import { useEffect, useState } from 'react';
import { createProjectionChannel, postProjection } from '../projection-channel';
import type { Cell, Corner, Layout } from '../lib/types';

/**
 * Projector window — renders the editor's current layout in real time so the
 * user can calibrate boundary corners with live visual feedback on the actual
 * projector. Subscribes to `set-layout` broadcasts from the editor.
 *
 * Display modes (URL `?mode=` param):
 *   - `outline` (default): just polygon outlines, no fill, no labels
 *     → ideal for matching to physical rebin cell openings
 *   - `solid`: filled polygons with cell names, like the editor canvas
 */

type Mode = 'outline' | 'solid';

export function OperationalView() {
  const [layout, setLayout] = useState<Layout | null>(null);
  const [needsActivation, setNeedsActivation] = useState(true);
  const params = new URLSearchParams(window.location.search);
  const mode = (params.get('mode') ?? 'outline') as Mode;

  // Channel: announce ready, ask for current layout, listen for updates.
  useEffect(() => {
    const channel = createProjectionChannel();
    postProjection(channel, {
      type: 'projector-ready',
      pixelRatio: window.devicePixelRatio,
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
    });
    postProjection(channel, { type: 'request-layout' });

    const onMessage = (ev: MessageEvent) => {
      const msg = ev.data;
      if (!msg || typeof msg !== 'object') return;
      switch (msg.type) {
        case 'set-layout':
          setLayout(msg.layout);
          break;
        case 'ping':
          postProjection(channel, { type: 'pong', nonce: msg.nonce });
          break;
        case 'close':
          try {
            window.close();
          } catch {
            // ignore
          }
          break;
        default:
      }
    };
    channel.addEventListener('message', onMessage);

    const onUnload = () => postProjection(channel, { type: 'projector-bye' });
    window.addEventListener('beforeunload', onUnload);

    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') {
        try {
          window.close();
        } catch {
          // ignore
        }
      }
    };
    window.addEventListener('keydown', onKey);

    return () => {
      channel.removeEventListener('message', onMessage);
      onUnload();
      channel.close();
      window.removeEventListener('beforeunload', onUnload);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  // Detect whether we are already fullscreen.
  useEffect(() => {
    const checkFullscreen = () => {
      setNeedsActivation(!document.fullscreenElement && !isLikelyFullscreen());
    };
    checkFullscreen();
    document.addEventListener('fullscreenchange', checkFullscreen);
    window.addEventListener('resize', checkFullscreen);
    return () => {
      document.removeEventListener('fullscreenchange', checkFullscreen);
      window.removeEventListener('resize', checkFullscreen);
    };
  }, []);

  const requestFullscreen = async () => {
    try {
      await document.documentElement.requestFullscreen();
      setNeedsActivation(false);
    } catch (err) {
      console.error('requestFullscreen failed', err);
    }
  };

  return (
    <div className="absolute inset-0 bg-black">
      {layout ? (
        <CalibrationOverlay layout={layout} mode={mode} />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-zinc-600 text-base font-mono">
          Editör'den layout bekleniyor…
        </div>
      )}
      {needsActivation && (
        <button
          type="button"
          onClick={requestFullscreen}
          className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm text-white text-2xl font-medium hover:bg-black/80 cursor-pointer"
        >
          <span className="px-8 py-6 rounded-2xl border-2 border-white/40">
            Tıkla → Tam Ekrana Geç (F11 da olur)
          </span>
        </button>
      )}
    </div>
  );
}

function CalibrationOverlay({ layout, mode }: { layout: Layout; mode: Mode }) {
  const { width, height } = layout.screen;
  const filled = mode === 'solid';

  return (
    <svg
      role="presentation"
      aria-hidden="true"
      className="absolute inset-0"
      width="100%"
      height="100%"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid meet"
    >
      {/* Boundary outline (always visible — bright cyan dashed) */}
      <BoundaryOutline corners={layout.boundaryCorners} />

      {/* Cells */}
      {layout.cells.map((cell) => (
        <CellPolygon key={`${cell.rowIndex}-${cell.columnIndex}`} cell={cell} filled={filled} />
      ))}

      {/* Boundary corner dots (so user sees TL/TR/BL/BR on the projection) */}
      {layout.boundaryCorners.map((corner, idx) => (
        <CornerDot key={idx} corner={corner} index={idx} />
      ))}
    </svg>
  );
}

function BoundaryOutline({ corners }: { corners: [Corner, Corner, Corner, Corner] }) {
  const [TL, TR, BL, BR] = corners;
  return (
    <polygon
      points={`${TL.x},${TL.y} ${TR.x},${TR.y} ${BR.x},${BR.y} ${BL.x},${BL.y}`}
      fill="none"
      stroke="rgb(6 182 212)"
      strokeWidth={2.5}
      strokeDasharray="8 4"
    />
  );
}

function CellPolygon({ cell, filled }: { cell: Cell; filled: boolean }) {
  const points = [
    `${cell.topLeft.x},${cell.topLeft.y}`,
    `${cell.topRight.x},${cell.topRight.y}`,
    `${cell.bottomRight.x},${cell.bottomRight.y}`,
    `${cell.bottomLeft.x},${cell.bottomLeft.y}`,
  ].join(' ');

  if (!filled) {
    return (
      <polygon
        points={points}
        fill="rgb(34 197 94 / 0.15)"
        stroke="rgb(34 197 94)"
        strokeWidth={2}
      />
    );
  }

  const cx =
    (cell.topLeft.x + cell.topRight.x + cell.bottomLeft.x + cell.bottomRight.x) / 4;
  const cy =
    (cell.topLeft.y + cell.topRight.y + cell.bottomLeft.y + cell.bottomRight.y) / 4;
  const w = Math.abs(cell.topRight.x - cell.topLeft.x);
  const fontSize = Math.max(10, Math.min(28, w / 6));

  return (
    <g>
      <polygon
        points={points}
        fill="rgb(34 197 94 / 0.4)"
        stroke="rgb(34 197 94)"
        strokeWidth={2}
      />
      <text
        x={cx}
        y={cy}
        fill="white"
        fontSize={fontSize}
        fontWeight={600}
        textAnchor="middle"
        dominantBaseline="middle"
      >
        {cell.name}
      </text>
    </g>
  );
}

function CornerDot({ corner, index }: { corner: Corner; index: number }) {
  const labels = ['TL', 'TR', 'BL', 'BR'];
  return (
    <g>
      <circle cx={corner.x} cy={corner.y} r={10} fill="rgb(251 191 36)" />
      <text
        x={corner.x}
        y={corner.y}
        fill="black"
        fontSize={12}
        fontWeight={800}
        textAnchor="middle"
        dominantBaseline="middle"
      >
        {labels[index]}
      </text>
    </g>
  );
}

function isLikelyFullscreen(): boolean {
  return window.outerHeight === window.screen.height && window.outerWidth === window.screen.width;
}
