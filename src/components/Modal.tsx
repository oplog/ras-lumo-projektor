import { type ReactNode, useEffect } from 'react';

/**
 * Shared modal shell: dark backdrop, centered panel, header with close, and a
 * footer slot. Esc and backdrop-click close it. Used by every dialog so they
 * all look and behave identically (no more `window.prompt`).
 */
export function Modal({
  title,
  onClose,
  children,
  footer,
  width = 440,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="max-w-[92vw] rounded-xl border border-zinc-700/70 bg-zinc-900 shadow-2xl shadow-black/50"
        style={{ width }}
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-800">
          <h2 className="text-sm font-semibold text-zinc-100">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-200 text-lg leading-none"
            aria-label="Kapat"
          >
            ×
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-zinc-800">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/** Primary (emerald) action button for modal footers. */
export function PrimaryButton({
  children,
  onClick,
  disabled,
  danger,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`px-4 py-1.5 text-xs font-semibold rounded-lg text-zinc-900 disabled:opacity-40 disabled:cursor-not-allowed ${
        danger ? 'bg-red-400 hover:bg-red-300' : 'bg-emerald-400 hover:bg-emerald-300'
      }`}
    >
      {children}
    </button>
  );
}

/** Secondary (neutral) action button for modal footers. */
export function GhostButton({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/60 text-zinc-200"
    >
      {children}
    </button>
  );
}
