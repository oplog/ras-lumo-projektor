import { useRef, useState } from 'react';
import { getEntry, saveFile } from '../../lib/library';
import { useLayoutStore } from '../../lib/store';
import { toast } from '../../lib/toast';
import { hasErrors, validateLayout } from '../../lib/validation';
import { parseLayoutFromXml, serializeLayoutToXml } from '../../lib/xml';
import { XmlViewerModal } from './XmlViewerModal';

const RAS_FOLDER = '%APPDATA%\\OPLOG\\RasStationComms\\Saved Projector Layouts\\';
const LAST_GROUP_KEY = 'lumo-last-group';

export function Toolbar() {
  const layout = useLayoutStore((s) => s.layout);
  const setLayout = useLayoutStore((s) => s.setLayout);
  const applyHomographyFix = useLayoutStore((s) => s.applyHomographyFix);
  const applyValidationCount = useLayoutStore((s) => s.applyValidationCount);
  const validationCount = useLayoutStore((s) => s.validationCount);
  const currentEntryId = useLayoutStore((s) => s.currentEntryId);
  const setCurrentEntryId = useLayoutStore((s) => s.setCurrentEntryId);
  const mode = useLayoutStore((s) => s.geometryMode);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showViewer, setShowViewer] = useState(false);
  const [pathCopied, setPathCopied] = useState(false);

  const activeEntry = currentEntryId ? getEntry(currentEntryId) : null;

  const handleOpen = () => {
    fileInputRef.current?.click();
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = parseLayoutFromXml(text);
      const fileNameFromSource = extractFileName(file.name);
      if (fileNameFromSource) {
        parsed.stationName = fileNameFromSource;
      }
      // Ask which group this file belongs to. Default = last-used group
      // (so the user doesn't keep typing the same value), or the file's
      // own name as a sensible fallback for first-time users.
      const lastGroup = window.localStorage.getItem(LAST_GROUP_KEY) ?? '';
      const group = window.prompt(
        `"${parsed.stationName}" hangi istasyonun altına eklensin?`,
        lastGroup || parsed.stationName,
      );
      if (!group?.trim()) {
        toast.info('Yükleme iptal edildi.');
        return;
      }
      window.localStorage.setItem(LAST_GROUP_KEY, group.trim());

      setLayout(parsed);
      const normalizedXml = serializeLayoutToXml(parsed);
      const saved = saveFile({
        group: group.trim(),
        fileName: parsed.stationName,
        mode: useLayoutStore.getState().geometryMode,
        xml: normalizedXml,
      });
      setCurrentEntryId(saved.id);
      toast.success(`"${saved.fileName}.xml" → ${saved.group} altına kaydedildi.`);
    } catch (err) {
      toast.error(`XML yüklenemedi: ${(err as Error).message}`);
    } finally {
      e.target.value = '';
    }
  };

  /** Strip `projector-layout-` prefix and the file extension. */
  function extractFileName(filename: string): string {
    const base = filename.replace(/\.[^/.]+$/, '');
    const m = base.match(/^projector-layout-(.+)$/i);
    return (m ? m[1] : base).trim();
  }

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
    setTimeout(() => {
      const cur = useLayoutStore.getState().layout;
      autoSaveCurrent(serializeLayoutToXml(cur));
      toast.success(`"${cur.stationName}.xml" düzeltildi ve kaydedildi.`);
    }, 0);
  };

  const handleSave = () => {
    let effectiveStationName = layout.stationName.trim();

    if (!effectiveStationName) {
      const fallback = `untitled-${formatStamp(new Date())}`;
      const ok = window.confirm(
        `Dosya adı boş.\n\n'${fallback}' olarak indirilsin mi?`,
      );
      if (!ok) return;
      effectiveStationName = fallback;
    }

    const layoutToSave = {
      ...layout,
      stationName: effectiveStationName,
      lastModified: new Date().toISOString(),
    };

    const issues = validateLayout(layoutToSave);
    applyValidationCount(issues.length);

    if (hasErrors(issues)) {
      const proceed = window.confirm(
        `Layout'ta ${issues.length} doğrulama uyarısı var:\n\n` +
          issues.map((i) => `• [${i.field}] ${i.message}`).join('\n') +
          '\n\nYine de indirilsin mi? (Windows app dosyayı reddedebilir)',
      );
      if (!proceed) return;
    }

    const xml = serializeLayoutToXml(layoutToSave);
    const safeName = effectiveStationName.replace(/[\\/:*?"<>|]/g, '_');
    downloadFile(`projector-layout-${safeName}.xml`, xml);
    autoSaveCurrent(xml);
  };

  /**
   * Overwrite the active library entry's XML, falling back to a fresh
   * row under the last-used group if no entry is loaded.
   */
  function autoSaveCurrent(xml: string) {
    const fileName =
      useLayoutStore.getState().layout.stationName.trim() ||
      `untitled-${formatStamp(new Date())}`;
    const m = useLayoutStore.getState().geometryMode;
    try {
      const existing = currentEntryId ? getEntry(currentEntryId) : null;
      const group =
        existing?.group ||
        window.localStorage.getItem(LAST_GROUP_KEY) ||
        fileName;
      const saved = saveFile({
        group,
        fileName,
        mode: m,
        xml,
        replaceId: existing?.id,
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
              <span className="text-amber-200 font-semibold truncate">
                {activeEntry.fileName}
              </span>
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
            onClick={handleSave}
            className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-amber-400 hover:bg-amber-300 text-zinc-900"
          >
            XML İndir
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
    </div>
  );
}

function formatStamp(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-` +
    `${pad(d.getHours())}${pad(d.getMinutes())}`
  );
}

function downloadFile(filename: string, content: string) {
  const blob = new Blob([content], { type: 'application/xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
