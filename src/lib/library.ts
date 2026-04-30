/**
 * Persisted library of saved layouts.
 *
 * Two-level model: a "group" (a station — e.g. `ras-paketleme-1`) holds
 * one or more files (e.g. `ras5.xml`, `ras6.xml`). Each file is a
 * standalone XML and downloads as `projector-layout-${fileName}.xml`.
 *
 * Storage: Cloudflare R2, single `library.json` blob, accessed via the
 * Worker's `/api/library` endpoint. The frontend keeps an in-memory
 * cache loaded once at boot; mutations update synchronously and
 * `void persist()` pushes new state up fire-and-forget. A localStorage
 * mirror covers transient network failures.
 */

export interface LibraryEntry {
  id: string;
  /** Station / group the file belongs to. Free text. */
  group: string;
  /** Bare file name (without `projector-layout-` prefix or extension). */
  fileName: string;
  mode: 'pod' | 'rebin';
  xml: string;
  savedAt: number;
}

interface LibraryState {
  entries: LibraryEntry[];
  /** Group names without any files yet. Survives until the first save. */
  emptyGroups: string[];
}

const API_URL = '/api/library';
const MIRROR_KEY = 'lumo-library-mirror-v3';

let cache: LibraryState = { entries: [], emptyGroups: [] };
let loaded = false;

// ─── boot ─────────────────────────────────────────────────────────────────────

export async function loadLibrary(): Promise<void> {
  if (loaded) return;
  try {
    const res = await fetch(API_URL, { cache: 'no-store' });
    if (res.ok) {
      cache = consolidate(await res.json());
      writeMirror();
    } else {
      restoreFromMirror();
    }
  } catch {
    restoreFromMirror();
  }
  loaded = true;
  notifySubscribers();
}

/**
 * Coerce whatever shape happens to be on disk (older single-file model
 * with `stationName` only, or even older variants with `label`/`id`)
 * into the new (group, fileName) form. Old `stationName` becomes both
 * the group and the fileName for backwards compatibility.
 */
function consolidate(data: unknown): LibraryState {
  // biome-ignore lint/suspicious/noExplicitAny: tolerant of legacy shapes
  const d = data as any;
  const rawEntries = Array.isArray(d?.entries) ? d.entries : [];
  const out: LibraryEntry[] = [];
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
    out.push({
      id: typeof r.id === 'string' ? r.id : makeId(),
      group,
      fileName,
      mode: r.mode === 'rebin' ? 'rebin' : 'pod',
      xml: r.xml,
      savedAt: typeof r.savedAt === 'number' ? r.savedAt : 0,
    });
  }
  const emptyGroups = Array.isArray(d?.emptyGroups)
    ? d.emptyGroups.filter((n: unknown): n is string => typeof n === 'string')
    : Array.isArray(d?.emptyStations)
      ? d.emptyStations.filter((n: unknown): n is string => typeof n === 'string')
      : [];
  return { entries: out, emptyGroups };
}

function restoreFromMirror(): void {
  try {
    const raw = window.localStorage.getItem(MIRROR_KEY);
    if (!raw) return;
    cache = consolidate(JSON.parse(raw));
  } catch {
    /* ignore */
  }
}

function writeMirror(): void {
  try {
    window.localStorage.setItem(MIRROR_KEY, JSON.stringify(cache));
  } catch {
    /* quota / privacy mode */
  }
}

// ─── persistence (fire-and-forget) ────────────────────────────────────────────

let inFlight: Promise<void> | null = null;
let queued = false;
const persistListeners = new Set<(s: 'idle' | 'saving' | 'error') => void>();

export function subscribePersistState(
  cb: (s: 'idle' | 'saving' | 'error') => void,
): () => void {
  persistListeners.add(cb);
  return () => {
    persistListeners.delete(cb);
  };
}

function emitState(s: 'idle' | 'saving' | 'error') {
  for (const cb of persistListeners) cb(s);
}

