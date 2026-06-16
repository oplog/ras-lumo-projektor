/**
 * Cell-name templates: paste/apply a whole list of names at once instead of
 * typing each cell by hand.
 *
 * `parseCellNames` is pure (and unit-tested). Template storage uses
 * localStorage; built-in templates are baked in as a constant — fill
 * `BUILTIN_TEMPLATES` with the ready lists the user provides.
 */

export interface CellTemplate {
  name: string;
  names: string[];
}

/** Build "W-{letter}-{01..count}" for each row letter, in cell order. */
function rowMajorWLabels(rowLetters: string[], colsPerRow: number): string[] {
  const out: string[] = [];
  for (const letter of rowLetters) {
    for (let n = 1; n <= colsPerRow; n++) {
      out.push(`W-${letter}-${String(n).padStart(2, '0')}`);
    }
  }
  return out;
}

/**
 * Ready-made templates shipped with the app. The RAS-PAKETLEME layout is a
 * 6×12 grid whose rows read F (top) → A (bottom), giving W-F-01..W-A-12.
 */
export const BUILTIN_TEMPLATES: CellTemplate[] = [
  {
    name: 'RAS-PAKETLEME (W-F→W-A · 72)',
    names: rowMajorWLabels(['F', 'E', 'D', 'C', 'B', 'A'], 12),
  },
];

const STORAGE_KEY = 'lumo-cell-name-templates';

/**
 * Turn pasted text into an ordered list of names. Accepts one-per-line OR a
 * single comma-separated line. Trims each entry and drops blank lines, so a
 * trailing newline or stray spaces don't create empty cell names.
 */
export function parseCellNames(text: string): string[] {
  const byLine = text.split(/\r?\n/);
  const source = byLine.length > 1 ? byLine : text.split(',');
  return source.map((s) => s.trim()).filter((s) => s !== '');
}

/**
 * Convert a raw cell label like "F-1", "f1" or "E-12" into the RAS form
 * "W-F-01" / "W-E-12" — prepend "W-" and zero-pad the number to 2 digits.
 * Already-prefixed or non-matching names are returned unchanged.
 */
export function toWLabel(name: string): string {
  const trimmed = name.trim();
  const m = trimmed.match(/^([A-Za-z]+)[-_ ]?(\d+)$/);
  if (!m) return trimmed;
  return `W-${m[1].toUpperCase()}-${m[2].padStart(2, '0')}`;
}

export function applyWPrefix(names: string[]): string[] {
  return names.map(toWLabel);
}

export interface RebinCell {
  rowIndex: number;
  columnIndex: number;
}

export interface RebinSplitOptions {
  leftLabel: string;
  rightLabel: string;
  /** Column at which the right half starts. Default = midpoint of the range. */
  half?: number;
  /** Number each row right-to-left for that half (leftmost cell gets the high
   *  number, e.g. an 8-wide row → 08,07,…,01). */
  leftReverse?: boolean;
  rightReverse?: boolean;
}

/** Assign "{label}-NN" to one half's cells, writing into `out` by original index. */
function assignSide(
  cells: RebinCell[],
  indices: number[],
  label: string,
  reverse: boolean,
  out: string[],
): void {
  const ordered = [...indices].sort((a, b) => {
    const ca = cells[a];
    const cb = cells[b];
    if (ca.rowIndex !== cb.rowIndex) return ca.rowIndex - cb.rowIndex;
    return reverse ? cb.columnIndex - ca.columnIndex : ca.columnIndex - cb.columnIndex;
  });
  ordered.forEach((origIdx, i) => {
    out[origIdx] = `${label}-${String(i + 1).padStart(2, '0')}`;
  });
}

/**
 * Rebin labelling: a two-unit rebin splits left/right by column. Cells in the
 * left half (columnIndex < half) get "{leftLabel}-NN", the right half get
 * "{rightLabel}-NN", each numbered row-major from 01. With `*Reverse`, that
 * half is numbered right-to-left within each row (08,07,…). Labels are used
 * VERBATIM (uppercased): "W" → "W-01", "W-F" → "W-F-01".
 *
 * Returns one label per input cell IN ORIGINAL ORDER (positional apply).
 */
export function rebinSplitLabels(cells: RebinCell[], opts: RebinSplitOptions): string[] {
  if (cells.length === 0) return [];
  const maxCol = Math.max(...cells.map((c) => c.columnIndex));
  const mid = opts.half ?? Math.ceil((maxCol + 1) / 2);
  const L = opts.leftLabel.trim().toUpperCase() || 'W';
  const R = opts.rightLabel.trim().toUpperCase() || 'E';
  const leftIdx: number[] = [];
  const rightIdx: number[] = [];
  cells.forEach((c, i) => (c.columnIndex < mid ? leftIdx : rightIdx).push(i));
  const out: string[] = new Array(cells.length);
  assignSide(cells, leftIdx, L, !!opts.leftReverse, out);
  assignSide(cells, rightIdx, R, !!opts.rightReverse, out);
  return out;
}

export function listCustomTemplates(): CellTemplate[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (t): t is CellTemplate =>
        t &&
        typeof t.name === 'string' &&
        Array.isArray(t.names) &&
        t.names.every((n: unknown) => typeof n === 'string'),
    );
  } catch {
    return [];
  }
}

export function saveCustomTemplate(name: string, names: string[]): void {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Şablon adı boş olamaz');
  const existing = listCustomTemplates().filter((t) => t.name !== trimmed);
  const next = [...existing, { name: trimmed, names }];
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function deleteCustomTemplate(name: string): void {
  const next = listCustomTemplates().filter((t) => t.name !== name);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

/** Built-in + custom templates, built-ins first. */
export function allTemplates(): CellTemplate[] {
  return [...BUILTIN_TEMPLATES, ...listCustomTemplates()];
}
