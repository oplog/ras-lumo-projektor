import { useEffect, useState } from 'react';
import {
  deleteFromLibrary,
  listLibrary,
  saveToLibrary,
  subscribeLibrary,
  type LibraryEntry,
} from '../../lib/library';
import { useLayoutStore } from '../../lib/store';
import { parseLayoutFromXml, serializeLayoutToXml } from '../../lib/xml';

export function Sidebar() {
  const mode = useLayoutStore((s) => s.geometryMode);
  const setMode = useLayoutStore((s) => s.setGeometryMode);
  const layout = useLayoutStore((s) => s.layout);
  const setLayout = useLayoutStore((s) => s.setLayout);
  const cells = layout.cells;
  const selected = useLayoutStore((s) => s.selectedCellIndex);
  const select = useLayoutStore((s) => s.selectCell);
  const setName = useLayoutStore((s) => s.setCellName);

  // Re-render trigger for library list (localStorage changes outside React).
  const [libVersion, setLibVersion] = useState(0);
  useEffect(
    () => subscribeLibrary(() => setLibVersion((v) => v + 1)),
    [],
  );
  const entries = listLibrary();

  const handleLoadEntry = (entry: LibraryEntry) => {
    try {
      const parsed = parseLayoutFromXml(entry.xml);
      setLayout(parsed);
      setMode(entry.mode);
    } catch (err) {
      alert(`Yüklenemedi: ${(err as Error).message}`);
    }
  };

  const handleSaveCurrent = () => {
    const fallback = layout.stationName || 'kayit';
    const name = window.prompt('Bu layout için isim:', fallback);
    if (!name?.trim()) return;
    try {
      const xml = serializeLayoutToXml(layout);
      saveToLibrary(name.trim(), mode, xml);
      setLibVersion((v) => v + 1);
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const handleDelete = (name: string) => {
    if (!window.confirm(`"${name}" silinsin mi?`)) return;
    try {
      deleteFromLibrary(name);
      setLibVersion((v) => v + 1);
    } catch (err) {
      alert((err as Error).message);
    }
  };

  return (
    <aside className="w-[300px] shrink-0 h-full overflow-y-auto bg-zinc-900/30 border-r border-zinc-800/80">
      <div className="p-5 space-y-5">
        {/* Geometry mode toggle */}
        <div>
          <div className="text-xs font-semibold text-zinc-300 mb-2">Geometri Tipi</div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setMode('pod')}
              className={`px-3 py-2.5 text-sm font-medium rounded-md border transition ${
                mode === 'pod'
                  ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-200'
                  : 'bg-zinc-800/40 border-zinc-700/60 text-zinc-400 hover:bg-zinc-800/60'
              }`}
            >
              Pod
            </button>
            <button
              type="button"
              onClick={() => setMode('rebin')}
              className={`px-3 py-2.5 text-sm font-medium rounded-md border transition ${
                mode === 'rebin'
                  ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-200'
                  : 'bg-zinc-800/40 border-zinc-700/60 text-zinc-400 hover:bg-zinc-800/60'
              }`}
            >
              Rebin
            </button>
          </div>
          <div className="text-[11px] text-zinc-500 leading-relaxed pt-2">
            {mode === 'pod'
              ? 'Tek yüzlü pod, çapraz projeksiyon. RAS sırası + uniform.'
              : 'İki bitişik rebin, ortada direk. Canonicalize + asym500.'}
          </div>
        </div>

        {/* Library */}
        <div className="pt-4 border-t border-zinc-800/60">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-semibold text-zinc-300">Kütüphane</div>
            <button
              type="button"
              onClick={handleSaveCurrent}
              className="text-[11px] px-2 py-0.5 rounded bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-200 border border-emerald-500/40"
            >
              + Kaydet
            </button>
          </div>
          <div key={libVersion} className="space-y-1">
            {entries.map((entry) => (
              <div
                key={entry.name}
                className={`flex items-center gap-1.5 rounded-md border px-2 py-1.5 ${
                  entry.isExample
                    ? 'bg-zinc-900/50 border-zinc-800/80'
                    : 'bg-zinc-900/30 border-zinc-800/60 hover:border-zinc-700/80'
                }`}
              >
                <button
                  type="button"
                  onClick={() => handleLoadEntry(entry)}
                  className="flex-1 min-w-0 text-left"
                >
                  <div className="text-xs text-zinc-200 truncate">{entry.name}</div>
                  <div className="text-[10px] text-zinc-500 font-mono">
                    {entry.mode}
                    {entry.isExample ? ' · örnek' : ''}
                  </div>
                </button>
                {!entry.isExample && (
                  <button
                    type="button"
                    onClick={() => handleDelete(entry.name)}
                    title="Sil"
                    className="px-1.5 rounded text-zinc-500 hover:text-red-300 hover:bg-red-500/10 text-xs"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Cell name list */}
        <div className="pt-4 border-t border-zinc-800/60">
          <div className="text-xs font-semibold text-zinc-300 mb-2">
            Hücre Adları ({cells.length})
          </div>
          {cells.length === 0 ? (
            <div className="text-[11px] text-zinc-600 italic">
              XML yükle, hücreler buraya gelecek.
            </div>
          ) : (
            <div className="space-y-1 max-h-[40vh] overflow-y-auto pr-1">
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
                      className="text-[10px] font-mono text-zinc-500 w-12 shrink-0 text-left hover:text-zinc-300"
                    >
                      r{cell.rowIndex}c{cell.columnIndex}
                    </button>
                    <input
                      type="text"
                      value={cell.name}
                      onChange={(e) => setName(i, e.target.value)}
                      className="flex-1 min-w-0 bg-zinc-950/80 border border-zinc-700/60 rounded px-2 py-1 text-xs text-zinc-100 focus:outline-none focus:border-emerald-500/60"
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
