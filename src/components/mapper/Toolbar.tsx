import { useRef } from 'react';
import { saveToLibrary } from '../../lib/library';
import { useLayoutStore } from '../../lib/store';
import { hasErrors, validateLayout } from '../../lib/validation';
import { parseLayoutFromXml, serializeLayoutToXml } from '../../lib/xml';

export function Toolbar() {
  const layout = useLayoutStore((s) => s.layout);
  const setLayout = useLayoutStore((s) => s.setLayout);
  const applyHomographyFix = useLayoutStore((s) => s.applyHomographyFix);
  const applyValidationCount = useLayoutStore((s) => s.applyValidationCount);
  const validationCount = useLayoutStore((s) => s.validationCount);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleOpen = () => {
    fileInputRef.current?.click();
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = parseLayoutFromXml(text);
      setLayout(parsed);
      // Auto-save raw uploaded XML to library so the user can browse it later.
      autoSaveCurrentToLibrary(parsed.stationName, text);
    } catch (err) {
      alert(`XML yüklenemedi: ${(err as Error).message}`);
    } finally {
      e.target.value = '';
    }
  };

  const handleAutoFix = () => {
    if (layout.boundaryCorners.length !== 4) {
      alert('4 boundary corner gerekli — önce XML aç.');
      return;
    }
    const st = layout.metadata.surfaceType;
    const isRebin = st === 'PutToLight' || st === 'PackToLight';
    const algoLabel = isRebin
      ? 'rebin (canonicalize köşeler + asym500 gap)'
      : 'pod (RAS sırasına güven + uniform spacing)';
    const ok = window.confirm(
      `Otomatik düzeltme uygulanacak:\n\n` +
        `• SurfaceType: ${st}\n` +
        `• Algoritma: ${algoLabel}\n` +
        `• Hücre adı özelleştirmeleri sıfırlanır\n\n` +
        `Yanlış SurfaceType seçtiysen sidebar → Metadata bölümünden değiştir, sonra tekrar tıkla.\n\n` +
        `Devam edilsin mi?`,
    );
    if (!ok) return;
    applyHomographyFix();
    // Auto-save the corrected layout to library.
    setTimeout(() => {
      const cur = useLayoutStore.getState().layout;
      autoSaveCurrentToLibrary(cur.stationName, serializeLayoutToXml(cur));
    }, 0);
  };

  const handleSave = () => {
    let effectiveStationName = layout.stationName.trim();

    // Empty station name → offer a fallback so user isn't blocked.
    if (!effectiveStationName) {
      const fallback = `untitled-${formatStamp(new Date())}`;
      const ok = window.confirm(
        `İstasyon adı boş.\n\nDosya '${fallback}' olarak indirilsin mi?\n\nİstersen önce sidebar → İstasyon → Station Name yazıp tekrar dene.`,
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
    // Auto-save downloaded XML to library too.
    autoSaveCurrentToLibrary(effectiveStationName, xml);
  };

  /**
   * Save the current layout XML to the library, keyed by station name.
   * Re-saves overwrite the same entry, so the library always tracks the
   * latest state per station. Runs silently — no prompts.
   */
  function autoSaveCurrentToLibrary(stationName: string, xml: string): void {
    const name = stationName.trim() || `untitled-${formatStamp(new Date())}`;
    const mode = useLayoutStore.getState().geometryMode;
    try {
      saveToLibrary(name, mode, xml);
    } catch {
      // Reserved-name collisions etc. are ignored — auto-save is best-effort.
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-zinc-800/80 bg-zinc-900/40 backdrop-blur sticky top-0 z-10">
      <div className="flex items-center gap-3">
        <div className="size-8 rounded-md bg-gradient-to-br from-amber-300 via-orange-400 to-rose-400 flex items-center justify-center font-black text-zinc-900 text-sm shadow-lg shadow-amber-500/20">
          L
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold tracking-tight">Lumo Mapper</div>
          <div className="text-[11px] text-zinc-500">
            RasStationComms · Projector Layout XML Editor
          </div>
        </div>
        <span className="ml-3 px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider bg-zinc-800 text-zinc-400">
          {layout.cells.length} hücre · {layout.rowCount} satır
        </span>
      </div>

      <div className="flex items-center gap-2">
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
          onClick={handleAutoFix}
          title={`SurfaceType'a göre otomatik düzelt. Şu an: ${layout.metadata.surfaceType} → ${layout.metadata.surfaceType === 'PutToLight' || layout.metadata.surfaceType === 'PackToLight' ? 'rebin algoritması (canonicalize + asym500)' : 'pod algoritması (RAS sırası + uniform)'}`}
          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-200"
        >
          ✦ Otomatik Düzelt
        </button>
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
