import { create } from 'zustand';

export type ToastKind = 'success' | 'error' | 'info';

export interface Toast {
  id: string;
  kind: ToastKind;
  text: string;
}

interface ToastStore {
  toasts: Toast[];
  show: (kind: ToastKind, text: string) => void;
  dismiss: (id: string) => void;
}

const TIMEOUT_MS = 3000;

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  show: (kind, text) => {
    const id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `t-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    set((s) => ({ toasts: [...s.toasts, { id, kind, text }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, TIMEOUT_MS);
  },
  dismiss: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/** Imperative shorthand — usable from any handler without `useToastStore()`. */
export const toast = {
  success: (text: string) => useToastStore.getState().show('success', text),
  error: (text: string) => useToastStore.getState().show('error', text),
  info: (text: string) => useToastStore.getState().show('info', text),
};
