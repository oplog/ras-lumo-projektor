import { describe, expect, it } from 'vitest';
import { parseCellNames } from './cellTemplates';

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
