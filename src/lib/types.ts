/**
 * Domain types mirroring the C# RasStationComms ProjectorLayoutConfiguration model.
 *
 * Property names use camelCase here but serialize to PascalCase XML attributes
 * to match the C# `XmlSerializer` output expected by the Windows app.
 */

export interface Corner {
  x: number;
  y: number;
}

export interface Cell {
  name: string;
  rowIndex: number;
  columnIndex: number;
  topLeft: Corner;
  topRight: Corner;
  bottomLeft: Corner;
  bottomRight: Corner;
}

export interface ScreenConfig {
  deviceName: string;
  index: number;
  width: number;
  height: number;
  isPrimary: boolean;
}

/** Mirrors C# `SurfaceType` enum values exactly (string form). */
export type SurfaceType =
  | 'FourFacePod'
  | 'Pallet'
  | 'PutToLight'
  | 'PackToLight'
  | 'CustomMultiFace'
  | 'CustomMonoFace';

export const SURFACE_TYPE_LABELS: Record<SurfaceType, string> = {
  FourFacePod: '4 Face Pod',
  Pallet: 'Pallet',
  PutToLight: 'PutToLight',
  PackToLight: 'PackToLight',
  CustomMultiFace: 'Custom Multi Face',
  CustomMonoFace: 'Custom Mono Face',
};

export const ALL_SURFACE_TYPES: SurfaceType[] = [
  'FourFacePod',
  'Pallet',
  'PutToLight',
  'PackToLight',
  'CustomMultiFace',
  'CustomMonoFace',
];

export interface Metadata {
  face: string[];
  surfaceType: SurfaceType;
  surface: string;
}

export interface Layout {
  stationName: string;
  version: string;
  lastModified: string;
  screen: ScreenConfig;
  metadata: Metadata;
  rowCount: number;
  columnsPerRow: number[];
  /** Order: TopLeft, TopRight, BottomLeft, BottomRight (matches C# enum order). */
  boundaryCorners: [Corner, Corner, Corner, Corner];
  cells: Cell[];
}

/** Convenience helper: get default Surface label for a SurfaceType. */
export function defaultSurfaceLabel(t: SurfaceType): string {
  return SURFACE_TYPE_LABELS[t];
}
