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
  it('splits left/right by column, numbering each half from 01', () => {
    // 2 rows × 4 cols, row-major → split at col 2
    const cols = [0, 1, 2, 3, 0, 1, 2, 3];
    expect(rebinSplitLabels(cols, 'F', 'E')).toEqual([
      'W-F-01',
      'W-F-02',
      'W-E-01',
      'W-E-02',
      'W-F-03',
      'W-F-04',
      'W-E-03',
      'W-E-04',
    ]);
  });

  it('uppercases letters and honours a custom split point', () => {
    expect(rebinSplitLabels([0, 1, 2], 'a', 'b', 1)).toEqual(['W-A-01', 'W-B-01', 'W-B-02']);
  });

  it('returns empty for no cells', () => {
    expect(rebinSplitLabels([], 'F', 'E')).toEqual([]);
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
