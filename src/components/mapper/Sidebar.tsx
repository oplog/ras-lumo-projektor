import { useEffect, useMemo, useRef, useState } from 'react';
import { inferGeometryMode } from '../../lib/defaults';
import { dialog } from '../../lib/dialog';
import {
  type LibraryEntry,
  clearLibrary,
  deleteEntry,
  getEntry,
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
import { CellNamesDialog } from './CellNamesDialog';
import { NewFileDialog } from './NewFileDialog';

const WIDTH_KEY = 'lumo-sidebar-width';
const MIN_W = 360;
const MAX_W = 760;
const DEFAULT_W = 468;

export function Sidebar() {
  const mode = useLayoutStore((s) => s.geometryMode);
  const setMode = useLayoutStore((s) => s.setGeometryMode);
  const gapFactor = useLayoutStore((s) => s.rebinGapFactor);
  const setGapFactor = useLayoutStore((s) => s.setRebinGapFactor);
  const cellInset = useLayoutStore((s) => s.cellInset);
  const setCellInset = useLayoutStore((s) => s.setCellInset);
  const gridOffsetX = useLayoutStore((s) => s.gridOffsetX);
  const gridOffsetY = useLayoutStore((s) => s.gridOffsetY);
  const setGridOffset = useLayoutStore((s) => s.setGridOffset);
  const layout = useLayoutStore((s) => s.layout);
  const setLayout = useLayoutStore((s) => s.setLayout);
  const currentEntryId = useLayoutStore((s) => s.currentEntryId);
  const setCurrentEntryId = useLayoutStore((s) => s.setCurrentEntryId);
  const cells = layout.cells;
  const selected = useLayoutStore((s) => s.selectedCellIndex);
  const select = useLayoutStore((s) => s.selectCell);
  const setName = useLayoutStore((s) => s.setCellName);

  const [libVersion, setLibVersion] = useState(0);
  useEffect(() => subscribeLibrary(() => setLibVersion((v) => v + 1)), []);
  // biome-ignore lint/correctness/useExhaustiveDependencies: libVersion is a manual invalidation tick for the module-level library cache
  const groups = useMemo(() => listByGroup(), [libVersion]);
  const fileCount = useMemo(() => groups.reduce((n, g) => n + g.entries.length, 0), [groups]);

  // ─── resizable width ────────────────────────────────────────────────────
  const [width, setWidth] = useState(() => {
    const saved = Number(window.localStorage.getItem(WIDTH_KEY));
    return saved >= MIN_W && saved <= MAX_W ? saved : DEFAULT_W;
  });
  useEffect(() => {
    window.localStorage.setItem(WIDTH_KEY, String(width));
  }, [width]);
  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = width;
    const onMove = (ev: MouseEvent) => {
      setWidth(Math.min(MAX_W, Math.max(MIN_W, startW + (ev.clientX - startX))));
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  // Accordion open/close state per group; new groups open by default.
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const isOpen = (g: string) => openGroups[g] ?? true;
  const toggleGroup = (g: string) => setOpenGroups((s) => ({ ...s, [g]: !(s[g] ?? true) }));

  // New-file dialog (asks name + station + pod/rebin).
  const [newFileGroup, setNewFileGroup] = useState<string | null>(null);
  const openNewFile = (group = '') => setNewFileGroup(group);
  // Bulk cell-name dialog (paste/template).
  const [showBulkNames, setShowBulkNames] = useState(false);

  const handleLoadEntry = (entry: LibraryEntry) => {
    try {
      const parsed = parseLayoutFromXml(entry.xml);
      setLayout(parsed);
      setMode(entry.mode);
      setCurrentEntryId(entry.id);
      toast.info(`"${entry.fileName}.xml" yüklendi.`);
    } catch (err) {
      toast.error(`Yüklenemedi: ${(err as Error).message}`);
    }
  };

  const handleClearLibrary = async () => {
    const ok = await dialog.confirm({
      title: 'Kütüphaneyi temizle',
      message: `${fileCount} dosya · ${groups.length} istasyon kalıcı olarak silinecek. Emin misin?`,
      confirmText: 'Hepsini Sil',
      danger: true,
    });
    if (!ok) return;
    const saved = await clearLibrary();
    setCurrentEntryId(null);
    toast[saved ? 'success' : 'error'](
      saved ? 'Kütüphane temizlendi.' : 'Temizlendi ama sunucuya yazılamadı.',
    );
  };

  const handleRenameGroup = async (oldName: string) => {
    const next = await dialog.prompt({
      title: 'İstasyonu yeniden adlandır',
      label: 'Yeni istasyon adı',
      defaultValue: oldName,
    });
    if (!next || next === oldName) return;
    try {
      renameGroup(oldName, next);
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const handleDeleteGroup = async (name: string, count: number) => {
    const ok = await dialog.confirm({
      title: 'İstasyonu sil',
      message:
        count > 0
          ? `"${name}" istasyonu ve içindeki ${count} dosya silinecek. Emin misin?`
          : `Boş "${name}" istasyonu silinsin mi?`,
      confirmText: 'Sil',
      danger: true,
    });
    if (!ok) return;
    try {
      const activeInGroup = groups
        .find((g) => g.group === name)
        ?.entries.some((e) => e.id === currentEntryId);
      removeGroup(name);
      if (activeInGroup) setCurrentEntryId(null);
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const handleRenameFile = async (entry: LibraryEntry) => {
    const next = await dialog.prompt({
      title: 'Dosya adını değiştir',
      label: 'Dosya adı (uzantı olmadan)',
      defaultValue: entry.fileName,
    });
    if (!next || next === entry.fileName) return;
    try {
      updateEntry(entry.id, { fileName: next });
      if (currentEntryId === entry.id) {
        useLayoutStore.getState().setStationName(next);
      }
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const handleMoveFile = async (entry: LibraryEntry) => {
    const target = await dialog.prompt({
      title: 'Başka istasyona taşı',
      label: `"${entry.fileName}.xml" hangi istasyona taşınsın?`,
      defaultValue: entry.group,
    });
    if (!target || target === entry.group) return;
    try {
      updateEntry(entry.id, { group: target });
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const handleDeleteEntry = async (entry: LibraryEntry) => {
    const ok = await dialog.confirm({
      title: 'Dosyayı sil',
      message: `"${entry.fileName}.xml" silinsin mi?`,
      confirmText: 'Sil',
      danger: true,
    });
    if (!ok) return;
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

  const handleGroupFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
      const fileMode = inferGeometryMode(parsed.metadata.surfaceType);
      setLayout(parsed);
      setMode(fileMode);
      const saved = saveFile({
        group: targetGroup,
        fileName,
        mode: fileMode,
        xml: serializeLayoutToXml(parsed),
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

  /**
   * Auto-save the active layout to its library row in place. Reads the LIVE
   * store state (not closure-captured values) so a name typed right before
   * blur is never dropped — this is the fix for "names disappear on save".
   * No-op unless a library row is loaded.
   */
  const saveCurrentToLibrary = () => {
    const st = useLayoutStore.getState();
    const id = st.currentEntryId;
    if (!id || st.layout.cells.length === 0) return;
    const existing = getEntry(id);
    if (!existing) return;
    try {
      saveFile({
        group: existing.group,
        fileName: existing.fileName,
        mode: st.geometryMode,
        xml: serializeLayoutToXml(st.layout),
        replaceId: existing.id,
      });
    } catch {
      /* best-effort auto-save */
    }
  };
  const saveAfterGap = () => {
    if (useLayoutStore.getState().geometryMode !== 'rebin') return;
    saveCurrentToLibrary();
  };
  const saveAfterInset = saveCurrentToLibrary;

  return (
    <div className="relative shrink-0 h-full" style={{ width }}>
      <aside className="h-full overflow-y-auto bg-zinc-900/30 border-r border-zinc-800/80">
        <div className="p-5 space-y-5">
          {!currentEntryId && (
            <div className="rounded-md border border-dashed border-zinc-800/80 bg-zinc-950/40 px-3 py-5 text-center">
              <div className="text-zinc-500 text-2xl leading-none mb-1.5">⌗</div>
              <div className="text-[11px] text-zinc-500 leading-snug">
                Bir dosyada değilsin. Aşağıdan{' '}
                <span className="text-emerald-400/90">+ Yeni Dosya</span> oluştur ya da bir kayda
                tıkla — düzenleme ayarları ancak o zaman gelir.
              </div>
            </div>
          )}

          {/* Editing controls only matter inside a file — everything here writes
              to the active library entry. */}
          {currentEntryId && (
            <>
              {/* Display picker — XML's <ScreenConfiguration DeviceName=...> */}
              <DisplayPicker onCommit={saveCurrentToLibrary} />

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

                {/* Cell inset — shrinks each cell toward its centre */}
                <div className="mt-3 rounded-md border border-zinc-800/80 bg-zinc-950/40 px-2.5 py-2">
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="cell-inset" className="text-[11px] font-medium text-zinc-300">
                      Hücre Sıkılığı
                    </label>
                    <span className="text-[11px] font-mono text-amber-300 tabular-nums">
                      {(cellInset * 100).toFixed(0)}%
                    </span>
                  </div>
                  <input
                    id="cell-inset"
                    type="range"
                    min="0"
                    max="0.4"
                    step="0.01"
                    value={cellInset}
                    onChange={(e) => setCellInset(Number(e.target.value))}
                    onMouseUp={saveAfterInset}
                    onTouchEnd={saveAfterInset}
                    onKeyUp={saveAfterInset}
                    className="w-full accent-amber-400"
                  />
                  <p className="text-[10px] text-zinc-500 leading-snug mt-1">
                    Her hücreyi merkeze çeker (boşluk açar).
                  </p>
                </div>

                {/* Grid X/Y offset — nudge whole grid to align projector with bins */}
                <div className="mt-3 rounded-md border border-zinc-800/80 bg-zinc-950/40 px-2.5 py-2 space-y-2">
                  <div className="text-[11px] font-medium text-zinc-300">
                    Grid Kaydırma
                    <span className="ml-1 text-[10px] text-zinc-500 font-normal">
                      (yandaki göze taşıyorsa)
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-0.5">
                      <label htmlFor="grid-offset-x" className="text-[10px] text-zinc-400">
                        Yatay
                      </label>
                      <span className="text-[10px] font-mono text-amber-300 tabular-nums">
                        {gridOffsetX > 0 ? '+' : ''}
                        {gridOffsetX} px
                      </span>
                    </div>
                    <input
                      id="grid-offset-x"
                      type="range"
                      min="-100"
                      max="100"
                      step="1"
                      value={gridOffsetX}
                      onChange={(e) => setGridOffset('x', Number(e.target.value))}
                      onMouseUp={saveAfterInset}
                      onTouchEnd={saveAfterInset}
                      onKeyUp={saveAfterInset}
                      className="w-full accent-amber-400"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-0.5">
                      <label htmlFor="grid-offset-y" className="text-[10px] text-zinc-400">
                        Dikey
                      </label>
                      <span className="text-[10px] font-mono text-amber-300 tabular-nums">
                        {gridOffsetY > 0 ? '+' : ''}
                        {gridOffsetY} px
                      </span>
                    </div>
                    <input
                      id="grid-offset-y"
                      type="range"
                      min="-100"
                      max="100"
                      step="1"
                      value={gridOffsetY}
                      onChange={(e) => setGridOffset('y', Number(e.target.value))}
                      onMouseUp={saveAfterInset}
                      onTouchEnd={saveAfterInset}
                      onKeyUp={saveAfterInset}
                      className="w-full accent-amber-400"
                    />
                  </div>
                  {(gridOffsetX !== 0 || gridOffsetY !== 0) && (
                    <button
                      type="button"
                      onClick={() => {
                        setGridOffset('x', 0);
                        setGridOffset('y', 0);
                        saveAfterInset();
                      }}
                      className="text-[10px] text-zinc-400 hover:text-zinc-200 underline"
                    >
                      Sıfırla
                    </button>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Library — groups (stations) holding files */}
          <div className="pt-4 border-t border-zinc-800/60">
            <div className="flex items-center justify-between mb-2 gap-2">
              <div className="text-xs font-semibold text-zinc-300">
                Kütüphane{' '}
                <span className="text-zinc-500 font-normal">
                  ({fileCount} dosya
                  {groups.length > 0 ? ` · ${groups.length} istasyon` : ''})
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {groups.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearLibrary}
                    title="Tüm kütüphaneyi temizle"
                    className="text-[11px] px-2 py-0.5 rounded bg-zinc-800 hover:bg-red-500/20 hover:text-red-300 text-zinc-400 border border-zinc-700/60"
                  >
                    Temizle
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => openNewFile()}
                  title="Yeni dosya oluştur (isim + pod/rebin)"
                  className="text-[11px] px-2 py-0.5 rounded bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-200 border border-emerald-500/40 font-medium"
                >
                  + Yeni Dosya
                </button>
              </div>
            </div>
            {groups.length === 0 ? (
              <div className="rounded-md border border-dashed border-zinc-800/80 bg-zinc-950/40 px-3 py-4 text-center">
                <div className="text-[11px] text-zinc-500 leading-snug">
                  Henüz kayıt yok.
                  <br />
                  <span className="text-emerald-400/90">+ Yeni Dosya</span> ile isim ve pod/rebin
                  seçip oluştur, ya da <span className="text-zinc-300">XML Aç</span> ile mevcut bir
                  dosyayı yükle.
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
                              Henüz dosya yok — <span className="text-emerald-400/80">+ XML</span>{' '}
                              ile ekle.
                            </div>
                          )}
                          {entries.map((entry) => (
                            <FileRow
                              key={entry.id}
                              entry={entry}
                              active={entry.id === currentEntryId}
                              onLoad={() => handleLoadEntry(entry)}
                              onRename={() => handleRenameFile(entry)}
                              onMove={() => handleMoveFile(entry)}
                              onDelete={() => handleDeleteEntry(entry)}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Cell name list — only inside a file */}
          {currentEntryId && (
            <div className="pt-4 border-t border-zinc-800/60">
              <div className="flex items-center justify-between mb-2 gap-2">
                <div className="text-xs font-semibold text-zinc-300">
                  Hücre Adları ({cells.length})
                </div>
                {cells.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowBulkNames(true)}
                    title="Tüm göz adlarını liste/şablon ile bir kerede gir"
                    className="text-[11px] px-2 py-0.5 rounded bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-200 border border-emerald-500/40 font-medium"
                  >
                    ⨳ Toplu Gir
                  </button>
                )}
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
                        key={`${cell.rowIndex}-${cell.columnIndex}-${i}`}
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
                          onBlur={saveCurrentToLibrary}
                          className="flex-1 min-w-0 bg-zinc-950/80 border border-zinc-700/60 rounded px-2 py-1 text-xs text-zinc-100 focus:outline-none focus:border-emerald-500/60"
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
        <input
          ref={groupFileInputRef}
          type="file"
          accept=".xml,application/xml,text/xml"
          className="hidden"
          onChange={handleGroupFileChange}
        />
      </aside>

      {/* Resize handle */}
      <button
        type="button"
        onMouseDown={startResize}
        aria-label="Paneli yeniden boyutlandır"
        title="Sürükle: paneli genişlet / daralt"
        className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize bg-transparent hover:bg-emerald-500/40 active:bg-emerald-500/60 transition-colors"
      />

      {newFileGroup !== null && (
        <NewFileDialog defaultGroup={newFileGroup} onClose={() => setNewFileGroup(null)} />
      )}
      {showBulkNames && (
        <CellNamesDialog onClose={() => setShowBulkNames(false)} onApplied={saveCurrentToLibrary} />
      )}
    </div>
  );
}

function FileRow({
  entry,
  active,
  onLoad,
  onRename,
  onMove,
  onDelete,
}: {
  entry: LibraryEntry;
  active: boolean;
  onLoad: () => void;
  onRename: () => void;
  onMove: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={`flex items-start gap-0.5 rounded border px-1.5 py-1 ${
        active
          ? 'bg-amber-400/10 border-amber-400/40'
          : 'bg-zinc-900/40 border-zinc-800/60 hover:border-zinc-700/80'
      }`}
    >
      <button
        type="button"
        onClick={onLoad}
        title="Editöre yükle"
        className="flex-1 min-w-0 text-left"
      >
        <div className="text-[11px] text-zinc-200 flex items-start gap-1.5">
          {active && <span className="text-amber-400 text-[9px] shrink-0 mt-0.5">●</span>}
          <span className="font-mono break-all">
            <span className="text-zinc-500">projector-layout-</span>
            <span className="font-semibold">{entry.fileName}</span>
            <span className="text-zinc-500">.xml</span>
          </span>
        </div>
        <div className="text-[10px] text-zinc-500 font-mono flex items-center gap-1.5 mt-0.5">
          <span
            className={`px-1 py-px rounded text-[9px] font-semibold uppercase tracking-wide ${
              entry.mode === 'rebin'
                ? 'bg-sky-500/15 text-sky-300'
                : 'bg-violet-500/15 text-violet-300'
            }`}
          >
            {entry.mode}
          </span>
          <span>·</span>
          <span>{formatRelative(entry.savedAt)}</span>
        </div>
      </button>
      <button
        type="button"
        onClick={onRename}
        title="Dosya adını değiştir"
        className="px-1 text-zinc-500 hover:text-zinc-200 text-[11px]"
      >
        ✎
      </button>
      <button
        type="button"
        onClick={onMove}
        title="Başka istasyona taşı"
        className="px-1 text-zinc-500 hover:text-amber-300 text-[11px]"
      >
        ↗
      </button>
      <button
        type="button"
        onClick={onDelete}
        title="Sil"
        className="px-1 text-zinc-500 hover:text-red-300 text-[11px]"
      >
        ✕
      </button>
    </div>
  );
}

function extractFileName(filename: string): string {
  const base = filename.replace(/\.[^/.]+$/, '');
  const m = base.match(/^projector-layout-(.+)$/i);
  return (m ? m[1] : base).trim();
}

/**
 * Compact editor for `\\.\DISPLAYn`. Prefix stays read-only (RAS demands
 * the exact `\\.\DISPLAY` shape); only the trailing integer is editable.
 */
function DisplayPicker({ onCommit }: { onCommit: () => void }) {
  const deviceName = useLayoutStore((s) => s.layout.screen.deviceName);
  const updateScreen = useLayoutStore((s) => s.updateScreen);
  const { prefix, n } = splitDeviceName(deviceName);

  return (
    <div className="rounded-md border border-zinc-800/70 bg-zinc-900/40 px-2.5 py-2">
      <div className="flex items-center justify-between mb-1.5">
        <div className="text-[11px] font-medium text-zinc-300">Projeksiyon Ekranı</div>
        <span className="text-[9px] uppercase tracking-wider text-emerald-400/70 font-semibold">
          XML'e yazılır
        </span>
      </div>
      <div className="flex items-stretch rounded-md overflow-hidden border border-zinc-700/60 focus-within:border-amber-400/60">
        <span
          title="Bu kısım sabittir — RAS bu format'ı bekler"
          className="px-2 py-1.5 text-xs font-mono bg-zinc-950/80 text-zinc-500 border-r border-zinc-700/60 select-all"
        >
          {prefix}
        </span>
        <input
          type="number"
          min={1}
          max={99}
          value={n}
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => {
            const raw = Number(e.target.value);
            const next = Number.isFinite(raw) && raw >= 1 ? Math.min(99, Math.floor(raw)) : 1;
            updateScreen({ deviceName: `${prefix}${next}` });
          }}
          onBlur={onCommit}
          className="flex-1 bg-zinc-950/80 px-2.5 py-1.5 text-sm text-zinc-100 font-mono focus:outline-none w-16"
        />
      </div>
      <p className="text-[10px] text-zinc-500 leading-snug mt-1.5">
        Projeksiyon hangi monitöre bağlıysa o sayı. Yanlışsa görüntü başka ekrana düşer.
      </p>
    </div>
  );
}

function splitDeviceName(value: string): { prefix: string; n: number } {
  const m = value.match(/^(.*DISPLAY)(\d+)$/i);
  if (m) return { prefix: m[1], n: Number(m[2]) };
  return { prefix: '\\\\.\\DISPLAY', n: 1 };
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
