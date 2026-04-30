import { useToastStore } from '../lib/toast';

/**
 * Top-right stack of dismissible notifications. Mount once at the app root.
 * Toasts are time-bound (3s) by the store; clicking on one dismisses early.
 */
export function ToastHost() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[200] flex flex-col gap-2 pointer-events-none w-[min(420px,calc(100vw-2rem))]">
      {toasts.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => dismiss(t.id)}
          className={`pointer-events-auto px-3.5 py-2.5 rounded-lg shadow-xl border text-xs font-medium text-left animate-[toastIn_180ms_ease-out] backdrop-blur ${
            t.kind === 'success'
              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-100'
              : t.kind === 'error'
                ? 'bg-red-500/15 border-red-500/40 text-red-100'
                : 'bg-zinc-800/90 border-zinc-700/60 text-zinc-100'
          }`}
        >
          <div className="flex items-start gap-2">
            <span className="text-[14px] leading-4 mt-px">
              {t.kind === 'success' ? '✓' : t.kind === 'error' ? '✕' : 'ℹ'}
            </span>
            <span className="leading-snug">{t.text}</span>
          </div>
        </button>
      ))}
    </div>
  );
}
