import { useEffect, useMemo, useRef, useState } from 'react';
import {
  createEmptyGroup,
  deleteEntry,
  type LibraryEntry,
  listByGroup,
  removeGroup,
  renameGroup,
  saveFile,
  subscribeLibrary,
  updateEntry,
} from '../../lib/library';
import { useLayoutStore } from '../../lib/store';
import { toast } from '../../lib/toast';
import { parseLayoutFromXml, serializeLayoutToXml } from '../../lib/xml';

export function Sidebar() {
  const mode = useLayoutStore((s) => s.geometryMode);
  const setMode = useLayoutStore((s) => s.setGeometryMode);
  const gapFactor = useLayoutStore((s) => s.rebinGapFactor);
  const setGapFactor = useLayoutStore((s) => s.setRebinGapFactor);
  const layout = useLayoutStore((s) => s.layout);
  const setLayout = useLayoutStore((s) => s.setLayout);
  const currentEntryId = useLayoutStore((s) => s.currentEntryId);
  const setCurrentEntryId = useLayoutStore((s) => s.setCurrentEntryId);
  const applyHomographyFix = useLayoutStore((s) => s.applyHomographyFix);
  const cells = layout.cells;
  const selected = useLayoutStore((s) => s.selectedCellIndex);
  const select = useLayoutStore((s) => s.selectCell);
  const setName = useLayoutStore((s) => s.setCellName);

  const [libVersion, setLibVersion] = useState(0);
  useEffect(() => subscribeLibrary(() => setLibVersion((v) => v + 1)), []);
  const groups = useMemo(() => listByGroup(), [libVersion]);

  // Accordion open/close state per group; new groups open by default.
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const isOpen = (g: string) => openGroups[g] ?? true;
  const toggleGroup = (g: string) =>
    setOpenGroups((s) => ({ ...s, [g]: !(s[g] ?? true) }));

  /** Load the entry into the editor and, if rebin, run Auto Fix immediately. */
  const handleLoadEntry = (entry: LibraryEntry) => {
    try {
      const parsed = parseLayoutFromXml(entry.xml);
      setLayout(parsed);
      setMode(entry.mode);
      setCurrentEntryId(entry.id);

      if (entry.mode === 'rebin' && parsed.boundaryCorners.length === 4) {
        // Defer one tick so the new layout is in the store before the fix runs.
        setTimeout(() => {
          applyHomographyFix();
          setTimeout(() => {
            const cur = useLayoutStore.getState().layout;
            const xml = serializeLayoutToXml(cur);
            saveFile({
              group: entry.group,
              fileName: entry.fileName,
              mode: entry.mode,
              xml,
              replaceId: entry.id,
            });
            toast.success(
              `"${entry.fileName}.xml" yüklendi ve düzeltildi.`,
            );
          }, 0);
        }, 0);
      } else {
        toast.info(`"${entry.fileName}.xml" yüklendi.`);
      }
    } catch (err) {
      toast.error(`Yüklenemedi: ${(err as Error).message}`);
    }
  };

  const handleNewGroup = () => {
    const name = window.prompt('Yeni istasyon adı (örn. ras-paketleme-1):', '');
    if (!name?.trim()) return;
    try {
      createEmptyGroup(name.trim());
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const handleRenameGroup = (oldName: string) => {
    const next = window.prompt(`"${oldName}" istasyonunu yeniden adlandır:`, oldName);
    if (!next?.trim() || next.trim() === oldName) return;
    try {
      renameGroup(oldName, next.trim());
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const handleDeleteGroup = (name: string, count: number) => {
    const msg =
      count > 0
        ? `"${name}" istasyonu ve içindeki ${count} dosya silinsin mi?`
        : `Boş "${name}" istasyonu silinsin mi?`;
    if (!window.confirm(msg)) return;
    try {
      removeGroup(name);
      if (currentEntryId) {
        // If the active row was inside this group, clear focus.
        const stillThere = groups
          .find((g) => g.group === name)
          ?.entries.some((e) => e.id === currentEntryId);
        if (stillThere) setCurrentEntryId(null);
      }
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const handleRenameFile = (entry: LibraryEntry) => {
    const next = window.prompt('Dosya adı (uzantı olmadan):', entry.fileName);
    if (!next?.trim() || next.trim() === entry.fileName) return;
    try {
      updateEntry(entry.id, { fileName: next.trim() });
      // If the renamed entry is the active one, mirror the new fileName
      // into the in-memory layout so toolbar badge / download follow.
      if (currentEntryId === entry.id) {
        useLayoutStore.getState().setStationName(next.trim());
      }
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const handleMoveFile = (entry: LibraryEntry) => {
    const target = window.prompt(
      `"${entry.fileName}.xml" hangi istasyona taşınsın?`,
      entry.group,
    );
    if (!target?.trim() || target.trim() === entry.group) return;
    try {
      updateEntry(entry.id, { group: target.trim() });
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const handleDeleteEntry = (entry: LibraryEntry) => {
    if (!window.confirm(`"${entry.fileName}.xml" silinsin mi?`)) return;
    try {
      deleteEntry(entry.id);
      if (currentEntryId === entry.id) setCurrentEntryId(null);
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  // Per-group file picker — adds a new file under that group.
  const groupFileInputRef = useRef<HTMLInputElement>(null);
  const targetGroupRef = useRef<string>('');

  const handleAddFileToGroup = (groupName: string) => {
    targetGroupRef.current = groupName;
    groupFileInputRef.current?.click();
  };

  const handleGroupFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    const targetGroup = targetGroupRef.current;
    if (!file || !targetGroup) {
      e.target.value = '';
      return;
    }
    try {
      const text = await file.text();
      const parsed = parseLayoutFromXml(text);
      const fileName = extractFileName(file.name) || parsed.stationName || 'untitled';
      parsed.stationName = fileName;
      setLayout(parsed);
      const normalizedXml = serializeLayoutToXml(parsed);
      const saved = saveFile({
        group: targetGroup,
        fileName,
        mode,
        xml: normalizedXml,
      });
      setCurrentEntryId(saved.id);
      toast.success(`"${fileName}.xml" → ${targetGroup} altına eklendi.`);
    } catch (err) {
      toast.error(`XML yüklenemedi: ${(err as Error).message}`);
    } finally {
      e.target.value = '';
      targetGroupRef.current = '';
    }
  };

  // Auto-save the current layout to its library row when the gap slider
  // is released. Replaces XML in place — no new row.
  const saveAfterGap = () => {
    if (mode !== 'rebin') return;
    if (layout.cells.length === 0) return;
    if (!currentEntryId) return;
    const existing = groups
      .flatMap((g) => g.entries)
      .find((e) => e.id === currentEntryId);
    if (!existing) return;
    try {
      saveFile({
        group: existing.group,
        fileName: existing.fileName,
        mode,
        xml: serializeLayoutToXml(layout),
        replaceId: existing.id,
      });
    } catch {
      /* best-effort */
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
          {mode === 'rebin' && (
            <div className="mt-3 rounded-md border border-zinc-800/80 bg-zinc-950/40 px-2.5 py-2">
              <div className="flex items-center justify-between mb-1">
                <label
                  htmlFor="rebin-gap-factor"
                  className="text-[11px] font-medium text-zinc-300"
                >
                  Rebin arası boşluk
                </label>
                <span className="text-[11px] font-mono text-amber-300 tabular-nums">
                  {gapFactor.toFixed(2)}×
                </span>
              </div>
              <input
                id="rebin-gap-factor"
                type="range"
                min="0"
                max="2"
                step="0.05"
                value={gapFactor}
                onChange={(e) => setGapFactor(Number(e.target.value))}
                onMouseUp={saveAfterGap}
                onTouchEnd={saveAfterGap}
                onKeyUp={saveAfterGap}
                className="w-full accent-amber-400"
              />
              <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono mt-0.5">
                <span>0 (yok)</span>
                <span>0.5 (default)</span>
                <span>2× hücre</span>
              </div>
            </div>
          )}
        </div>

        {/* Library — groups (stations) holding files */}
        <div className="pt-4 border-t border-zinc-800/60">
          <div className="flex items-center justify-between mb-2 gap-2">
            <div className="text-xs font-semibold text-zinc-300 truncate">
              Kütüphane{' '}
              <span className="text-zinc-500 font-normal">
                ({groups.reduce((n, g) => n + g.entries.length, 0)} dosya
                {groups.length > 0 ? ` · ${groups.length} istasyon` : ''})
              </span>
            </div>
            <button
              type="button"
              onClick={handleNewGroup}
              title="Boş istasyon oluştur"
              className="text-[11px] px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700/60"
            >
              + İstasyon
            </button>
          </div>
          {groups.length === 0 ? (
            <div className="rounded-md border border-dashed border-zinc-800/80 bg-zinc-950/40 px-3 py-4 text-center">
              <div className="text-[11px] text-zinc-500 leading-snug">
                Henüz kayıt yok.
                <br />
                <span className="text-zinc-300">+ İstasyon</span> ile bir grup aç,
                sonra <span className="text-emerald-400/80">+ XML</span> ile dosya at.
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              {groups.map(({ group, entries }) => {
                const open = isOpen(group);
                return (
                  <div
                    key={group}
                    className="rounded-md border border-zinc-800/70 bg-zinc-900/40 overflow-hidden"
                  >
                    <div className="flex items-center gap-0.5 px-1.5 py-1.5 hover:bg-zinc-800/40">
                      <button
                        type="button"
                        onClick={() => toggleGroup(group)}
                        className="flex-1 min-w-0 flex items-center gap-1.5 text-left px-1"
                      >
                        <span
                          className={`text-zinc-500 text-[10px] transition-transform ${
                            open ? 'rotate-90' : ''
                          }`}
                        >
                          ▶
                        </span>
                        <span className="text-xs font-medium text-zinc-200 truncate">
                          {group}
                        </span>
                        <span className="text-[10px] font-mono text-zinc-500 shrink-0">
                          {entries.length}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAddFileToGroup(group)}
                        title="Bu istasyona dosya ekle"
                        className="px-1.5 text-emerald-400/70 hover:text-emerald-300 text-[11px]"
                      >
                        + XML
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRenameGroup(group)}
                        title="İstasyonu yeniden adlandır"
                        className="px-1 text-zinc-600 hover:text-zinc-300 text-[11px]"
                      >
                        ✎
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteGroup(group, entries.length)}
                        title="İstasyonu sil"
                        className="px-1 text-zinc-600 hover:text-red-300 text-[11px]"
                      >
                        ✕
                      </button>
                    </div>
                    {open && (
                      <div className="border-t border-zinc-800/60 bg-zinc-950/30 px-1.5 py-1 space-y-1">
                        {entries.length === 0 && (
                          <div className="text-[10px] text-zinc-600 italic px-1.5 py-1">
                            Henüz dosya yok —{' '}
                            <span className="text-emerald-400/80">+ XML</span> ile ekle.
                          </div>
                        )}
                        {entries.map((entry) => {
                          const active = entry.id === currentEntryId;
                          return (
                            <div
                              key={entry.id}
                              className={`flex items-center gap-0.5 rounded border px-1.5 py-1 ${
                                active
                                  ? 'bg-amber-400/10 border-amber-400/40'
                                  : 'bg-zinc-900/40 border-zinc-800/60 hover:border-zinc-700/80'
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() => handleLoadEntry(entry)}
                                title="Editöre yükle (rebin'de otomatik düzeltir)"
                                className="flex-1 min-w-0 text-left"
                              >
                                <div className="text-[11px] text-zinc-200 truncate flex items-center gap-1.5">
                                  {active && (
                                    <span className="text-amber-400 text-[9px] shrink-0">●</span>
                                  )}
                                  <span className="font-mono">
                                    <span className="text-zinc-500">projector-layout-</span>
                                    <span className="font-semibold">{entry.fileName}</span>
                                    <span className="text-zinc-500">.xml</span>
                                  </span>
                                </div>
                                <div className="text-[10px] text-zinc-500 font-mono flex items-center gap-1.5">
                                  <span>{entry.mode}</span>
                                  <span>·</span>
                                  <span>{formatRelative(entry.savedAt)}</span>
                                </div>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRenameFile(entry)}
                                title="Dosya adını değiştir"
                                className="px-1 text-zinc-500 hover:text-zinc-200 text-[11px]"
                              >
                                ✎
                              </button>
                              <button
                                type="button"
                                onClick={() => handleMoveFile(entry)}
                                title="Başka istasyona taşı"
                                className="px-1 text-zinc-500 hover:text-amber-300 text-[11px]"
                              >
                                ↗
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteEntry(entry)}
                                title="Sil"
                                className="px-1 text-zinc-500 hover:text-red-300 text-[11px]"
                              >
                                ✕
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
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
      <input
        ref={groupFileInputRef}
        type="file"
        accept=".xml,application/xml,text/xml"
        className="hidden"
        onChange={handleGroupFileChange}
      />
    </aside>
  );
}

function extractFileName(filename: string): string {
  const base = filename.replace(/\.[^/.]+$/, '');
  const m = base.match(/^projector-layout-(.+)$/i);
  return (m ? m[1] : base).trim();
}

function formatRelative(ts: number): string {
  if (!ts) return '';
  const diffSec = (Date.now() - ts) / 1000;
  if (diffSec < 60) return 'şimdi';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} dk`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} sa`;
  if (diffSec < 7 * 86400) return `${Math.floor(diffSec / 86400)} g`;
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
}
