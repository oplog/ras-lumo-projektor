import { useRef, useState } from 'react';
import { inferGeometryMode } from '../../lib/defaults';
import { dialog } from '../../lib/dialog';
import { downloadFile, safeFileName } from '../../lib/download';
import { getEntry, saveFile } from '../../lib/library';
import { useLayoutStore } from '../../lib/store';
import { toast } from '../../lib/toast';
import { hasErrors, validateLayout } from '../../lib/validation';
import { parseLayoutFromXml, serializeLayoutToXml } from '../../lib/xml';
import { SaveDialog } from './SaveDialog';
import { XmlViewerModal } from './XmlViewerModal';

const RAS_FOLDER = '%APPDATA%\\OPLOG\\RasStationComms\\Saved Projector Layouts\\';

export function Toolbar() {
  const layout = useLayoutStore((s) => s.layout);
  const setLayout = useLayoutStore((s) => s.setLayout);
  const setMode = useLayoutStore((s) => s.setGeometryMode);
  const setCurrentEntryId = useLayoutStore((s) => s.setCurrentEntryId);
  const applyHomographyFix = useLayoutStore((s) => s.applyHomographyFix);
  const applyValidationCount = useLayoutStore((s) => s.applyValidationCount);
  const validationCount = useLayoutStore((s) => s.validationCount);
  const currentEntryId = useLayoutStore((s) => s.currentEntryId);
  const mode = useLayoutStore((s) => s.geometryMode);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showViewer, setShowViewer] = useState(false);
  const [showSave, setShowSave] = useState(false);
  const [pathCopied, setPathCopied] = useState(false);

  const activeEntry = currentEntryId ? getEntry(currentEntryId) : null;

  const handleOpen = () => {
    fileInputRef.current?.click();
  };

  /** XML Aç = load into the editor only. Saving to the library is an explicit
   *  step via the Kaydet dialog, so opening a file never mutates the library. */
  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = parseLayoutFromXml(text);
      const fileNameFromSource = extractFileName(file.name);
      if (fileNameFromSource) parsed.stationName = fileNameFromSource;
      setLayout(parsed);
      setMode(inferGeometryMode(parsed.metadata.surfaceType));
      setCurrentEntryId(null); // not in the library until the user saves
      toast.info(`"${parsed.stationName}.xml" yüklendi. Kaydet ile kütüphaneye ekle.`);
    } catch (err) {
      toast.error(`XML yüklenemedi: ${(err as Error).message}`);
    } finally {
      e.target.value = '';
    }
  };

  const handleAutoFix = () => {
    if (mode !== 'rebin') {
      toast.info('Otomatik Düzelt sadece rebin modunda çalışır.');
      return;
    }
    if (layout.boundaryCorners.length !== 4) {
      toast.error('Önce bir XML aç ya da bir dosya yükle.');
      return;
    }
    applyHomographyFix();
    // Keep the loaded library row in sync with the corrected geometry.
    setTimeout(() => {
      const cur = useLayoutStore.getState().layout;
      const saved = syncActiveEntry(serializeLayoutToXml(cur));
      toast.success(
        saved
          ? `"${cur.stationName}.xml" düzeltildi ve kaydedildi.`
          : `"${cur.stationName}.xml" düzeltildi.`,
      );
    }, 0);
  };

  /** XML İndir = download to disk, and keep the active library row in sync. */
  const handleDownload = async () => {
    const fresh = useLayoutStore.getState().layout;
    let effectiveStationName = fresh.stationName.trim();

    if (!effectiveStationName) {
      const fallback = `untitled-${formatStamp(new Date())}`;
      const ok = await dialog.confirm({
        title: 'Dosya adı boş',
        message: `'${fallback}' olarak indirilsin mi?`,
        confirmText: 'İndir',
      });
      if (!ok) return;
      effectiveStationName = fallback;
    }

    const layoutToSave = {
      ...fresh,
      stationName: effectiveStationName,
      lastModified: new Date().toISOString(),
    };

    const issues = validateLayout(layoutToSave);
    applyValidationCount(issues.length);
    if (hasErrors(issues)) {
      const issueList = issues.map((i) => `• [${i.field}] ${i.message}`).join('\n');
      const proceed = await dialog.confirm({
        title: `${issues.length} doğrulama uyarısı`,
        message: `${issueList}\n\nYine de indirilsin mi? (Windows app dosyayı reddedebilir)`,
        confirmText: 'Yine de İndir',
        danger: true,
      });
      if (!proceed) return;
    }

    const xml = serializeLayoutToXml(layoutToSave);
    downloadFile(`projector-layout-${safeFileName(effectiveStationName)}.xml`, xml);
    syncActiveEntry(xml);
  };

  /**
   * If a library row is loaded, overwrite its XML in place so the library
   * copy always matches what was just downloaded/fixed. No-op (returns null)
   * when nothing is loaded — opening then downloading a fresh file won't
   * silently create library rows; that's what the Kaydet dialog is for.
   */
  function syncActiveEntry(xml: string) {
    const id = useLayoutStore.getState().currentEntryId;
    if (!id) return null;
    const existing = getEntry(id);
    if (!existing) return null;
    try {
      const fileName = useLayoutStore.getState().layout.stationName.trim() || existing.fileName;
      const saved = saveFile({
        group: existing.group,
        fileName,
        mode: useLayoutStore.getState().geometryMode,
        xml,
        replaceId: existing.id,
      });
      setCurrentEntryId(saved.id);
      return saved;
    } catch {
      return null;
    }
  }

  const copyRasPath = async () => {
    try {
      await navigator.clipboard.writeText(RAS_FOLDER);
      setPathCopied(true);
      setTimeout(() => setPathCopied(false), 1500);
    } catch {
      // Clipboard blocked; user can still select the text manually.
    }
  };

  return (
    <div className="border-b border-zinc-800/80 bg-zinc-900/40 backdrop-blur sticky top-0 z-10">
      {/* RAS path banner — copy-paste straight into Windows Explorer */}
      <div className="bg-zinc-950/70 border-b border-zinc-800/60 px-4 py-2 flex items-center justify-center gap-3 flex-wrap text-[11px]">
        <span className="text-zinc-400 font-medium">RAS dosya yolu:</span>
        <button
          type="button"
          onClick={copyRasPath}
          title="Tıklayınca panoya kopyalanır. Windows Explorer adres çubuğuna yapıştır."
          className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/60 transition-colors"
        >
          <code className="font-mono text-amber-300 select-all">{RAS_FOLDER}</code>
          <span
            className={`text-[10px] uppercase tracking-wider font-semibold ${
              pathCopied ? 'text-emerald-400' : 'text-zinc-500'
            }`}
          >
            {pathCopied ? '✓ kopyalandı' : '⧉ kopyala'}
          </span>
        </button>
        <span className="text-zinc-500 italic">
          XML Aç ile bu klasördeki dosyayı seçin · XML İndir sonrası aynı klasöre koyun
        </span>
      </div>

      <div className="flex items-center justify-between gap-3 px-5 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="size-8 rounded-md bg-gradient-to-br from-amber-300 via-orange-400 to-rose-400 flex items-center justify-center font-black text-zinc-900 text-sm shadow-lg shadow-amber-500/20 shrink-0">
            L
          </div>
          <div className="leading-tight shrink-0">
            <div className="text-sm font-semibold tracking-tight">Lumo Mapper</div>
            <div className="text-[11px] text-zinc-500">
              RasStationComms · Projector Layout XML Editor
            </div>
          </div>

          {activeEntry ? (
            <span
              title="Şu anda yüklü olan istasyon ve dosya"
              className="ml-1 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono bg-amber-400/10 text-amber-200 border border-amber-400/40 min-w-0"
            >
              <span className="text-amber-400 text-[10px]">●</span>
              <span className="uppercase tracking-wider text-[9px] text-amber-300/70 font-sans font-semibold shrink-0">
                Aktif
              </span>
              <span className="text-zinc-300 truncate">{activeEntry.group}</span>
              <span className="text-zinc-500">/</span>
              <span className="text-zinc-400 shrink-0">projector-layout-</span>
              <span className="text-amber-200 font-semibold truncate">{activeEntry.fileName}</span>
              <span className="text-zinc-400 shrink-0">.xml</span>
            </span>
          ) : layout.cells.length > 0 ? (
            <span
              title="Yüklü ama kütüphaneye kaydedilmedi — ⤓ Kaydet ile ekle"
              className="ml-1 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono bg-orange-400/10 text-orange-200 border border-orange-400/40 min-w-0"
            >
              <span className="text-orange-400 text-[10px]">●</span>
              <span className="uppercase tracking-wider text-[9px] text-orange-300/70 font-sans font-semibold shrink-0">
                Kaydedilmedi
              </span>
              <span className="text-zinc-400 shrink-0">projector-layout-</span>
              <span className="text-orange-200 font-semibold truncate">{layout.stationName}</span>
              <span className="text-zinc-400 shrink-0">.xml</span>
            </span>
          ) : (
            <span className="ml-1 px-2 py-1 rounded-md text-[11px] font-sans bg-zinc-800/60 text-zinc-500 border border-zinc-700/40 italic shrink-0">
              dosya yüklü değil
            </span>
          )}
          <span className="ml-2 px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider bg-zinc-800 text-zinc-400 shrink-0">
            {layout.cells.length} hücre · {layout.rowCount} satır
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {validationCount > 0 && (
            <span className="text-xs px-2.5 py-1 rounded-full bg-red-500/10 border border-red-500/30 text-red-300">
              {validationCount} hata
            </span>
          )}
          <button
            type="button"
            onClick={handleOpen}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/60 text-zinc-200"
          >
            XML Aç
          </button>
          <button
            type="button"
            onClick={() => setShowViewer(true)}
            title="Mevcut layout'tan üretilen XML'i salt-okunur olarak görüntüle"
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/60 text-zinc-200"
          >
            ⟨/⟩ XML Görüntüle
          </button>
          {mode === 'rebin' && (
            <button
              type="button"
              onClick={handleAutoFix}
              title="Yüklü dosyada rebin geometrisini düzelt. Aynı dosyanın üstüne yazar."
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-200"
            >
              ✦ Otomatik Düzelt
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowSave(true)}
            title="Mevcut layout'u istasyon/dosya/pod-rebin seçerek kütüphaneye kaydet"
            className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-emerald-400 hover:bg-emerald-300 text-zinc-900"
          >
            ⤓ Kaydet
          </button>
          <button
            type="button"
            onClick={handleDownload}
            title="XML'i diske indir (RAS klasörüne koymak için)"
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/60 text-zinc-200"
          >
            ⬇ XML İndir
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xml,application/xml,text/xml"
            className="hidden"
            onChange={handleFile}
          />
        </div>
      </div>
      {showViewer && <XmlViewerModal onClose={() => setShowViewer(false)} />}
      {showSave && <SaveDialog onClose={() => setShowSave(false)} />}
    </div>
  );
}

function extractFileName(filename: string): string {
  const base = filename.replace(/\.[^/.]+$/, '');
  const m = base.match(/^projector-layout-(.+)$/i);
  return (m ? m[1] : base).trim();
}

function formatStamp(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-` +
    `${pad(d.getHours())}${pad(d.getMinutes())}`
  );
}
