import { describe, expect, it } from 'vitest';
import {
  BUILTIN_TEMPLATES,
  applyWPrefix,
  parseCellNames,
  rebinSplitLabels,
  toWLabel,
} from './cellTemplates';

describe('parseCellNames', () => {
  it('splits one name per line and trims', () => {
    expect(parseCellNames('A-1\n A-2 \nB')).toEqual(['A-1', 'A-2', 'B']);
  });

  it('drops blank lines (trailing newline, stray blanks)', () => {
    expect(parseCellNames('A\n\nB\n')).toEqual(['A', 'B']);
  });

  it('falls back to comma-splitting a single line', () => {
    expect(parseCellNames('A-1, A-2 ,B')).toEqual(['A-1', 'A-2', 'B']);
  });

  it('prefers line-splitting when both newlines and commas exist', () => {
    expect(parseCellNames('A, mavi\nB')).toEqual(['A, mavi', 'B']);
  });

  it('returns empty for blank input', () => {
    expect(parseCellNames('   \n  ')).toEqual([]);
  });

  it('preserves Turkish characters', () => {
    expect(parseCellNames('Sağ Göz\nSol Göz')).toEqual(['Sağ Göz', 'Sol Göz']);
  });
});

describe('toWLabel / applyWPrefix', () => {
  it('converts "F-1" → "W-F-01" (prefix + zero-pad)', () => {
    expect(toWLabel('F-1')).toBe('W-F-01');
    expect(toWLabel('A-12')).toBe('W-A-12');
    expect(toWLabel('E-9')).toBe('W-E-09');
  });

  it('handles no-dash, lowercase ("f1" → "W-F-01")', () => {
    expect(toWLabel('f1')).toBe('W-F-01');
    expect(toWLabel('b7')).toBe('W-B-07');
  });

  it('leaves already-prefixed or non-matching names unchanged', () => {
    expect(toWLabel('W-F-01')).toBe('W-F-01');
    expect(toWLabel('Sol Göz')).toBe('Sol Göz');
  });

  it('maps a whole row in order', () => {
    expect(applyWPrefix(['F-1', 'F-2', 'F-3'])).toEqual(['W-F-01', 'W-F-02', 'W-F-03']);
  });
});

describe('rebinSplitLabels', () => {
  const grid = (rows: number, cols: number) => {
    const out: { rowIndex: number; columnIndex: number }[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) out.push({ rowIndex: r, columnIndex: c });
    }
    return out;
  };

  it('splits left/right by column, numbering each half row-major from 01', () => {
    // 2 rows × 4 cols → split at col 2
    expect(rebinSplitLabels(grid(2, 4), { leftLabel: 'W', rightLabel: 'E' })).toEqual([
      'W-01',
      'W-02',
      'E-01',
      'E-02',
      'W-03',
      'W-04',
      'E-03',
      'E-04',
    ]);
  });

  it('uses multi-char labels verbatim (e.g. "W-F")', () => {
    expect(rebinSplitLabels(grid(1, 4), { leftLabel: 'W-F', rightLabel: 'W-E' })).toEqual([
      'W-F-01',
      'W-F-02',
      'W-E-01',
      'W-E-02',
    ]);
  });

  it('reverse numbers a half right-to-left per row (08 başlangıç → terse)', () => {
    // 1 row × 4 cols, split at 2; left reverse → col0=W-02, col1=W-01
    expect(
      rebinSplitLabels(grid(1, 4), { leftLabel: 'W', rightLabel: 'E', leftReverse: true }),
    ).toEqual(['W-02', 'W-01', 'E-01', 'E-02']);
  });

  it('8-wide left half reverse starts at 08 on the leftmost cell', () => {
    const labels = rebinSplitLabels(grid(1, 16), {
      leftLabel: 'W-D',
      rightLabel: 'W-C',
      leftReverse: true,
    });
    expect(labels[0]).toBe('W-D-08'); // leftmost
    expect(labels[7]).toBe('W-D-01'); // last of left half
    expect(labels[8]).toBe('W-C-01'); // right half stays forward
  });

  it('uppercases labels and honours a custom split point', () => {
    expect(rebinSplitLabels(grid(1, 3), { leftLabel: 'a', rightLabel: 'b', half: 1 })).toEqual([
      'A-01',
      'B-01',
      'B-02',
    ]);
  });

  it('returns empty for no cells', () => {
    expect(rebinSplitLabels([], { leftLabel: 'W', rightLabel: 'E' })).toEqual([]);
  });
});

describe('BUILTIN_TEMPLATES', () => {
  it('ships the RAS-PAKETLEME 6×12 template (W-F-01 … W-A-12)', () => {
    const tpl = BUILTIN_TEMPLATES.find((t) => t.names.length === 72);
    expect(tpl).toBeTruthy();
    expect(tpl?.names[0]).toBe('W-F-01');
    expect(tpl?.names[11]).toBe('W-F-12');
    expect(tpl?.names[12]).toBe('W-E-01');
    expect(tpl?.names.at(-1)).toBe('W-A-12');
  });
});
