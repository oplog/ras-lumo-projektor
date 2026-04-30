import examplePodXml from './examples/example-pod.xml?raw';
import exampleRebinXml from './examples/example-rebin.xml?raw';
import exampleRebinPackSym025 from './examples/rebin-pack-sym025.xml?raw';
import examplePack4Xml from './examples/example-pack4.xml?raw';

/**
 * A persisted "library" of saved layouts. Entries live in localStorage and
 * carry their full XML text plus a tag indicating which geometry algorithm
 * (pod / rebin) they were produced with — so loading an entry can also
 * restore the matching mode toggle.
 *
 * On first run, two read-only example entries are seeded: one pod (8×2,
 * oblique projection) and one rebin (6×16, two adjacent units sharing a
 * boundary with the metal post in the middle).
 */

export interface LibraryEntry {
  name: string;
  mode: 'pod' | 'rebin';
  xml: string;
  savedAt: number;
  /** Read-only seeds shipped with the app — can't be deleted or overwritten. */
  isExample?: boolean;
}

const STORAGE_KEY = 'lumo-library-v1';

const SEEDS: LibraryEntry[] = [
  {
    name: 'Örnek — Pod (8×2)',
    mode: 'pod',
    xml: examplePodXml,
    savedAt: 0,
    isExample: true,
  },
  {
    name: 'Örnek — Rebin Ön (6×16)',
    mode: 'rebin',
    xml: exampleRebinXml,
    savedAt: 0,
    isExample: true,
  },
  {
    name: 'Örnek — Rebin Arka (6×16)',
    mode: 'rebin',
    xml: exampleRebinPackSym025,
    savedAt: 0,
    isExample: true,
  },
  {
    name: 'Örnek — Pack4 (4×10) [isim editle]',
    mode: 'pod',
    xml: examplePack4Xml,
    savedAt: 0,
    isExample: true,
  },
];

function readUserEntries(): LibraryEntry[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as LibraryEntry[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((e) => !e.isExample);
  } catch {
    return [];
  }
}

function writeUserEntries(entries: LibraryEntry[]): void {
  try {
    const userOnly = entries.filter((e) => !e.isExample);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(userOnly));
    notifySubscribers();
  } catch (err) {
    console.warn('Library save failed', err);
  }
}

const subscribers = new Set<() => void>();

/** Subscribe to library changes (save/delete). Returns unsubscribe fn. */
export function subscribeLibrary(cb: () => void): () => void {
  subscribers.add(cb);
  return () => {
    subscribers.delete(cb);
  };
}

function notifySubscribers(): void {
  for (const cb of subscribers) cb();
}

export function listLibrary(): LibraryEntry[] {
  // Examples first, then user entries newest-first.
  const user = readUserEntries().sort((a, b) => b.savedAt - a.savedAt);
  return [...SEEDS, ...user];
}

export function loadFromLibrary(name: string): LibraryEntry | null {
  return listLibrary().find((e) => e.name === name) ?? null;
}

export function saveToLibrary(name: string, mode: 'pod' | 'rebin', xml: string): void {
  if (!name.trim()) throw new Error('İsim boş olamaz');
  if (SEEDS.some((s) => s.name === name)) {
    throw new Error('Bu isim örnek için ayrılmış, başka bir isim seç');
  }
  const entries = readUserEntries().filter((e) => e.name !== name);
  entries.push({ name, mode, xml, savedAt: Date.now() });
  writeUserEntries(entries);
}

export function deleteFromLibrary(name: string): void {
  if (SEEDS.some((s) => s.name === name)) {
    throw new Error('Örnekler silinemez');
  }
  writeUserEntries(readUserEntries().filter((e) => e.name !== name));
}
