import { describe, expect, it } from 'vitest';
import { inferGeometryMode, makeBlankLayout, makeEmptyLayout } from './defaults';

describe('makeBlankLayout', () => {
  it('has no cells and no grid (empty editor state)', () => {
    const l = makeBlankLayout();
    expect(l.cells).toEqual([]);
    expect(l.rowCount).toBe(0);
    expect(l.columnsPerRow).toEqual([]);
    expect(l.stationName).toBe('');
  });

  it('is still a valid Layout (4 boundary corners + a screen)', () => {
    const l = makeBlankLayout();
    expect(l.boundaryCorners).toHaveLength(4);
    expect(l.screen.width).toBeGreaterThan(0);
  });
});

describe('makeEmptyLayout', () => {
  it('defaults to a small 3×3 grid', () => {
    const l = makeEmptyLayout();
    expect(l.rowCount).toBe(3);
    expect(l.columnsPerRow).toEqual([3, 3, 3]);
    expect(l.cells).toHaveLength(9);
  });

  it('sizes the grid to rows × cols (e.g. 6×8 = 48 göz)', () => {
    const l = makeEmptyLayout({ rows: 6, cols: 8 });
    expect(l.rowCount).toBe(6);
    expect(l.columnsPerRow).toEqual([8, 8, 8, 8, 8, 8]);
    expect(l.cells).toHaveLength(48);
  });

  it('clamps to at least 1×1', () => {
    const l = makeEmptyLayout({ rows: 0, cols: -5 });
    expect(l.cells).toHaveLength(1);
  });
});

describe('inferGeometryMode', () => {
  it('returns rebin for Put/Pack to-light surfaces', () => {
    expect(inferGeometryMode('PutToLight')).toBe('rebin');
    expect(inferGeometryMode('PackToLight')).toBe('rebin');
  });

  it('returns pod for everything else', () => {
    expect(inferGeometryMode('FourFacePod')).toBe('pod');
    expect(inferGeometryMode('Pallet')).toBe('pod');
    expect(inferGeometryMode('CustomMonoFace')).toBe('pod');
  });
});
