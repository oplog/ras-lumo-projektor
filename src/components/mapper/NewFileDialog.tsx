import { useState } from 'react';
import { makeEmptyLayout } from '../../lib/defaults';
import { type GeometryMode, findByName, flushLibrary, saveFile } from '../../lib/library';
import { useLayoutStore } from '../../lib/store';
import { toast } from '../../lib/toast';
import { serializeLayoutToXml } from '../../lib/xml';
import { GhostButton, Modal, PrimaryButton } from '../Modal';

/** Common grid presets shown as quick-pick chips (label shows total cells). */
const QUICK_GRIDS: { rows: number; cols: number }[] = [
  { rows: 3, cols: 3 },
  { rows: 6, cols: 8 },
  { rows: 4, cols: 12 },
  { rows: 6, cols: 16 },
];

function clampInt(v: string): number {
  const n = Math.floor(Number(v));
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(50, n);
}

/**
 * Create a brand-new layout file INSIDE a given folder (the folder is fixed —
 * library flow is always folder-first). Name the file, pick the grid size and
 * pod/rebin; a default grid is generated (cells auto-named), saved under the
 * folder, and loaded into the editor.
 */
export function NewFileDialog({
  defaultGroup,
  onClose,
}: {
  defaultGroup: string;
  onClose: () => void;
}) {
  const setLayout = useLayoutStore((s) => s.setLayout);
  const setMode = useLayoutStore((s) => s.setGeometryMode);
  const setCurrentEntryId = useLayoutStore((s) => s.setCurrentEntryId);

  const group = defaultGroup.trim();
  const [fileName, setFileName] = useState('');
  const [mode, setLocalMode] = useState<GeometryMode>('rebin');
  const [rows, setRows] = useState(6);
  const [cols, setCols] = useState(8);
  const [busy, setBusy] = useState(false);

  const totalCells = rows * cols;
  const trimmedFile = fileName.trim();
  const canSave = group !== '' && trimmedFile !== '';
  const willOverwrite = canSave && findByName(group, trimmedFile) !== null;

  const handleCreate = async () => {
    if (!canSave || busy) return;
    setBusy(true);
    try {
      const fresh = makeEmptyLayout({ rows, cols });
      fresh.stationName = trimmedFile;
      setLayout(fresh);
      setMode(mode);
      const xml = serializeLayoutToXml(fresh);
      const saved = saveFile({ group, fileName: trimmedFile, mode, xml });
      setCurrentEntryId(saved.id);
      const ok = await flushLibrary();
      if (ok) {
        toast.success(
          `"${trimmedFile}.xml" → 📁 ${group} (${mode}, ${totalCells} göz) oluşturuldu.`,
        );
        onClose();
      } else {
        toast.error('Oluşturuldu ama sunucuya yazılamadı — tekrar dene.');
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
      <PrimaryButton onClick={handleCreate} disabled={!canSave || busy}>
        {busy ? 'Oluşturuluyor…' : willOverwrite ? 'Üstüne Yaz' : 'Oluştur'}
      </PrimaryButton>
    </>
  );

  return (
    <Modal title="Yeni Dosya" onClose={onClose} footer={footer}>
      <div className="space-y-4">
        {/* Target folder — fixed (you clicked + Dosya inside this folder). */}
        <div>
          <div className="block text-[11px] font-medium text-zinc-300 mb-1">Klasör</div>
          <div className="px-3 py-2 rounded-md bg-zinc-950/60 border border-zinc-800/80 text-sm text-zinc-200">
            📁 {group}
          </div>
        </div>

        <div>
          <label htmlFor="new-file" className="block text-[11px] font-medium text-zinc-300 mb-1">
            Dosya adı
          </label>
          <div className="flex items-stretch rounded-md overflow-hidden border border-zinc-700/60 focus-within:border-emerald-500/60">
            <span className="px-2.5 py-2 text-xs font-mono bg-zinc-950/80 text-zinc-500 border-r border-zinc-700/60 select-none">
              projector-layout-
            </span>
            <input
              id="new-file"
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate();
              }}
              placeholder="ras5"
              // biome-ignore lint/a11y/noAutofocus: focus the file name on open
              autoFocus
              className="flex-1 min-w-0 bg-zinc-950/80 px-2.5 py-2 text-sm text-zinc-100 font-mono focus:outline-none"
            />
            <span className="px-2 py-2 text-xs font-mono bg-zinc-950/80 text-zinc-500 border-l border-zinc-700/60 select-none">
              .xml
            </span>
          </div>
        </div>

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
          <p className="text-[11px] text-zinc-500 leading-relaxed pt-2">
            {mode === 'pod'
              ? 'Tek yüzlü pod, çapraz projeksiyon.'
              : 'İki bitişik rebin, ortada direk.'}
          </p>
        </div>

        {/* Grid size — total cells = rows × cols */}
        <div>
          <div className="block text-[11px] font-medium text-zinc-300 mb-1">
            Göz sayısı (satır × sütun)
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={50}
              value={rows}
              onChange={(e) => setRows(clampInt(e.target.value))}
              aria-label="Satır"
              className="w-20 bg-zinc-950/80 border border-zinc-700/60 rounded-md px-2 py-2 text-sm text-zinc-100 font-mono text-center focus:outline-none focus:border-emerald-500/60"
            />
            <span className="text-zinc-500 text-sm">×</span>
            <input
              type="number"
              min={1}
              max={50}
              value={cols}
              onChange={(e) => setCols(clampInt(e.target.value))}
              aria-label="Sütun"
              className="w-20 bg-zinc-950/80 border border-zinc-700/60 rounded-md px-2 py-2 text-sm text-zinc-100 font-mono text-center focus:outline-none focus:border-emerald-500/60"
            />
            <span className="text-[11px] text-zinc-400 ml-1">
              = <span className="text-emerald-300 font-semibold tabular-nums">{totalCells}</span>{' '}
              göz
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5 pt-2">
            {QUICK_GRIDS.map((g) => (
              <button
                key={`${g.rows}x${g.cols}`}
                type="button"
                onClick={() => {
                  setRows(g.rows);
                  setCols(g.cols);
                }}
                className={`text-[10px] px-2 py-0.5 rounded border ${
                  rows === g.rows && cols === g.cols
                    ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-200'
                    : 'bg-zinc-800/40 border-zinc-700/60 text-zinc-400 hover:bg-zinc-800/60'
                }`}
              >
                {g.rows}×{g.cols} ({g.rows * g.cols})
              </button>
            ))}
          </div>
          <p className="text-[10px] text-zinc-500 leading-snug pt-1.5">
            Hücreler ve varsayılan adlar otomatik gelir; sonra ⨳ Toplu Gir ile gözleri
            isimlendirebilirsin.
          </p>
        </div>

        <div className="text-[11px] min-h-[16px]">
          {willOverwrite ? (
            <span className="text-amber-300/90">
              ⚠ 📁 {group} içinde "{trimmedFile}" zaten var, üstüne yazılacak.
            </span>
          ) : canSave ? (
            <span className="text-emerald-400/80">📁 {group} altına oluşturulacak.</span>
          ) : (
            <span className="text-zinc-500">Dosya adı gir.</span>
          )}
        </div>
      </div>
    </Modal>
  );
}
