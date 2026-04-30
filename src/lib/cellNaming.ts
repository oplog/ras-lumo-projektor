/**
 * Default cell naming convention from the C# `BilinearInterpolationService`:
 *   - Bottom row = letter 'A', moving upward through 'B', 'C', ...
 *   - Single-column rows: just the letter (e.g. "A", "B")
 *   - Multi-column rows: "{letter}-{col+1}" (e.g. "A-1", "A-2")
 *
 * Caller can override any cell's name freely; this is just the default seed.
 */
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
