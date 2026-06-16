import { create } from 'zustand';

/**
 * Imperative dialog service — the modal counterpart to `toast`.
 *
 * Replaces `window.confirm` / `window.prompt` with awaitable, fully-styled
 * modals:
 *   const ok = await dialog.confirm({ title: 'Sil?', danger: true });
 *   const name = await dialog.prompt({ title: 'Yeni ad', defaultValue: cur });
 *
 * Only one dialog is shown at a time; opening a new one replaces the current.
 * `<DialogHost/>` (mounted once at app root) renders the active request.
 */

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}

export interface PromptOptions {
  title: string;
  message?: string;
  label?: string;
  defaultValue?: string;
  placeholder?: string;
  confirmText?: string;
  cancelText?: string;
}

export type ActiveDialog =
  | {
      id: string;
      type: 'confirm';
      options: ConfirmOptions;
      resolve: (v: boolean) => void;
    }
  | {
      id: string;
      type: 'prompt';
      options: PromptOptions;
      resolve: (v: string | null) => void;
    };

interface DialogStore {
  active: ActiveDialog | null;
  _open: (d: ActiveDialog) => void;
  _close: () => void;
}

export const useDialogStore = create<DialogStore>((set) => ({
  active: null,
  _open: (d) => set({ active: d }),
  _close: () => set({ active: null }),
}));

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `dlg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

export const dialog = {
  confirm(options: ConfirmOptions): Promise<boolean> {
    return new Promise((resolve) => {
      useDialogStore.getState()._open({ id: newId(), type: 'confirm', options, resolve });
    });
  },
  prompt(options: PromptOptions): Promise<string | null> {
    return new Promise((resolve) => {
      useDialogStore.getState()._open({ id: newId(), type: 'prompt', options, resolve });
    });
  },
};
