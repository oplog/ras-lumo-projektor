import { temporal } from 'zundo';
import type { TemporalState } from 'zundo';
import { useStore } from 'zustand';
import { create } from 'zustand';
import { generateGrid } from './bilinear';
import { makeEmptyLayout } from './defaults';
import {
  canonicalizeCorners,
  generateGridHomography,
  inferColumnDirection,
} from './homography';
import { defaultSurfaceLabel } from './types';
import type {
  Cell,
  Corner,
  Layout,
  Metadata,
  ScreenConfig,
  SurfaceType,
} from './types';

type CornerKey = 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';
type BoundaryIndex = 0 | 1 | 2 | 3;

interface LayoutState {
  layout: Layout;
  selectedCellIndex: number | null;
  /** Toggle: when true, dragging a boundary corner immediately re-runs bilinear. */
  liveRegenerate: boolean;
  /** Last validation issues (computed on save attempt; mostly informational). */
  validationCount: number;
  /** Surface geometry kind, drives the homography-fix algorithm. */
  geometryMode: 'pod' | 'rebin';
  /** Post (gap) width between two rebins, as fraction of one cell width.
   *  Only used in rebin mode (asym500). 0.5 = field-validated default. */
  rebinGapFactor: number;
  /** Visual inset applied to each cell (0..0.5), shrinking it toward its
   *  centre. Used to tighten/loosen the apparent gaps between projected
   *  cells without re-running RAS. */
  cellInset: number;
  /** Pixel offset applied to the whole grid after homography. Lets the
   *  user nudge cells if the projector is misaligned with the physical bins. */
  gridOffsetX: number;
  gridOffsetY: number;
  /** Library entry id of the file currently loaded in the editor.
   *  All in-place edits (Auto Fix, gap slider, cell rename) write back
   *  to this row. Null when nothing is loaded. */
  currentEntryId: string | null;

  setLayout: (l: Layout) => void;
  resetLayout: () => void;
  selectCell: (i: number | null) => void;
  setLiveRegenerate: (v: boolean) => void;
  setGeometryMode: (m: 'pod' | 'rebin') => void;
  setRebinGapFactor: (f: number) => void;
  setCellInset: (v: number) => void;
  setGridOffset: (axis: 'x' | 'y', v: number) => void;
  setCurrentEntryId: (id: string | null) => void;

  setStationName: (s: string) => void;
  updateScreen: (patch: Partial<ScreenConfig>) => void;
  updateMetadata: (patch: Partial<Metadata>) => void;
  setSurfaceType: (t: SurfaceType) => void;
  addFace: (f: string) => void;
  removeFace: (idx: number) => void;
  updateFace: (idx: number, value: string) => void;

  setRowCount: (n: number) => void;
  setColumnsForRow: (rowIndex: number, cols: number) => void;

  moveBoundaryCorner: (idx: BoundaryIndex, c: Corner) => void;
  setBoundaryCornerExact: (idx: BoundaryIndex, c: Corner) => void;

  regenerateCells: () => void;
  /**
   * One-shot fix for XML produced by RAS wizard.
   *
   * Algorithm dispatches on `metadata.surfaceType`:
   *   - PutToLight, PackToLight → rebin algorithm: canonicalize corners
   *                               by geometry + asym500 u-distribution
   *                               (two adjacent units sharing one boundary
   *                               with a metal post between them, head-on
   *                               projection)
   *   - everything else         → pod algorithm: trust RAS click order +
   *                               uniform u spacing (single surface,
   *                               possibly oblique projection)
   *
   * Cells get default names (drops user customizations) — call after
   * loading a fresh RAS XML, then rename cells if needed.
   *
   * Optional override: pass `mode: 'rebin'` or `mode: 'pod'` to force a
   * specific algorithm regardless of SurfaceType.
   */
  applyHomographyFix: (opts?: { mode?: 'rebin' | 'pod' }) => void;

  setCellName: (i: number, name: string) => void;
  moveCellCorner: (cellIdx: number, corner: CornerKey, c: Corner) => void;

