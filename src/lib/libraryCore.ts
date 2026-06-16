/**
 * Pure, side-effect-free core of the saved-layout library.
 *
 * Every function here is a deterministic `(state, input) -> newState`
 * transform: no `fetch`, no `localStorage`, no `Date.now()`, no `crypto`.
 * IDs and timestamps are injected by the caller (the stateful shell in
 * `library.ts`). That keeps this module trivially unit-testable in plain
 * Node — see `libraryCore.test.ts`.
 *
 * Data model — two levels:
 *   group (a station, e.g. `ras-paketleme-1`)
 *     └─ file (a standalone XML layout, e.g. `ras5`)
 * A file is tagged `pod` or `rebin` (its geometry mode). Empty groups are
 * tracked separately so a freshly-created station stays visible before its
 * first file lands.
 */

export type GeometryMode = 'pod' | 'rebin';

/**
 * Per-file editor settings that aren't part of the RAS XML (they only bake
 * into the cell geometry). Persisted alongside the entry so the sliders show
 * the values that were applied when the file is reopened.
 */
export interface LayoutSettings {
  gapFactor: number;
  cellInset: number;
  gridOffsetX: number;
  gridOffsetY: number;
}

export interface LibraryEntry {
  id: string;
  /** Station / group the file belongs to. Free text. */
  group: string;
  /** Bare file name (without `projector-layout-` prefix or extension). */
  fileName: string;
  mode: GeometryMode;
  xml: string;
  savedAt: number;
  /** Slider values applied to this file (offset/inset/gap). Optional/legacy. */
  settings?: LayoutSettings;
}

export interface LibraryState {
  entries: LibraryEntry[];
  /** Group names without any files yet. Survives until the first save. */
  emptyGroups: string[];
}

export interface GroupView {
  group: string;
  entries: LibraryEntry[];
}

export const EMPTY_STATE: LibraryState = { entries: [], emptyGroups: [] };

// ─── coercion ───────────────────────────────────────────────────────────────

/**
 * Coerce whatever shape happens to be on disk into the canonical
 * `LibraryState`. Tolerant of legacy variants: the old single-file model
 * (`stationName` only), `emptyStations` instead of `emptyGroups`, missing
 * ids, etc. Anything without a usable `xml` string is dropped.
 *
 * `makeId` is injected so the result stays deterministic in tests.
 */
export function consolidate(data: unknown, makeId: () => string): LibraryState {
  // biome-ignore lint/suspicious/noExplicitAny: tolerant of legacy shapes
  const d = data as any;
  const rawEntries = Array.isArray(d?.entries) ? d.entries : [];
  const entries: LibraryEntry[] = [];
  for (const r of rawEntries) {
    if (!r || typeof r.xml !== 'string') continue;
    const group =
      typeof r.group === 'string'
        ? r.group
        : typeof r.stationName === 'string'
          ? r.stationName
          : 'untitled';
    const fileName =
      typeof r.fileName === 'string'
        ? r.fileName
        : typeof r.stationName === 'string'
          ? r.stationName
          : 'untitled';
    entries.push({
      id: typeof r.id === 'string' && r.id ? r.id : makeId(),
      group,
      fileName,
      mode: r.mode === 'rebin' ? 'rebin' : 'pod',
      xml: r.xml,
      savedAt: typeof r.savedAt === 'number' ? r.savedAt : 0,
      settings: parseSettings(r.settings),
    });
  }
  const rawGroups = Array.isArray(d?.emptyGroups)
    ? d.emptyGroups
    : Array.isArray(d?.emptyStations)
      ? d.emptyStations
      : [];
  const emptyGroups = rawGroups
    .filter((n: unknown): n is string => typeof n === 'string' && n.trim() !== '')
    // Drop empty-group placeholders that already have real files.
    .filter((n: string) => !entries.some((e) => e.group === n));
  return { entries, emptyGroups: dedupe(emptyGroups) };
}

// ─── reads ────────────────────────────────────────────────────────────────

/** Group entries by station; include empty groups; newest-first within a group. */
export function listByGroup(state: LibraryState): GroupView[] {
  const map = new Map<string, LibraryEntry[]>();
  for (const e of state.entries) {
    const arr = map.get(e.group);
    if (arr) arr.push(e);
    else map.set(e.group, [e]);
  }
  for (const g of state.emptyGroups) {
    if (!map.has(g)) map.set(g, []);
  }
  for (const arr of map.values()) {
    arr.sort((a, b) => b.savedAt - a.savedAt);
  }
  return Array.from(map.entries())
    .map(([group, entries]) => ({ group, entries }))
    .sort((a, b) => a.group.localeCompare(b.group, 'tr'));
}

export function findEntry(state: LibraryState, id: string): LibraryEntry | null {
  return state.entries.find((e) => e.id === id) ?? null;
}

/** The row that an upsert would overwrite for a given (group, fileName), if any. */
export function findByName(
  state: LibraryState,
  group: string,
  fileName: string,
): LibraryEntry | null {
  const g = group.trim();
  const f = fileName.trim();
  return state.entries.find((e) => e.group === g && e.fileName === f) ?? null;
}

// ─── group mutations ──────────────────────────────────────────────────────

export function createEmptyGroup(state: LibraryState, name: string): LibraryState {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('İstasyon adı boş olamaz');
  if (state.emptyGroups.includes(trimmed)) return state;
  if (state.entries.some((e) => e.group === trimmed)) return state;
  return { ...state, emptyGroups: [...state.emptyGroups, trimmed] };
}

