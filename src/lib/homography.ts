import type { Cell, Corner } from './types';
import { defaultCellName } from './cellNaming';

/**
 * Canonicalize 4 boundary corners by geometry, regardless of click order.
 * Returns [TL, TR, BL, BR] in the canonical order the C# RAS app expects.
 *
 * Heuristic:
 *   TL = corner with smallest (x + y)   ← top-left has small x AND small y
 *   BR = corner with largest  (x + y)   ← bottom-right has large x AND large y
 *   TR = corner with largest  (x − y)   ← top-right has large x but small y
 *   BL = corner with smallest (x − y)   ← bottom-left has small x but large y
 */
export function canonicalizeCorners(
  corners: Corner[],
): [Corner, Corner, Corner, Corner] {
  if (corners.length !== 4) {
    throw new Error('canonicalizeCorners requires exactly 4 points');
  }
  let TL = corners[0];
  let TR = corners[0];
  let BL = corners[0];
  let BR = corners[0];
  let minSum = Infinity;
  let maxSum = -Infinity;
  let minDiff = Infinity;
  let maxDiff = -Infinity;
  for (const c of corners) {
    const sum = c.x + c.y;
    const diff = c.x - c.y;
    if (sum < minSum) {
      minSum = sum;
      TL = c;
    }
    if (sum > maxSum) {
      maxSum = sum;
      BR = c;
    }
    if (diff > maxDiff) {
      maxDiff = diff;
      TR = c;
    }
    if (diff < minDiff) {
      minDiff = diff;
      BL = c;
    }
  }
  return [TL, TR, BL, BR];
}

/**
 * Build a perspective transform (homography) from the unit square (u, v) ∈ [0,1]
 * onto the quadrilateral defined by 4 corners.
 *
 * Implements Heckbert's closed-form solution: maps (0,0)→TL, (1,0)→TR,
 * (0,1)→BL, (1,1)→BR. Returns a function H(u, v) → projector pixel.
 *
 * This is the mathematically-correct mapping for projecting a planar grid
 * onto a tilted rectangle, replacing the bilinear approximation that drifts
 * away from cell positions in interior rows/columns.
 */
export function buildHomography(
  TL: Corner,
  TR: Corner,
  BL: Corner,
  BR: Corner,
): (u: number, v: number) => Corner {
  const dx1 = TR.x - BR.x;
  const dx2 = BL.x - BR.x;
  const sx = TL.x - TR.x - BL.x + BR.x;
  const dy1 = TR.y - BR.y;
  const dy2 = BL.y - BR.y;
  const sy = TL.y - TR.y - BL.y + BR.y;

  const det = dx1 * dy2 - dx2 * dy1;
  if (Math.abs(det) < 1e-10) {
    throw new Error('Degenerate quadrilateral — boundary corners are collinear');
  }
  const g = (sx * dy2 - dx2 * sy) / det;
  const h = (dx1 * sy - sx * dy1) / det;

  const h11 = TR.x - TL.x + g * TR.x;
  const h12 = BL.x - TL.x + h * BL.x;
  const h13 = TL.x;
  const h21 = TR.y - TL.y + g * TR.y;
  const h22 = BL.y - TL.y + h * BL.y;
  const h23 = TL.y;

  return (u, v) => {
    const denom = g * u + h * v + 1;
    return {
      x: (h11 * u + h12 * v + h13) / denom,
      y: (h21 * u + h22 * v + h23) / denom,
    };
  };
}

/**
 * Compute (uLeft, uRight) for a single cell within a row.
 *
 * Two distribution modes:
 *
 *   uniform  — cells equally spaced across u ∈ [0, 1]. Default for single-
 *              surface layouts (one pod, one pallet, etc.).
 *
 *   asym500  — the asymmetric distribution validated in the field for
 *              two-rebin layouts (one boundary spanning two adjacent
 *              rebins with a metal post in the middle). Left rebin's cells
 *              span u=[0, 0.5] uncompressed (each cell = 1/cols), then a
 *              small gap representing the post, then the right rebin's
 *              cells span u=[(half + 0.5)/(cols + 0.5), 1] (compressed by
 *              half a cell width to absorb the post). Only applies when
 *              cols is even and ≥ 4.
 */
function uRangeForCell(
  col: number,
  cols: number,
  mode: 'uniform' | 'asym500',
): { uL: number; uR: number } {
  const canAsym = mode === 'asym500' && cols >= 4 && cols % 2 === 0;
  if (!canAsym) {
    return { uL: col / cols, uR: (col + 1) / cols };
  }
  const half = cols / 2;
  if (col < half) {
    return { uL: col / cols, uR: (col + 1) / cols };
  }
  const total = cols + 0.5;
  const rightStart = (half + 0.5) / total;
  const rightCellW = (1 - rightStart) / half;
  const j = col - half;
  return {
    uL: rightStart + j * rightCellW,
    uR: rightStart + (j + 1) * rightCellW,
  };
}

export interface HomographyOptions {
  /** When true, reorder corners by geometry (TL=min(x+y), etc.) before
   *  building the homography. Useful for head-on projections where the
   *  user may have clicked corners in the wrong sequence. Breaks oblique
   *  projector setups, where the geometric order doesn't match the user's
   *  intended TL/TR. */
  canonicalize?: boolean;
  /** u-distribution mode. 'uniform' for single-surface layouts. 'asym500'
   *  for two-rebin layouts (e.g. FourFacePod where two adjacent rebins
   *  share one boundary with a post between them). */
  uMode?: 'uniform' | 'asym500';
}

/**
 * Generate a grid of cells using homography. Output format matches the
 * C# RAS app's `ProjectorLayoutConfiguration` exactly — drop-in
 * replacement that the Windows app loads without changes.
 *
 * Defaults: trust RAS click order (no canonicalization), uniform u
 * spacing — correct for the most common setup.
 */
export function generateGridHomography(
  boundary: [Corner, Corner, Corner, Corner],
  rowCount: number,
  columnsPerRow: number[],
  opts?: HomographyOptions,
): Cell[] {
  if (boundary.length !== 4) {
    throw new Error('boundary must have exactly 4 corners');
  }
  if (rowCount <= 0) {
    throw new Error('rowCount must be positive');
  }
  if (columnsPerRow.length !== rowCount) {
    throw new Error(
      `columnsPerRow length (${columnsPerRow.length}) must equal rowCount (${rowCount})`,
    );
  }
  if (columnsPerRow.some((c) => c <= 0)) {
    throw new Error('all column counts must be positive');
  }

  const [TL, TR, BL, BR] = opts?.canonicalize
    ? canonicalizeCorners(boundary)
    : boundary;
  const H = buildHomography(TL, TR, BL, BR);
  const uMode = opts?.uMode ?? 'uniform';
  const cells: Cell[] = [];

  for (let row = 0; row < rowCount; row++) {
    const cols = columnsPerRow[row];
    const vTop = row / rowCount;
    const vBot = (row + 1) / rowCount;

    for (let col = 0; col < cols; col++) {
      const { uL, uR } = uRangeForCell(col, cols, uMode);
      cells.push({
        name: defaultCellName(row, col, rowCount, cols),
        rowIndex: row,
        columnIndex: col,
        topLeft: H(uL, vTop),
        topRight: H(uR, vTop),
        bottomLeft: H(uL, vBot),
        bottomRight: H(uR, vBot),
      });
    }
  }
  return cells;
}
