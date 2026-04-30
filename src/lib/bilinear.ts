import type { Cell, Corner } from './types';
import { defaultCellName } from './cellNaming';

/**
 * Bilinear interpolation inside a quadrilateral.
 *
 * Port of `BilinearInterpolationService.InterpolatePoint` from the C# app.
 * Formula: P(u,v) = (1-u)(1-v)*TL + u(1-v)*TR + (1-u)v*BL + uv*BR
 */
export function interpolate(
  TL: Corner,
  TR: Corner,
  BL: Corner,
  BR: Corner,
  u: number,
  v: number,
): Corner {
  const x =
    (1 - u) * (1 - v) * TL.x + u * (1 - v) * TR.x + (1 - u) * v * BL.x + u * v * BR.x;
  const y =
    (1 - u) * (1 - v) * TL.y + u * (1 - v) * TR.y + (1 - u) * v * BL.y + u * v * BR.y;
  return { x, y };
}

/**
 * Generate a grid of cells using bilinear interpolation. Mirrors
 * `BilinearInterpolationService.GenerateGrid` 1:1, including the row-letter
 * naming convention (bottom row = 'A', going up).
 */
export function generateGrid(
  boundary: [Corner, Corner, Corner, Corner],
  rowCount: number,
  columnsPerRow: number[],
): Cell[] {
  if (boundary.length !== 4) {
    throw new Error('boundary must have exactly 4 corners (TL, TR, BL, BR)');
  }
  if (rowCount <= 0) {
    throw new Error('rowCount must be positive');
  }
  if (columnsPerRow.length !== rowCount) {
    throw new Error(`columnsPerRow length (${columnsPerRow.length}) must equal rowCount (${rowCount})`);
  }
  if (columnsPerRow.some((c) => c <= 0)) {
    throw new Error('all column counts must be positive');
  }

  const [TL, TR, BL, BR] = boundary;
  const cells: Cell[] = [];

  for (let row = 0; row < rowCount; row++) {
    const cols = columnsPerRow[row];
    const vTop = row / rowCount;
    const vBottom = (row + 1) / rowCount;

    for (let col = 0; col < cols; col++) {
      const uLeft = col / cols;
      const uRight = (col + 1) / cols;

      cells.push({
        name: defaultCellName(row, col, rowCount, cols),
        rowIndex: row,
        columnIndex: col,
        topLeft: interpolate(TL, TR, BL, BR, uLeft, vTop),
        topRight: interpolate(TL, TR, BL, BR, uRight, vTop),
        bottomLeft: interpolate(TL, TR, BL, BR, uLeft, vBottom),
        bottomRight: interpolate(TL, TR, BL, BR, uRight, vBottom),
      });
    }
  }

  return cells;
}