async function persist(): Promise<void> {
  writeMirror();
  if (inFlight) {
    queued = true;
    return inFlight;
  }
  emitState('saving');
  inFlight = (async () => {
    try {
      const res = await fetch(API_URL, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(cache),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      emitState('idle');
    } catch (err) {
      console.warn('Library persist failed', err);
      emitState('error');
    } finally {
      inFlight = null;
      if (queued) {
        queued = false;
        void persist();
      }
    }
  })();
  return inFlight;
}

// ─── subscribers ──────────────────────────────────────────────────────────────

const subscribers = new Set<() => void>();

export function subscribeLibrary(cb: () => void): () => void {
  subscribers.add(cb);
  return () => {
    subscribers.delete(cb);
  };
}

function notifySubscribers(): void {
  for (const cb of subscribers) cb();
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function makeId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

// ─── public API ───────────────────────────────────────────────────────────────

export interface GroupView {
  group: string;
  entries: LibraryEntry[];
}

/** Group entries by station name; include empty groups for visibility. */
export function listByGroup(): GroupView[] {
  const map = new Map<string, LibraryEntry[]>();
  for (const e of cache.entries) {
    const arr = map.get(e.group);
    if (arr) arr.push(e);
    else map.set(e.group, [e]);
  }
  for (const g of cache.emptyGroups) {
    if (!map.has(g)) map.set(g, []);
  }
  // Newest entry first within each group.
  for (const arr of map.values()) {
    arr.sort((a, b) => b.savedAt - a.savedAt);
  }
  return Array.from(map.entries())
    .map(([group, entries]) => ({ group, entries }))
    .sort((a, b) => a.group.localeCompare(b.group, 'tr'));
}

export function getEntry(id: string): LibraryEntry | null {
  return cache.entries.find((e) => e.id === id) ?? null;
}

export function createEmptyGroup(name: string): void {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('İstasyon adı boş olamaz');
  if (cache.emptyGroups.includes(trimmed)) return;
  if (cache.entries.some((e) => e.group === trimmed)) return;
  cache.emptyGroups = [...cache.emptyGroups, trimmed];
  notifySubscribers();
  void persist();
}

export function removeGroup(name: string): void {
  cache.entries = cache.entries.filter((e) => e.group !== name);
  cache.emptyGroups = cache.emptyGroups.filter((n) => n !== name);
  notifySubscribers();
  void persist();
}

export function renameGroup(oldName: string, newName: string): void {
  const trimmed = newName.trim();
  if (!trimmed || trimmed === oldName) return;
  cache.entries = cache.entries.map((e) =>
    e.group === oldName ? { ...e, group: trimmed } : e,
  );
  cache.emptyGroups = cache.emptyGroups.map((n) => (n === oldName ? trimmed : n));
  notifySubscribers();
  void persist();
}

/**
 * Save a file under a group. If `replaceId` matches an existing row,
 * its XML is overwritten in place; otherwise a new row is appended.
 * Saving into a group also takes it out of the empty-groups list.
 */
export function saveFile(opts: {
  group: string;
  fileName: string;
  mode: 'pod' | 'rebin';
  xml: string;
  replaceId?: string;
}): LibraryEntry {
  const group = opts.group.trim();
  const fileName = opts.fileName.trim();
  if (!group) throw new Error('İstasyon adı boş olamaz');
  if (!fileName) throw new Error('Dosya adı boş olamaz');
  if (cache.emptyGroups.includes(group)) {
    cache.emptyGroups = cache.emptyGroups.filter((n) => n !== group);
  }
  const next: LibraryEntry = {
    id: opts.replaceId ?? makeId(),
    group,
    fileName,
    mode: opts.mode,
    xml: opts.xml,
    savedAt: Date.now(),
  };
  cache.entries = opts.replaceId
    ? [...cache.entries.filter((e) => e.id !== opts.replaceId), next]
    : [...cache.entries, next];
  notifySubscribers();
  void persist();
  return next;
}

export function deleteEntry(id: string): void {
  const before = cache.entries.length;
  cache.entries = cache.entries.filter((e) => e.id !== id);
  if (cache.entries.length === before) return;
  notifySubscribers();
  void persist();
}

export function updateEntry(
  id: string,
  patch: { group?: string; fileName?: string; xml?: string },
): void {
  const idx = cache.entries.findIndex((e) => e.id === id);
  if (idx === -1) return;
  const cur = cache.entries[idx];
  const next: LibraryEntry = {
    ...cur,
    group: patch.group?.trim() || cur.group,
    fileName: patch.fileName?.trim() || cur.fileName,
    xml: patch.xml ?? cur.xml,
    savedAt: patch.xml !== undefined ? Date.now() : cur.savedAt,
  };
  cache.entries = [...cache.entries.slice(0, idx), next, ...cache.entries.slice(idx + 1)];
  notifySubscribers();
  void persist();
}
