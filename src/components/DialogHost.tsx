import { useEffect, useState } from 'react';
import { type ActiveDialog, useDialogStore } from '../lib/dialog';
import { GhostButton, Modal, PrimaryButton } from './Modal';

/**
 * Renders the active confirm/prompt request from the dialog service. Mount
 * once at app root (next to ToastHost).
 */
export function DialogHost() {
  const active = useDialogStore((s) => s.active);
  const close = useDialogStore((s) => s._close);
  if (!active) return null;
  // key forces a fresh component (and fresh input state) per request.
  return <DialogView key={active.id} active={active} close={close} />;
}

function DialogView({ active, close }: { active: ActiveDialog; close: () => void }) {
  const [value, setValue] = useState(
    active.type === 'prompt' ? (active.options.defaultValue ?? '') : '',
  );

  // Resolve with a default (cancel) if the modal is dismissed without a choice.
  const dismiss = () => {
    if (active.type === 'confirm') active.resolve(false);
    else active.resolve(null);
    close();
  };

  const confirm = () => {
    if (active.type === 'confirm') {
      active.resolve(true);
    } else {
      const trimmed = value.trim();
      active.resolve(trimmed === '' ? null : trimmed);
    }
    close();
  };

  // Auto-focus the prompt field on open.
  // biome-ignore lint/correctness/useExhaustiveDependencies: run once on mount
  useEffect(() => {
    if (active.type === 'prompt') {
      const el = document.getElementById('dialog-prompt-input') as HTMLInputElement | null;
      el?.focus();
      el?.select();
    }
  }, []);

  const o = active.options;
  const footer = (
    <>
      <GhostButton onClick={dismiss}>{o.cancelText ?? 'Vazgeç'}</GhostButton>
      <PrimaryButton
        onClick={confirm}
        danger={active.type === 'confirm' && active.options.danger}
        disabled={active.type === 'prompt' && value.trim() === ''}
      >
        {o.confirmText ?? (active.type === 'confirm' ? 'Onayla' : 'Tamam')}
      </PrimaryButton>
    </>
  );

  return (
    <Modal title={o.title} onClose={dismiss} footer={footer}>
      {o.message && (
        <p className="text-[13px] text-zinc-300 leading-relaxed whitespace-pre-line mb-3">
          {o.message}
        </p>
      )}
      {active.type === 'prompt' && (
        <div>
          {active.options.label && (
            <label
              htmlFor="dialog-prompt-input"
              className="block text-[11px] font-medium text-zinc-400 mb-1"
            >
              {active.options.label}
            </label>
          )}
          <input
            id="dialog-prompt-input"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') confirm();
            }}
            placeholder={active.options.placeholder}
            className="w-full bg-zinc-950/80 border border-zinc-700/60 rounded-md px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-emerald-500/60"
          />
        </div>
      )}
    </Modal>
  );
}
