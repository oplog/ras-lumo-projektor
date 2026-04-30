import type { PatternKind } from '../types';

interface Props {
  value: PatternKind;
  onChange: (p: PatternKind) => void;
}

const OPTIONS: Array<{ key: PatternKind; label: string; hint: string }> = [
  { key: 'none', label: 'Kapalı', hint: 'Sadece düz renk' },
  { key: 'grid', label: 'Izgara', hint: '10×10 referans' },
  { key: 'crosshair', label: 'Artı', hint: 'Merkez çizgileri' },
  { key: 'corners', label: 'Köşeler', hint: 'L-marker' },
  { key: 'all', label: 'Hepsi', hint: 'Tam test deseni' },
];

export function PatternToggle({ value, onChange }: Props) {
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {OPTIONS.map((opt) => {
        const active = opt.key === value;
        return (
          <button
            key={opt.key}
            type="button"
            onClick={() => onChange(opt.key)}
            className={`text-left px-3 py-2 rounded-lg border transition-all ${
              active
                ? 'border-amber-300/60 bg-amber-400/10 text-amber-100'
                : 'border-zinc-700/60 bg-zinc-800/40 hover:bg-zinc-800/70 text-zinc-300'
            }`}
          >
            <div className="text-sm font-medium">{opt.label}</div>
            <div className="text-[11px] text-zinc-500 mt-0.5">{opt.hint}</div>
          </button>
        );
      })}
    </div>
  );
}
