import type { Cell, Corner, Layout, Metadata, ScreenConfig, SurfaceType } from './types';
import { ALL_SURFACE_TYPES, defaultSurfaceLabel } from './types';

/**
 * Read/write XML in the exact shape that the C# Windows app expects.
 * Reference: `ProjectorLayoutConfiguration.cs` + `MetadataConfiguration.cs` +
 * `ScreenConfiguration.cs` from `RasStationComms`.
 *
 * To support both legacy XMLs (with `IsPallet` attribute) and the modern
 * format (with `SurfaceType` + `Surface` attributes) we WRITE both — the
 * `XmlSerializer` ignores attributes it doesn't recognize so this is safe.
 */

// ─── helpers ──────────────────────────────────────────────────────────────────

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Format a number the same way C#'s `XmlConvert` does for `double`. */
function num(n: number): string {
  if (!Number.isFinite(n)) return '0';
  // Integers come out without a decimal point ("238"); fractions keep full
  // double precision ("1051.7142857142858"). JS Number.toString() matches.
  return n.toString();
}

function bool(b: boolean): string {
  // XmlSerializer uses lowercase per W3C XML Schema lexical form.
  return b ? 'true' : 'false';
}

// ─── serialization ────────────────────────────────────────────────────────────

export function serializeLayoutToXml(layout: Layout): string {
  const lines: string[] = [];
  lines.push('<?xml version="1.0" encoding="utf-8"?>');

  const lastMod = layout.lastModified || isoNowWithLocalOffset();

  lines.push(
    '<ProjectorLayoutConfiguration ' +
      'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ' +
      'xmlns:xsd="http://www.w3.org/2001/XMLSchema" ' +
      `StationName="${escapeAttr(layout.stationName)}" ` +
      `RowCount="${num(layout.rowCount)}" ` +
      `LastModified="${escapeAttr(lastMod)}" ` +
      `Version="${escapeAttr(layout.version || '1.0')}">`,
  );

  // ScreenConfiguration (self-closing, attributes only)
  lines.push(`  ${serializeScreen(layout.screen)}`);

  // MetadataConfiguration — write BOTH legacy and modern attributes for compat.
  lines.push(...serializeMetadata(layout.metadata));

  // ColumnsPerRow
  lines.push('  <ColumnsPerRow>');
  for (const c of layout.columnsPerRow) {
    lines.push(`    <ColumnCount>${num(c)}</ColumnCount>`);
  }
  lines.push('  </ColumnsPerRow>');

  // BoundaryCorners
  lines.push('  <BoundaryCorners>');
  for (const corner of layout.boundaryCorners) {
    lines.push(`    <Corner X="${num(corner.x)}" Y="${num(corner.y)}"/>`);
  }
  lines.push('  </BoundaryCorners>');

  // Cells
  lines.push('  <Cells>');
  for (const cell of layout.cells) {
    lines.push(...serializeCell(cell));
  }
  lines.push('  </Cells>');

  lines.push('</ProjectorLayoutConfiguration>');
  return `${lines.join('\n')}\n`;
}

function serializeScreen(s: ScreenConfig): string {
  return (
    `<ScreenConfiguration ` +
    `DeviceName="${escapeAttr(s.deviceName)}" ` +
    `Index="${num(s.index)}" ` +
    `Width="${num(s.width)}" ` +
    `Height="${num(s.height)}" ` +
    `IsPrimary="${bool(s.isPrimary)}"/>`
  );
}

function serializeMetadata(m: Metadata): string[] {
  // Match the deployed Windows app's modern XML schema:
  //   <MetadataConfiguration SurfaceType="..." Surface="...">
  // (Older legacy XMLs use IsPallet instead; we drop it because newer/active
  // production XMLs from the user's machine omit it entirely.)
  const lines: string[] = [];
  lines.push(
    `  <MetadataConfiguration SurfaceType="${escapeAttr(m.surfaceType)}" Surface="${escapeAttr(m.surface)}">`,
  );
  if (m.face.length === 0) {
    lines.push('    <Face/>');
  } else {
    lines.push('    <Face>');
    for (const f of m.face) {
      lines.push(`      <Value>${escapeText(f)}</Value>`);
    }
    lines.push('    </Face>');
  }
  lines.push('  </MetadataConfiguration>');
  return lines;
}

function serializeCell(c: Cell): string[] {
  return [
    `    <Cell Name="${escapeAttr(c.name)}" RowIndex="${num(c.rowIndex)}" ColumnIndex="${num(c.columnIndex)}">`,
    `      <TopLeft X="${num(c.topLeft.x)}" Y="${num(c.topLeft.y)}"/>`,
    `      <TopRight X="${num(c.topRight.x)}" Y="${num(c.topRight.y)}"/>`,
    `      <BottomLeft X="${num(c.bottomLeft.x)}" Y="${num(c.bottomLeft.y)}"/>`,
    `      <BottomRight X="${num(c.bottomRight.x)}" Y="${num(c.bottomRight.y)}"/>`,
    '    </Cell>',
  ];
}

