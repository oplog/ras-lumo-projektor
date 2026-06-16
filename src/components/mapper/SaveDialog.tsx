import { useEffect, useId, useMemo, useState } from 'react';
import { downloadFile, safeFileName } from '../../lib/download';
import {
  type GeometryMode,
  findByName,
  flushLibrary,
  getEntry,
  listByGroup,
  saveFile,
} from '../../lib/library';
import { useLayoutStore } from '../../lib/store';
import { toast } from '../../lib/toast';
import { serializeLayoutToXml } from '../../lib/xml';

const LAST_GROUP_KEY = 'lumo-last-group';

/**
 * Explicit "save to library" flow that replaces the old `window.prompt`
 * chains. The user picks the station (group), file name, and geometry mode
 * (pod/rebin), sees whether it will overwrite, and gets a real confirmation
 * once R2 accepts the write.
 *
 * Semantics: upsert by (group, fileName). Re-saving the same target
 * overwrites in place; a different name saves a new file ("save as"). Either
 * way the saved row becomes the active entry.
 */
export function SaveDialog({ onClose }: { onClose: () => void }) {
  const layout = useLayoutStore((s) => s.layout);
  const geometryMode = useLayoutStore((s) => s.geometryMode);
  const setMode = useLayoutStore((s) => s.setGeometryMode);
  const setCurrentEntryId = useLayoutStore((s) => s.setCurrentEntryId);
  const setStationName = useLayoutStore((s) => s.setStationName);
  const currentEntryId = useLayoutStore((s) => s.currentEntryId);

  const active = currentEntryId ? getEntry(currentEntryId) : null;
  const lastGroup =
    (typeof window !== 'undefined' && window.localStorage.getItem(LAST_GROUP_KEY)) || '';

  const [group, setGroup] = useState(active?.group ?? lastGroup);
  const [fileName, setFileName] = useState(active?.fileName ?? layout.stationName ?? '');
  const [mode, setLocalMode] = useState<GeometryMode>(active?.mode ?? geometryMode);
  const [alsoDownload, setAlsoDownload] = useState(false);
  const [busy, setBusy] = useState(false);

  const groupListId = useId();
  const existingGroups = useMemo(() => listByGroup().map((g) => g.group), []);

  const trimmedGroup = group.trim();
  const trimmedFile = fileName.trim();
  const canSave = trimmedGroup !== '' && trimmedFile !== '' && layout.cells.length > 0;

  // Will this overwrite an existing file? (Same target, different id than active.)
  const collision = canSave ? findByName(trimmedGroup, trimmedFile) : null;
  const willOverwrite = collision !== null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleSave = async () => {
    if (!canSave || busy) return;
    setBusy(true);
    try {
      // Mirror the chosen file name + mode into the live layout so the
      // toolbar badge, download name, and future edits stay consistent.
      setStationName(trimmedFile);
      setMode(mode);
      const xml = serializeLayoutToXml({
        ...useLayoutStore.getState().layout,
        stationName: trimmedFile,
        lastModified: new Date().toISOString(),
      });
      const saved = saveFile({ group: trimmedGroup, fileName: trimmedFile, mode, xml });
      setCurrentEntryId(saved.id);
      window.localStorage.setItem(LAST_GROUP_KEY, trimmedGroup);

      if (alsoDownload) {
        downloadFile(`projector-layout-${safeFileName(trimmedFile)}.xml`, xml);
      }

      const ok = await flushLibrary();
      if (ok) {
        toast.success(
          `"${trimmedFile}.xml" → ${trimmedGroup} (${mode}) ${willOverwrite ? 'güncellendi' : 'kaydedildi'}.`,
        );
        onClose();
      } else {
        toast.error('Sunucuya kaydedilemedi — yerel kopya tutuldu, tekrar dene.');
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-[440px] max-w-[92vw] rounded-xl border border-zinc-700/70 bg-zinc-900 shadow-2xl shadow-black/50">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-800">
          <h2 className="text-sm font-semibold text-zinc-100">Kütüphaneye Kaydet</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-200 text-lg leading-none"
            aria-label="Kapat"
          >
            ×
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Station / group */}
          <div>
            <label
              htmlFor="save-group"
              className="block text-[11px] font-medium text-zinc-300 mb-1"
            >
              İstasyon
            </label>
            <input
              id="save-group"
              list={groupListId}
              value={group}
              onChange={(e) => setGroup(e.target.value)}
              placeholder="örn. ras-paketleme-1"
              // biome-ignore lint/a11y/noAutofocus: focus the first field on open
              autoFocus
              className="w-full bg-zinc-950/80 border border-zinc-700/60 rounded-md px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-emerald-500/60"
            />
            <datalist id={groupListId}>
              {existingGroups.map((g) => (
                <option key={g} value={g} />
              ))}
            </datalist>
          </div>

          {/* File name */}
          <div>
            <label htmlFor="save-file" className="block text-[11px] font-medium text-zinc-300 mb-1">
              Dosya adı
            </label>
            <div className="flex items-stretch rounded-md overflow-hidden border border-zinc-700/60 focus-within:border-emerald-500/60">
              <span className="px-2.5 py-2 text-xs font-mono bg-zinc-950/80 text-zinc-500 border-r border-zinc-700/60 select-none">
                projector-layout-
              </span>
              <input
                id="save-file"
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSave();
                }}
                placeholder="ras5"
                className="flex-1 min-w-0 bg-zinc-950/80 px-2.5 py-2 text-sm text-zinc-100 font-mono focus:outline-none"
              />
              <span className="px-2 py-2 text-xs font-mono bg-zinc-950/80 text-zinc-500 border-l border-zinc-700/60 select-none">
                .xml
              </span>
            </div>
          </div>

          {/* Mode toggle */}
          <div>
            <div className="block text-[11px] font-medium text-zinc-300 mb-1">Geometri Tipi</div>
            <div className="grid grid-cols-2 gap-2">
              {(['pod', 'rebin'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setLocalMode(m)}
                  className={`px-3 py-2 text-sm font-medium rounded-md border transition capitalize ${
                    mode === m
                      ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-200'
                      : 'bg-zinc-800/40 border-zinc-700/60 text-zinc-400 hover:bg-zinc-800/60'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Overwrite / status hint */}
          <div className="text-[11px] min-h-[16px]">
            {layout.cells.length === 0 ? (
              <span className="text-amber-300/80">Önce bir XML aç — kaydedilecek hücre yok.</span>
            ) : willOverwrite ? (
              <span className="text-amber-300/90">⚠ Bu dosya zaten var, üstüne yazılacak.</span>
            ) : trimmedGroup && trimmedFile ? (
              <span className="text-emerald-400/80">Yeni dosya olarak kaydedilecek.</span>
            ) : (
              <span className="text-zinc-500">İstasyon ve dosya adı gir.</span>
            )}
          </div>

          <label className="flex items-center gap-2 text-[11px] text-zinc-400 select-none cursor-pointer">
            <input
              type="checkbox"
              checked={alsoDownload}
              onChange={(e) => setAlsoDownload(e.target.checked)}
              className="accent-emerald-500"
            />
            Diske de indir (RAS klasörüne koymak için)
          </label>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-zinc-800">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/60 text-zinc-200"
          >
            Vazgeç
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave || busy}
            className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-emerald-400 hover:bg-emerald-300 text-zinc-900 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {busy ? 'Kaydediliyor…' : willOverwrite ? 'Üstüne Yaz' : 'Kaydet'}
          </button>
        </div>
      </div>
    </div>
  );
}
