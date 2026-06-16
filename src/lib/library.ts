/**
 * Stateful shell around the pure library core (`libraryCore.ts`).
 *
 * Holds the in-memory `cache`, talks to the `/api/library` endpoint
 * (Cloudflare Worker → R2 in prod, a local JSON file in dev), mirrors to
 * localStorage for offline resilience, and notifies React subscribers.
 *
 * All the actual data logic lives in the core; this file only wires the
 * core's pure transforms to IO and side effects. IDs and timestamps are
 * minted here and injected into the core so the core stays deterministic.
 */

import * as core from './libraryCore';
import type {
  GeometryMode,
  GroupView,
  LibraryEntry,
  LibraryState,
  UpdatePatch,
} from './libraryCore';

export type { GeometryMode, GroupView, LibraryEntry, LibraryState } from './libraryCore';

const API_URL = '/api/library';
const MIRROR_KEY = 'lumo-library-mirror-v3';

let cache: LibraryState = { ...core.EMPTY_STATE };
let loaded = false;

// ─── boot ─────────────────────────────────────────────────────────────────────

export async function loadLibrary(): Promise<void> {
  if (loaded) return;
  try {
    const res = await fetch(API_URL, { cache: 'no-store' });
    if (res.ok) {
      cache = core.consolidate(await res.json(), makeId);
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

function restoreFromMirror(): void {
  try {
    const raw = window.localStorage.getItem(MIRROR_KEY);
    if (!raw) return;
    cache = core.consolidate(JSON.parse(raw), makeId);
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

// ─── persistence ──────────────────────────────────────────────────────────────

let inFlight: Promise<boolean> | null = null;
let queued = false;
type PersistState = 'idle' | 'saving' | 'error';
const persistListeners = new Set<(s: PersistState) => void>();

export function subscribePersistState(cb: (s: PersistState) => void): () => void {
  persistListeners.add(cb);
  return () => {
    persistListeners.delete(cb);
  };
}

function emitState(s: PersistState) {
  for (const cb of persistListeners) cb(s);
}

async function putCache(): Promise<boolean> {
  const res = await fetch(API_URL, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(cache),
  });
  return res.ok;
}

/** Fire-and-forget persist with single-slot coalescing. Used by auto-saves. */
function persist(): Promise<boolean> {
  writeMirror();
  if (inFlight) {
    queued = true;
    return inFlight;
  }
  emitState('saving');
  inFlight = (async () => {
    let ok = false;
    try {
      ok = await putCache();
      emitState(ok ? 'idle' : 'error');
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
    return ok;
  })();
  return inFlight;
}

/**
 * Awaitable, explicit save. Always pushes the latest cache and resolves to
 * whether the server accepted it — used by the Save dialog so the user gets
 * a real confirmation instead of fire-and-forget.
 */
export async function flushLibrary(): Promise<boolean> {
  writeMirror();
  emitState('saving');
  try {
    const ok = await putCache();
    emitState(ok ? 'idle' : 'error');
    return ok;
  } catch (err) {
    console.warn('Library flush failed', err);
    emitState('error');
    return false;
  }
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

/** Apply a new state, mirror+notify, and kick a fire-and-forget persist. */
function commit(next: LibraryState): void {
  cache = next;
  notifySubscribers();
  void persist();
}

// ─── id minting ─────────────────────────────────────────────────────────────

function makeId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

// ─── public API (component-facing) ─────────────────────────────────────────────

export function listByGroup(): GroupView[] {
  return core.listByGroup(cache);
}

export function getEntry(id: string): LibraryEntry | null {
  return core.findEntry(cache, id);
}

export function findByName(group: string, fileName: string): LibraryEntry | null {
  return core.findByName(cache, group, fileName);
}

/** Read-only snapshot of the whole library (used by the Save dialog). */
export function getLibraryState(): LibraryState {
  return cache;
}

export function createEmptyGroup(name: string): void {
  commit(core.createEmptyGroup(cache, name));
}

export function removeGroup(name: string): void {
  commit(core.removeGroup(cache, name));
}

export function renameGroup(oldName: string, newName: string): void {
  commit(core.renameGroup(cache, oldName, newName));
}

export function saveFile(opts: {
  group: string;
  fileName: string;
  mode: GeometryMode;
  xml: string;
  replaceId?: string;
}): LibraryEntry {
  const { state, entry } = core.saveFile(cache, opts, {
    id: makeId(),
    savedAt: Date.now(),
  });
  commit(state);
  return entry;
}

export function deleteEntry(id: string): void {
  commit(core.deleteEntry(cache, id));
}

export function updateEntry(id: string, patch: UpdatePatch): void {
  commit(core.updateEntry(cache, id, patch, { savedAt: Date.now() }));
}

/** Wipe the whole library and persist. Resolves to server-save success. */
export async function clearLibrary(): Promise<boolean> {
  cache = { ...core.EMPTY_STATE };
  notifySubscribers();
  return flushLibrary();
}
