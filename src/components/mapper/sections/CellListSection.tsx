import { useLayoutStore } from '../../../lib/store';
import { Section, TextInput } from './Section';

export function CellListSection() {
  const cells = useLayoutStore((s) => s.layout.cells);
  const selected = useLayoutStore((s) => s.selectedCellIndex);
  const select = useLayoutStore((s) => s.selectCell);
  const setName = useLayoutStore((s) => s.setCellName);

  return (
    <Section title={`Hücreler (${cells.length})`} hint="İsimlendirme + canvas'tan seçim" defaultOpen={false}>
      <div className="space-y-1 max-h-80 overflow-y-auto pr-1">
        {cells.map((cell, i) => {
          const isSelected = i === selected;
          return (
            <div
              key={i}
              className={`flex items-center gap-1.5 rounded-md border px-1.5 py-1 ${
                isSelected
                  ? 'bg-amber-400/10 border-amber-400/30'
                  : 'bg-zinc-900/40 border-zinc-800/60 hover:border-zinc-700/80'
              }`}
            >
              <button
                type="button"
                onClick={() => select(isSelected ? null : i)}
                className="text-[10px] font-mono text-zinc-500 w-12 text-left hover:text-zinc-300"
              >
                r{cell.rowIndex}c{cell.columnIndex}
              </button>
              <TextInput
                value={cell.name}
                onChange={(e) => setName(i, e.target.value)}
                className="!py-1 !text-xs"
              />
            </div>
          );
        })}
      </div>
    </Section>
  );
}