export function removeGroup(state: LibraryState, name: string): LibraryState {
  return {
    entries: state.entries.filter((e) => e.group !== name),
    emptyGroups: state.emptyGroups.filter((n) => n !== name),
  };
}

export function renameGroup(state: LibraryState, oldName: string, newName: string): LibraryState {
  const trimmed = newName.trim();
  if (!trimmed || trimmed === oldName) return state;
  const entries = state.entries.map((e) => (e.group === oldName ? { ...e, group: trimmed } : e));
  // Carry the placeholder over, dedupe, and drop any that now collide with a
  // group that actually holds files.
  const emptyGroups = dedupe(state.emptyGroups.map((n) => (n === oldName ? trimmed : n))).filter(
    (n) => !entries.some((e) => e.group === n),
  );
  return { entries, emptyGroups };
}

// ─── file mutations ───────────────────────────────────────────────────────

export interface SaveFileInput {
  group: string;
  fileName: string;
  mode: GeometryMode;
  xml: string;
  /** Force-replace a specific row by id (used by in-place auto-save). */
  replaceId?: string;
  /** Slider values applied to this file; persisted so they restore on load. */
  settings?: LayoutSettings;
}

/**
 * Upsert a file under a group.
 *
 * Resolution order for "which row does this write target":
 *   1. explicit `replaceId` (in-place auto-save of the loaded file)
 *   2. an existing row with the same (group, fileName) — overwrite it
 *      rather than piling up duplicates
 *   3. otherwise append a new row
 *
 * The replaced row keeps its position in the list (no jump-to-end), and the
 * target group is removed from `emptyGroups`.
 */
export function saveFile(
  state: LibraryState,
  input: SaveFileInput,
  meta: { id: string; savedAt: number },
): { state: LibraryState; entry: LibraryEntry } {
  const group = input.group.trim();
  const fileName = input.fileName.trim();
  if (!group) throw new Error('İstasyon adı boş olamaz');
  if (!fileName) throw new Error('Dosya adı boş olamaz');

  const existing =
    (input.replaceId ? state.entries.find((e) => e.id === input.replaceId) : undefined) ??
    state.entries.find((e) => e.group === group && e.fileName === fileName) ??
    null;

  const entry: LibraryEntry = {
    id: existing?.id ?? meta.id,
    group,
    fileName,
    mode: input.mode,
    xml: input.xml,
    savedAt: meta.savedAt,
    settings: input.settings ?? existing?.settings,
  };

  const entries = existing
    ? state.entries.map((e) => (e.id === existing.id ? entry : e))
    : [...state.entries, entry];

  return {
    state: { entries, emptyGroups: state.emptyGroups.filter((g) => g !== group) },
    entry,
  };
}

export function deleteEntry(state: LibraryState, id: string): LibraryState {
  const target = state.entries.find((e) => e.id === id);
  if (!target) return state;
  const entries = state.entries.filter((e) => e.id !== id);
  // Keep the (now empty) group visible as a placeholder so the user's station
  // doesn't vanish when its last file is removed.
  const stillHasFiles = entries.some((e) => e.group === target.group);
  const emptyGroups =
    !stillHasFiles && !state.emptyGroups.includes(target.group)
      ? [...state.emptyGroups, target.group]
      : state.emptyGroups;
  return { entries, emptyGroups };
}

export interface UpdatePatch {
  group?: string;
  fileName?: string;
  mode?: GeometryMode;
  xml?: string;
}

/** Patch a single entry's metadata / xml. Only changes the fields provided. */
export function updateEntry(
  state: LibraryState,
  id: string,
  patch: UpdatePatch,
  meta: { savedAt: number },
): LibraryState {
  const idx = state.entries.findIndex((e) => e.id === id);
  if (idx === -1) return state;
  const cur = state.entries[idx];
  const newGroup = patch.group?.trim() || cur.group;
  const next: LibraryEntry = {
    ...cur,
    group: newGroup,
    fileName: patch.fileName?.trim() || cur.fileName,
    mode: patch.mode ?? cur.mode,
    xml: patch.xml ?? cur.xml,
    // Only bump the timestamp when the actual content (xml) changed.
    savedAt: patch.xml !== undefined ? meta.savedAt : cur.savedAt,
  };

  const entries = [...state.entries.slice(0, idx), next, ...state.entries.slice(idx + 1)];

  let emptyGroups = state.emptyGroups;
  if (newGroup !== cur.group) {
    const oldStillHasFiles = entries.some((e) => e.group === cur.group);
    if (!oldStillHasFiles && !emptyGroups.includes(cur.group)) {
      emptyGroups = [...emptyGroups, cur.group];
    }
    emptyGroups = emptyGroups.filter((n) => n !== newGroup);
  }
  return { entries, emptyGroups };
}

// ─── helpers ────────────────────────────────────────────────────────────────

function dedupe(arr: string[]): string[] {
  return Array.from(new Set(arr));
}

function parseSettings(s: unknown): LayoutSettings | undefined {
  if (!s || typeof s !== 'object') return undefined;
  const o = s as Record<string, unknown>;
  const keys = ['gapFactor', 'cellInset', 'gridOffsetX', 'gridOffsetY'] as const;
  if (keys.every((k) => typeof o[k] !== 'number')) return undefined;
  const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
  return {
    gapFactor: num(o.gapFactor, 0.5),
    cellInset: num(o.cellInset, 0),
    gridOffsetX: num(o.gridOffsetX, 0),
    gridOffsetY: num(o.gridOffsetY, 0),
  };
}