function isoNowWithLocalOffset(): string {
  // Match C# `DateTime.Now.ToString("o")` style: ISO-8601 with local offset
  // (e.g. "2025-12-22T09:19:59.948+03:00").
  const d = new Date();
  const pad = (n: number, w = 2) => String(n).padStart(w, '0');
  const tzMin = -d.getTimezoneOffset();
  const tzSign = tzMin >= 0 ? '+' : '-';
  const tz = `${tzSign}${pad(Math.floor(Math.abs(tzMin) / 60))}:${pad(Math.abs(tzMin) % 60)}`;
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` +
    `.${pad(d.getMilliseconds(), 3)}${tz}`
  );
}

// ─── parsing ──────────────────────────────────────────────────────────────────

export function parseLayoutFromXml(xmlText: string): Layout {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'application/xml');

  const parserError = doc.querySelector('parsererror');
  if (parserError) {
    throw new Error(`XML parse error: ${parserError.textContent ?? 'unknown'}`);
  }

  const root = doc.documentElement;
  if (root.tagName !== 'ProjectorLayoutConfiguration') {
    throw new Error(`Expected <ProjectorLayoutConfiguration>, got <${root.tagName}>`);
  }

  const stationName = attr(root, 'StationName') ?? '';
  const rowCount = numAttr(root, 'RowCount') ?? 0;
  const version = attr(root, 'Version') ?? '1.0';
  const lastModified = attr(root, 'LastModified') ?? new Date().toISOString();

  const screen = parseScreen(root.querySelector('ScreenConfiguration'));
  const metadata = parseMetadata(root.querySelector('MetadataConfiguration'));

  const columnsPerRow = Array.from(root.querySelectorAll('ColumnsPerRow > ColumnCount')).map((el) =>
    Number(el.textContent?.trim() ?? '0'),
  );

  const boundaryEls = Array.from(root.querySelectorAll('BoundaryCorners > Corner'));
  if (boundaryEls.length !== 4) {
    throw new Error(`Expected 4 boundary corners, got ${boundaryEls.length}`);
  }
  const boundaryCorners: [Corner, Corner, Corner, Corner] = [
    parseCorner(boundaryEls[0]),
    parseCorner(boundaryEls[1]),
    parseCorner(boundaryEls[2]),
    parseCorner(boundaryEls[3]),
  ];

  const cells = Array.from(root.querySelectorAll('Cells > Cell')).map(parseCell);

  return {
    stationName,
    version,
    lastModified,
    screen,
    metadata,
    rowCount,
    columnsPerRow,
    boundaryCorners,
    cells,
  };
}

function parseScreen(el: Element | null): ScreenConfig {
  if (!el) {
    return { deviceName: '', index: 0, width: 1920, height: 1080, isPrimary: false };
  }
  return {
    deviceName: attr(el, 'DeviceName') ?? '',
    index: numAttr(el, 'Index') ?? 0,
    width: numAttr(el, 'Width') ?? 1920,
    height: numAttr(el, 'Height') ?? 1080,
    isPrimary: boolAttr(el, 'IsPrimary') ?? false,
  };
}

function parseMetadata(el: Element | null): Metadata {
  if (!el) {
    return { face: [], surfaceType: 'FourFacePod', surface: '4 Face Pod' };
  }
  const face = Array.from(el.querySelectorAll('Face > Value'))
    .map((v) => v.textContent?.trim() ?? '')
    .filter(Boolean);

  let surfaceType: SurfaceType;
  const stAttr = attr(el, 'SurfaceType');
  if (stAttr && (ALL_SURFACE_TYPES as string[]).includes(stAttr)) {
    surfaceType = stAttr as SurfaceType;
  } else {
    // Legacy: only IsPallet attribute. Map true → Pallet, false → FourFacePod.
    const isPallet = boolAttr(el, 'IsPallet') ?? false;
    surfaceType = isPallet ? 'Pallet' : 'FourFacePod';
  }

  const surface = attr(el, 'Surface') ?? defaultSurfaceLabel(surfaceType);

  return { face, surfaceType, surface };
}

function parseCorner(el: Element): Corner {
  return { x: numAttr(el, 'X') ?? 0, y: numAttr(el, 'Y') ?? 0 };
}

function parseCell(el: Element): Cell {
  return {
    name: attr(el, 'Name') ?? '',
    rowIndex: numAttr(el, 'RowIndex') ?? 0,
    columnIndex: numAttr(el, 'ColumnIndex') ?? 0,
    topLeft: parseCornerChild(el, 'TopLeft'),
    topRight: parseCornerChild(el, 'TopRight'),
    bottomLeft: parseCornerChild(el, 'BottomLeft'),
    bottomRight: parseCornerChild(el, 'BottomRight'),
  };
}

function parseCornerChild(parent: Element, tag: string): Corner {
  const el = parent.querySelector(`:scope > ${tag}`);
  if (!el) return { x: 0, y: 0 };
  return parseCorner(el);
}

function attr(el: Element, name: string): string | null {
  return el.getAttribute(name);
}

function numAttr(el: Element, name: string): number | null {
  const v = el.getAttribute(name);
  if (v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function boolAttr(el: Element, name: string): boolean | null {
  const v = el.getAttribute(name);
  if (v === null) return null;
  return v.toLowerCase() === 'true';
}
