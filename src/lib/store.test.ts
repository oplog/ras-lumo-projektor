import { beforeEach, describe, expect, it } from 'vitest';
import { makeEmptyLayout } from './defaults';
import { useLayoutStore } from './store';

describe('layout store', () => {
  beforeEach(() => {
    useLayoutStore.getState().resetLayout();
  });

  it('resets to a blank layout with no active file', () => {
    const s = useLayoutStore.getState();
    expect(s.layout.cells).toEqual([]);
    expect(s.layout.rowCount).toBe(0);
    expect(s.currentEntryId).toBeNull();
  });

  it('setAllCellNames assigns names in cell order', () => {
    useLayoutStore.setState({ layout: makeEmptyLayout({ rows: 1, cols: 3 }) });
    useLayoutStore.getState().setAllCellNames(['Sol', 'Orta', 'Sağ']);
    expect(useLayoutStore.getState().layout.cells.map((c) => c.name)).toEqual([
      'Sol',
      'Orta',
      'Sağ',
    ]);
  });

  it('leaves trailing cells untouched when fewer names than cells', () => {
    useLayoutStore.setState({ layout: makeEmptyLayout({ rows: 1, cols: 2 }) });
    const before = useLayoutStore.getState().layout.cells.map((c) => c.name);
    useLayoutStore.getState().setAllCellNames(['X']);
    const after = useLayoutStore.getState().layout.cells.map((c) => c.name);
    expect(after[0]).toBe('X');
    expect(after[1]).toBe(before[1]); // unchanged
  });

  it('ignores extra names when more names than cells (no crash)', () => {
    useLayoutStore.setState({ layout: makeEmptyLayout({ rows: 1, cols: 2 }) });
    useLayoutStore.getState().setAllCellNames(['a', 'b', 'c', 'd']);
    const cells = useLayoutStore.getState().layout.cells;
    expect(cells).toHaveLength(2);
    expect(cells.map((c) => c.name)).toEqual(['a', 'b']);
  });

  it('setCellName updates a single cell by index', () => {
    useLayoutStore.setState({ layout: makeEmptyLayout({ rows: 1, cols: 2 }) });
    useLayoutStore.getState().setCellName(1, 'hedef');
    expect(useLayoutStore.getState().layout.cells[1].name).toBe('hedef');
  });
});