  applyValidationCount: (count: number) => void;
}

function clampToScreen(c: Corner, screen: ScreenConfig): Corner {
  return {
    x: Math.max(0, Math.min(c.x, screen.width)),
    y: Math.max(0, Math.min(c.y, screen.height)),
  };
}

/**
 * Re-run homography cell generation using current store state, with
 * optional overrides. Centralizes the pattern used by gap/inset/offset
 * sliders so each callsite doesn't reimplement direction detection,
 * canonicalization, and option threading.
 */
function regenCells(
  s: LayoutState,
  overrides: {
    gapFactor?: number;
    cellInset?: number;
    offsetX?: number;
    offsetY?: number;
  } = {},
): Cell[] {
  const isRebin = s.geometryMode === 'rebin';
  const corners = s.layout.boundaryCorners;
  const ordered = isRebin
    ? canonicalizeCorners([corners[0], corners[1], corners[2], corners[3]])
    : corners;
  const columnDirection = inferColumnDirection(s.layout.cells);
  return generateGridHomography(
    ordered,
    s.layout.rowCount,
    s.layout.columnsPerRow,
    {
      canonicalize: false,
      uMode: isRebin ? 'asym500' : 'uniform',
      gapFactor: overrides.gapFactor ?? s.rebinGapFactor,
      columnDirection,
      cellInset: overrides.cellInset ?? s.cellInset,
      offsetX: overrides.offsetX ?? s.gridOffsetX,
      offsetY: overrides.offsetY ?? s.gridOffsetY,
    },
  );
}

function withRegenIfLive(layout: Layout, live: boolean): Layout {
  if (!live) return layout;
  return {
    ...layout,
    cells: regenWithExistingNames(layout),
  };
}

/**
 * Carry user-typed names from `oldCells` over to `freshCells` by matching
 * (rowIndex, columnIndex). Used after any geometry-only regeneration —
 * gap/inset/offset sliders, row/column count changes, etc. — so the user
 * doesn't lose their labels just because the grid was recomputed.
 */
function mergeNamesByRowCol(freshCells: Cell[], oldCells: Cell[]): Cell[] {
  const byKey = new Map<string, string>();
  for (const cell of oldCells) {
    byKey.set(`${cell.rowIndex}|${cell.columnIndex}`, cell.name);
  }
  return freshCells.map((c) => {
    const existing = byKey.get(`${c.rowIndex}|${c.columnIndex}`);
    return existing ? { ...c, name: existing } : c;
  });
}

/**
 * Regenerate grid via bilinear, but preserve existing cell names by index where
 * the cell exists. New cells (added because grid grew) get default names.
 */
function regenWithExistingNames(layout: Layout): Cell[] {
  const fresh = generateGrid(layout.boundaryCorners, layout.rowCount, layout.columnsPerRow);
  return mergeNamesByRowCol(fresh, layout.cells);
}

