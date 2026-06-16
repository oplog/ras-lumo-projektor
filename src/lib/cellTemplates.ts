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
