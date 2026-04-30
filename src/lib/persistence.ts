import { useLayoutStore } from './store';
import type { Layout } from './types';

/**
 * Lightweight localStorage persistence for the in-progress layout.
 * Saves on every change (debounced); restores on page load.
 *
 * This is a draft-saving mechanism — the canonical "save" is still XML
 * download. localStorage keeps the user from losing work on a refresh or
 * accidental tab close.
 */

const STORAGE_KEY = 'lumo-layout-draft-v1';
const DEBOUNCE_MS = 400;

export function loadDraft(): Layout | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Layout;
    if (!parsed || typeof parsed !== 'object') return null;
    if (!Array.isArray(parsed.cells) || !Array.isArray(parsed.boundaryCorners)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearDraft(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore quota / privacy mode
  }
}

let lastSavedAt: number | null = null;
const subscribers = new Set<(t: number | null) => void>();

export function subscribeLastSavedAt(cb: (t: number | null) => void): () => void {
  subscribers.add(cb);
  cb(lastSavedAt);
  return () => {
    subscribers.delete(cb);
  };
}

function notify(t: number | null) {
  lastSavedAt = t;
  for (const s of subscribers) s(t);
}

/**
 * Subscribe the running store to localStorage. Call once at app startup.
 * Returns an unsubscribe function.
 */
export function startAutoSave(): () => void {
  let timer: number | null = null;
  let lastLayout: Layout | null = null;

  const unsub = useLayoutStore.subscribe((state) => {
    if (state.layout === lastLayout) return;
    lastLayout = state.layout;
    if (timer !== null) window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state.layout));
        notify(Date.now());
      } catch (err) {
        console.warn('Auto-save failed', err);
      }
    }, DEBOUNCE_MS);
  });

  return () => {
    if (timer !== null) window.clearTimeout(timer);
    unsub();
  };
}
