import { useState } from 'react';

export function Section({
  title,
  hint,
  defaultOpen = true,
  children,
}: {
  title: string;
  hint?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 px-3.5 py-2.5 text-left hover:bg-zinc-800/40 transition-colors"
      >
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
            {title}
          </div>
          {hint && <div className="text-[10px] text-zinc-500 mt-0.5">{hint}</div>}
        </div>
        <span className={`text-zinc-500 text-xs transition-transform ${open ? 'rotate-90' : ''}`}>
          ▶
        </span>
      </button>
      {open && <div className="px-3.5 pb-3.5 pt-1 space-y-2.5">{children}</div>}
    </section>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="text-[11px] font-medium text-zinc-400 mb-1">{label}</div>
      {children}
    </label>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { onFocus, className, ...rest } = props;
  return (
    <input
      {...rest}
      onFocus={(e) => {
        e.currentTarget.select();
        onFocus?.(e);
      }}
      className={`w-full bg-zinc-950/80 border border-zinc-700/60 rounded-md px-2.5 py-1.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-amber-400/60 ${className ?? ''}`}
    />
  );
}

export function NumberInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { onFocus, onWheel, className, ...rest } = props;
  return (
    <input
      type="number"
      {...rest}
      onFocus={(e) => {
        e.currentTarget.select();
        onFocus?.(e);
      }}
      onWheel={(e) => {
        // Prevent accidental scroll-wheel value changes when scrolling the sidebar.
        e.currentTarget.blur();
        onWheel?.(e);
      }}
      className={`w-full bg-zinc-950/80 border border-zinc-700/60 rounded-md px-2.5 py-1.5 text-sm text-zinc-100 font-mono focus:outline-none focus:border-amber-400/60 ${className ?? ''}`}
    />
  );
}
