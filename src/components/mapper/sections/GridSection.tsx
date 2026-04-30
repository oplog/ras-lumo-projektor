import { useLayoutStore } from '../../../lib/store';
import { Field, NumberInput, Section } from './Section';

export function GridSection() {
  const rowCount = useLayoutStore((s) => s.layout.rowCount);
  const columnsPerRow = useLayoutStore((s) => s.layout.columnsPerRow);
  const setRowCount = useLayoutStore((s) => s.setRowCount);
  const setColumnsForRow = useLayoutStore((s) => s.setColumnsForRow);
  const regenerateCells = useLayoutStore((s) => s.regenerateCells);
  const liveRegenerate = useLayoutStore((s) => s.liveRegenerate);
  const setLiveRegenerate = useLayoutStore((s) => s.setLiveRegenerate);

  const total = columnsPerRow.reduce((a, b) => a + b, 0);

  return (
    <Section title="Grid (Satır × Sütun)" hint="Satır + her satır için sütun sayısı; bilinear ile otomatik üretir">
      <Field label="Toplam Satır (RowCount)">
        <NumberInput
          min={1}
          max={50}
          value={rowCount}
          onChange={(e) => setRowCount(Number(e.target.value))}
        />
      </Field>

      <div>
        <div className="text-[11px] font-medium text-zinc-400 mb-1">
          Her satır için sütun sayısı
        </div>
        <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pr-1">
          {columnsPerRow.map((cols, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <span className="text-[10px] text-zinc-500 font-mono w-7">r{i}</span>
              <NumberInput
                min={1}
                max={50}
                value={cols}
                onChange={(e) => setColumnsForRow(i, Number(e.target.value))}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="text-[11px] text-zinc-500 font-mono">
        Toplam hücre: {total}
      </div>

      <label className="flex items-center gap-2 text-[11px] text-zinc-300">
        <input
          type="checkbox"
          checked={liveRegenerate}
          onChange={(e) => setLiveRegenerate(e.target.checked)}
        />
        Boundary sürüklerken hücreleri otomatik yenile
      </label>

      <button
        type="button"
        onClick={regenerateCells}
        className="w-full mt-1 px-3 py-2 rounded-md bg-amber-400 hover:bg-amber-300 text-zinc-900 text-xs font-semibold"
      >
        Bilinear ile yeniden üret (mevcut isimleri kaybeder)
      </button>
    </Section>
  );
}
