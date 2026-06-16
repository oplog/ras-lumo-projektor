import { generateGrid } from './bilinear';
import type { GeometryMode } from './libraryCore';
import type { Layout, SurfaceType } from './types';

/**
 * Best-guess geometry mode for a freshly-opened XML. RAS rebin geometry
 * (two adjacent units + centre post) comes from the Put/Pack to-light
 * surfaces; everything else is treated as a single-surface pod.
 */
export function inferGeometryMode(surfaceType: SurfaceType): GeometryMode {
  return surfaceType === 'PutToLight' || surfaceType === 'PackToLight' ? 'rebin' : 'pod';
}

/** Sensible empty layout to bootstrap a new mapping session. */
export function makeEmptyLayout(): Layout {
  // Default to a horizontal projector geometry that matches the active
  // production setup (1280×800 PutToLight). Users edit the screen panel
  // for vertical / different setups.
  const width = 1280;
  const height = 800;
  const inset = 80;
  const boundary: Layout['boundaryCorners'] = [
    { x: inset, y: inset },
    { x: width - inset, y: inset },
    { x: inset, y: height - inset },
    { x: width - inset, y: height - inset },
  ];
  const rowCount = 3;
  const columnsPerRow = [3, 3, 3];

  return {
    stationName: '',
    version: '1.0',
    lastModified: new Date().toISOString(),
    screen: {
      deviceName: '\\\\.\\DISPLAY2',
      index: 3,
      width,
      height,
      isPrimary: false,
    },
    metadata: {
      face: [],
      surfaceType: 'PutToLight',
      surface: 'PutToLight',
    },
    rowCount,
    columnsPerRow,
    boundaryCorners: boundary,
    cells: generateGrid(boundary, rowCount, columnsPerRow),
  };
}
