/**
 * Default cell naming convention from the C# `BilinearInterpolationService`:
 *   - Bottom row = letter 'A', moving upward through 'B', 'C', ...
 *   - Single-column rows: just the letter (e.g. "A", "B")
 *   - Multi-column rows: "{letter}-{col+1}" (e.g. "A-1", "A-2")
 *
 * Caller can override any cell's name freely; this is just the default seed.
 */

import type { Cell } from './types';

export function defaultCellName(
  rowIndex: number,
  columnIndex: number,
  rowCount: number,
  columnsInThisRow: number,
): string {
  const letterIndex = rowCount - 1 - rowIndex;
  const letter = String.fromCharCode('A'.charCodeAt(0) + letterIndex);
  if (columnsInThisRow === 1) return letter;
  return `${letter}-${columnIndex + 1}`;
}

/**
 * Carry user-typed names from `oldCells` over to `freshCells` by matching
 * (rowIndex, columnIndex). Used after any geometry-only regeneration —
 * gap/inset/offset sliders, row/column changes, Auto Fix — so the user never
 * loses their labels just because the grid was recomputed.
 *
 * Pure: no store access, fully unit-testable.
 */
export function mergeNamesByRowCol(freshCells: Cell[], oldCells: Cell[]): Cell[] {
  if (oldCells.length === 0) return freshCells;
  const byKey = new Map<string, string>();
  for (const cell of oldCells) {
    byKey.set(`${cell.rowIndex}|${cell.columnIndex}`, cell.name);
  }
  return freshCells.map((c) => {
    const existing = byKey.get(`${c.rowIndex}|${c.columnIndex}`);
    return existing !== undefined ? { ...c, name: existing } : c;
  });
}