export const useLayoutStore = create<LayoutState>()(
  temporal(
    (set) => ({
  layout: makeEmptyLayout(),
  selectedCellIndex: null,
  liveRegenerate: true,
  validationCount: 0,
  geometryMode: 'rebin',
  rebinGapFactor: 0.5,
  cellInset: 0,
  gridOffsetX: 0,
  gridOffsetY: 0,
  currentEntryId: null,

  setGeometryMode: (m) => set({ geometryMode: m }),
  setCurrentEntryId: (id) => set({ currentEntryId: id }),
  setCellInset: (v) =>
    set((s) => {
      const clamped = Math.max(0, Math.min(0.4, v));
      if (s.layout.boundaryCorners.length !== 4) {
        return { cellInset: clamped };
      }
      const fresh = regenCells(s, { cellInset: clamped });
      const cells = mergeNamesByRowCol(fresh, s.layout.cells);
      return {
        cellInset: clamped,
        layout: { ...s.layout, cells },
        selectedCellIndex: null,
      };
    }),
  setGridOffset: (axis, v) =>
    set((s) => {
      const clamped = Math.max(-200, Math.min(200, v));
      const patch = axis === 'x' ? { gridOffsetX: clamped } : { gridOffsetY: clamped };
      if (s.layout.boundaryCorners.length !== 4) {
        return patch;
      }
      const fresh = regenCells(
        { ...s, ...patch },
        // Pass the new offset directly so we don't need a fresh getState().
        axis === 'x'
          ? { offsetX: clamped }
          : { offsetY: clamped },
      );
      const cells = mergeNamesByRowCol(fresh, s.layout.cells);
      return {
        ...patch,
        layout: { ...s.layout, cells },
        selectedCellIndex: null,
      };
    }),
  setRebinGapFactor: (f) =>
    set((s) => {
      const clamped = Math.max(0, Math.min(2, f));
      // If we're in rebin mode and have a valid boundary, regenerate cells
      // immediately so the slider feels live. In pod mode the gap factor is
      // unused so we just update the value.
      if (s.geometryMode !== 'rebin' || s.layout.boundaryCorners.length !== 4) {
        return { rebinGapFactor: clamped };
      }
      const ordered = canonicalizeCorners([
        s.layout.boundaryCorners[0],
        s.layout.boundaryCorners[1],
        s.layout.boundaryCorners[2],
        s.layout.boundaryCorners[3],
      ]);
      const fresh = regenCells(s, { gapFactor: clamped });
      const cells = mergeNamesByRowCol(fresh, s.layout.cells);
      return {
        rebinGapFactor: clamped,
        layout: { ...s.layout, boundaryCorners: ordered, cells },
        selectedCellIndex: null,
      };
    }),

  setLayout: (layout) =>
    // When loading an existing XML, default to non-live regenerate so manual
    // per-cell adjustments aren't lost the moment the user nudges a boundary.
    // User can flip the toggle on if they want full re-bilinear behaviour.
    set({ layout, selectedCellIndex: null, validationCount: 0, liveRegenerate: false }),
  resetLayout: () =>
    set({
      layout: makeEmptyLayout(),
      selectedCellIndex: null,
      validationCount: 0,
      liveRegenerate: true,
    }),
  selectCell: (i) => set({ selectedCellIndex: i }),
  setLiveRegenerate: (v) => set({ liveRegenerate: v }),

  setStationName: (stationName) =>
    set((s) => ({ layout: { ...s.layout, stationName } })),

  updateScreen: (patch) =>
    set((s) => ({
      layout: { ...s.layout, screen: { ...s.layout.screen, ...patch } },
    })),

  updateMetadata: (patch) =>
    set((s) => ({
      layout: { ...s.layout, metadata: { ...s.layout.metadata, ...patch } },
    })),

  setSurfaceType: (t) =>
    set((s) => ({
      layout: {
        ...s.layout,
        metadata: { ...s.layout.metadata, surfaceType: t, surface: defaultSurfaceLabel(t) },
      },
    })),

  addFace: (f) =>
    set((s) => ({
      layout: {
        ...s.layout,
        metadata: { ...s.layout.metadata, face: [...s.layout.metadata.face, f] },
      },
    })),

  removeFace: (idx) =>
    set((s) => ({
      layout: {
        ...s.layout,
        metadata: {
          ...s.layout.metadata,
          face: s.layout.metadata.face.filter((_, i) => i !== idx),
        },
      },
    })),

  updateFace: (idx, value) =>
    set((s) => ({
      layout: {
        ...s.layout,
        metadata: {
          ...s.layout.metadata,
          face: s.layout.metadata.face.map((f, i) => (i === idx ? value : f)),
        },
      },
    })),

  setRowCount: (n) =>
    set((s) => {
      const next = Math.max(1, Math.floor(n));
      const cur = s.layout.columnsPerRow;
      const last = cur[cur.length - 1] ?? 1;
      let columnsPerRow: number[];
      if (next <= cur.length) columnsPerRow = cur.slice(0, next);
      else columnsPerRow = [...cur, ...Array.from({ length: next - cur.length }, () => last)];

      const layout: Layout = {
        ...s.layout,
        rowCount: next,
        columnsPerRow,
      };
      return {
        layout: { ...layout, cells: regenWithExistingNames(layout) },
        selectedCellIndex: null,
      };
    }),

  setColumnsForRow: (rowIndex, cols) =>
    set((s) => {
      const cpr = [...s.layout.columnsPerRow];
      cpr[rowIndex] = Math.max(1, Math.floor(cols));
      const layout: Layout = { ...s.layout, columnsPerRow: cpr };
      return {
        layout: { ...layout, cells: regenWithExistingNames(layout) },
        selectedCellIndex: null,
      };
    }),

  moveBoundaryCorner: (idx, c) =>
    set((s) => {
      const clamped = clampToScreen(c, s.layout.screen);
      const corners = [...s.layout.boundaryCorners] as Layout['boundaryCorners'];
      corners[idx] = clamped;
      const next: Layout = { ...s.layout, boundaryCorners: corners };
      return { layout: withRegenIfLive(next, s.liveRegenerate) };
    }),

  setBoundaryCornerExact: (idx, c) =>
    set((s) => {
      const corners = [...s.layout.boundaryCorners] as Layout['boundaryCorners'];
      corners[idx] = c;
      const next: Layout = { ...s.layout, boundaryCorners: corners };
      return { layout: withRegenIfLive(next, s.liveRegenerate) };
    }),

  regenerateCells: () =>
    set((s) => ({
      layout: {
        ...s.layout,
        cells: generateGrid(
          s.layout.boundaryCorners,
          s.layout.rowCount,
          s.layout.columnsPerRow,
        ),
      },
      selectedCellIndex: null,
    })),

  applyHomographyFix: (opts) =>
    set((s) => {
      // Dispatch on explicit override, otherwise use the geometryMode toggle.
      // 'rebin' = two adjacent units with metal post in middle (canonicalize
      // + asym500). 'pod' = single surface, oblique projection ok (trust
      // RAS click order + uniform spacing).
      const isRebin = (opts?.mode ?? s.geometryMode) === 'rebin';

      const corners = s.layout.boundaryCorners;
      const ordered = isRebin
        ? canonicalizeCorners([corners[0], corners[1], corners[2], corners[3]])
        : corners;
      // regenCells reads geometryMode + detects direction + threads all
      // slider overrides; pass through s with the (possibly canonicalized)
      // boundary so downstream cell generation sees the right corners.
      const cells = regenCells({ ...s, layout: { ...s.layout, boundaryCorners: ordered } });
      return {
        layout: {
          ...s.layout,
          boundaryCorners: ordered,
          cells,
        },
        selectedCellIndex: null,
      };
    }),

  setCellName: (i, name) =>
    set((s) => {
      const cells = [...s.layout.cells];
      cells[i] = { ...cells[i], name };
      return { layout: { ...s.layout, cells } };
    }),

  moveCellCorner: (cellIdx, corner, c) =>
    set((s) => {
      const clamped = clampToScreen(c, s.layout.screen);
      const cells = [...s.layout.cells];
      cells[cellIdx] = { ...cells[cellIdx], [corner]: clamped };
      return { layout: { ...s.layout, cells } };
    }),

      applyValidationCount: (count) => set({ validationCount: count }),
    }),
    {
      // Only the user-facing layout participates in undo history.
      // UI state (selectedCellIndex, liveRegenerate, validationCount) is excluded.
      partialize: (state) => ({ layout: state.layout }),
      limit: 100,
      // We deliberately don't debounce/throttle here. Instead, the canvas
      // pauses temporal during a drag (one snapshot before drag, none during,
      // resume on drop) — this gives clean per-action undo behaviour.
      equality: (a, b) => a.layout === b.layout,
    },
  ),
);

/** React-friendly hook to read temporal (undo/redo) state with reactivity. */
export function useTemporalLayout<T>(
  selector: (state: TemporalState<{ layout: Layout }>) => T,
): T {
  return useStore(useLayoutStore.temporal, selector);
}
