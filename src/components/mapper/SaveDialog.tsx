import { useId, useMemo, useState } from 'react';
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
import { GhostButton, Modal, PrimaryButton } from '../Modal';

const LAST_GROUP_KEY = 'lumo-last-group';

/**
 * Save the current layout into the library, which is organised as folders:
 *   📁 klasör (istasyon, e.g. ras-paketleme-1)
 *      └─ projector-layout-<dosya>.xml
 *
 * Pick an existing folder (chips) or type a new one, name the file, choose
 * pod/rebin. Upsert by (folder, fileName): same target overwrites in place,
 * a new name saves a new file. The saved row becomes the active entry.
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

  const fileFieldId = useId();
  const existingGroups = useMemo(() => listByGroup().map((g) => g.group), []);

  const trimmedGroup = group.trim();
  const trimmedFile = fileName.trim();
  const canSave = trimmedGroup !== '' && trimmedFile !== '' && layout.cells.length > 0;
  const willOverwrite = canSave && findByName(trimmedGroup, trimmedFile) !== null;

  const handleSave = async () => {
    if (!canSave || busy) return;
    setBusy(true);
    try {
      // Mirror the chosen file name + mode into the live layout so the toolbar
      // badge, download name, and future edits stay consistent.
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
          `"${trimmedFile}.xml" → 📁 ${trimmedGroup} (${mode}) ${willOverwrite ? 'güncellendi' : 'kaydedildi'}.`,
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

  const footer = (
    <>
      <GhostButton onClick={onClose}>Vazgeç</GhostButton>
      <PrimaryButton onClick={handleSave} disabled={!canSave || busy}>
        {busy ? 'Kaydediliyor…' : willOverwrite ? 'Üstüne Yaz' : 'Kaydet'}
      </PrimaryButton>
    </>
  );

  return (
    <Modal title="Kütüphaneye Kaydet" onClose={onClose} footer={footer} width={460}>
      <div className="space-y-4">
        {/* Folder (station) — pick existing or create new */}
        <div>
          <div className="block text-[11px] font-medium text-zinc-300 mb-1.5">
            Klasör (istasyon)
          </div>
          {existingGroups.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {existingGroups.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGroup(g)}
                  className={`text-[11px] px-2 py-1 rounded-md border transition ${
                    trimmedGroup === g
                      ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-200'
                      : 'bg-zinc-800/40 border-zinc-700/60 text-zinc-300 hover:bg-zinc-800/60'
                  }`}
                >
                  📁 {g}
                </button>
              ))}
            </div>
          )}
          <input
            value={group}
            onChange={(e) => setGroup(e.target.value)}
            placeholder={
              existingGroups.length > 0
                ? 'ya da yeni klasör adı (örn. ras-paketleme-1)'
                : 'klasör adı (örn. ras-paketleme-1)'
            }
            // biome-ignore lint/a11y/noAutofocus: focus the first field on open
            autoFocus
            className="w-full bg-zinc-950/80 border border-zinc-700/60 rounded-md px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-emerald-500/60"
          />
        </div>

        {/* File name */}
        <div>
          <label htmlFor={fileFieldId} className="block text-[11px] font-medium text-zinc-300 mb-1">
            Dosya adı
          </label>
          <div className="flex items-stretch rounded-md overflow-hidden border border-zinc-700/60 focus-within:border-emerald-500/60">
            <span className="px-2.5 py-2 text-xs font-mono bg-zinc-950/80 text-zinc-500 border-r border-zinc-700/60 select-none">
              projector-layout-
            </span>
            <input
              id={fileFieldId}
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

        {/* Status hint */}
        <div className="text-[11px] min-h-[16px]">
          {layout.cells.length === 0 ? (
            <span className="text-amber-300/80">Önce bir XML yükle — kaydedilecek hücre yok.</span>
          ) : willOverwrite ? (
            <span className="text-amber-300/90">
              ⚠ 📁 {trimmedGroup} içinde "{trimmedFile}" zaten var, üstüne yazılacak.
            </span>
          ) : trimmedGroup && trimmedFile ? (
            <span className="text-emerald-400/80">
              📁 {trimmedGroup} altına yeni dosya olarak kaydedilecek.
            </span>
          ) : (
            <span className="text-zinc-500">Klasör ve dosya adı gir.</span>
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
    </Modal>
  );
}
