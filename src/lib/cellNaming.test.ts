import { describe, expect, it } from 'vitest';
import { defaultCellName, mergeNamesByRowCol } from './cellNaming';
import type { Cell } from './types';

const corner = { x: 0, y: 0 };
function cell(rowIndex: number, columnIndex: number, name: string): Cell {
  return {
    name,
    rowIndex,
    columnIndex,
    topLeft: corner,
    topRight: corner,
    bottomLeft: corner,
    bottomRight: corner,
  };
}

describe('defaultCellName', () => {
  it('uses bottom-row = A, single column = bare letter', () => {
    // 3 rows; bottom row (rowIndex 2) → A, single column
    expect(defaultCellName(2, 0, 3, 1)).toBe('A');
    expect(defaultCellName(1, 0, 3, 1)).toBe('B');
    expect(defaultCellName(0, 0, 3, 1)).toBe('C');
  });

  it('adds 1-based column suffix for multi-column rows', () => {
    expect(defaultCellName(2, 0, 3, 2)).toBe('A-1');
    expect(defaultCellName(2, 1, 3, 2)).toBe('A-2');
  });
});

describe('mergeNamesByRowCol', () => {
  it('carries user names onto fresh cells by (row, col)', () => {
    const oldCells = [cell(0, 0, 'Sol'), cell(0, 1, 'Sağ')];
    const fresh = [cell(0, 0, 'A-1'), cell(0, 1, 'A-2')];
    const merged = mergeNamesByRowCol(fresh, oldCells);
    expect(merged.map((c) => c.name)).toEqual(['Sol', 'Sağ']);
  });

  it('keeps the fresh default for positions with no prior name', () => {
    const oldCells = [cell(0, 0, 'Sol')];
    const fresh = [cell(0, 0, 'A-1'), cell(0, 1, 'A-2')]; // grid grew
    const merged = mergeNamesByRowCol(fresh, oldCells);
    expect(merged.map((c) => c.name)).toEqual(['Sol', 'A-2']);
  });

  it('preserves an explicitly emptied name (empty string is a real value)', () => {
    const oldCells = [cell(0, 0, '')];
    const fresh = [cell(0, 0, 'A')];
    expect(mergeNamesByRowCol(fresh, oldCells)[0].name).toBe('');
  });

  it('returns fresh untouched when there are no old cells', () => {
    const fresh = [cell(0, 0, 'A')];
    expect(mergeNamesByRowCol(fresh, [])).toBe(fresh);
  });

  it('does not mutate the input arrays', () => {
    const oldCells = [cell(0, 0, 'X')];
    const fresh = [cell(0, 0, 'A')];
    mergeNamesByRowCol(fresh, oldCells);
    expect(fresh[0].name).toBe('A');
  });
});
