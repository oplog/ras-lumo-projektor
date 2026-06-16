import { useMemo, useState } from 'react';
import {
  type CellTemplate,
  allTemplates,
  applyWPrefix,
  deleteCustomTemplate,
  parseCellNames,
  rebinSplitLabels,
  saveCustomTemplate,
} from '../../lib/cellTemplates';
import { dialog } from '../../lib/dialog';
import { useLayoutStore } from '../../lib/store';
import { toast } from '../../lib/toast';
import { GhostButton, Modal, PrimaryButton } from '../Modal';

/**
 * Bulk cell-name editor: paste / pick a template and apply all names at once
 * (in cell-list order) instead of typing each cell by hand. Templates can be
 * saved for reuse.
 */
export function CellNamesDialog({
  onClose,
  onApplied,
}: {
  onClose: () => void;
  onApplied: () => void;
}) {
  const cellCount = useLayoutStore((s) => s.layout.cells.length);
  const setAllCellNames = useLayoutStore((s) => s.setAllCellNames);

  const [text, setText] = useState(() =>
    useLayoutStore
      .getState()
      .layout.cells.map((c) => c.name)
      .join('\n'),
  );
  const [templates, setTemplates] = useState<CellTemplate[]>(() => allTemplates());
  const [leftLetter, setLeftLetter] = useState('W');
  const [rightLetter, setRightLetter] = useState('E');

  const generateRebinSplit = () => {
    const cells = useLayoutStore.getState().layout.cells;
    setText(
      rebinSplitLabels(
        cells.map((c) => c.columnIndex),
        leftLetter,
        rightLetter,
      ).join('\n'),
    );
  };

  const names = useMemo(() => parseCellNames(text), [text]);
  const match = names.length === cellCount;

  const applyTemplate = (tplName: string) => {
    const tpl = templates.find((t) => t.name === tplName);
    if (tpl) setText(tpl.names.join('\n'));
  };

  const handleSaveTemplate = async () => {
    const name = await dialog.prompt({
      title: 'Şablon olarak kaydet',
      label: 'Şablon adı',
      placeholder: 'örn. RAS 16x6 toplama',
    });
    if (!name) return;
    try {
      saveCustomTemplate(name, names);
      setTemplates(allTemplates());
      toast.success(`"${name}" şablonu kaydedildi (${names.length} isim).`);
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const handleDeleteTemplate = async () => {
    const custom = templates.filter((t) => t.names && t.name);
    if (custom.length === 0) return;
    const name = await dialog.prompt({
      title: 'Şablon sil',
      label: 'Silinecek şablon adı',
      placeholder: custom.map((t) => t.name).join(', '),
    });
    if (!name) return;
    deleteCustomTemplate(name);
    setTemplates(allTemplates());
    toast.info(`"${name}" şablonu silindi (varsa).`);
  };

  const handleApply = () => {
    if (cellCount === 0) {
      toast.error('Önce bir layout aç — isim atanacak hücre yok.');
      return;
    }
    setAllCellNames(names);
    onApplied();
    toast.success(`${Math.min(names.length, cellCount)} hücre adı uygulandı.`);
    onClose();
  };

  const footer = (
    <>
      <GhostButton onClick={onClose}>Vazgeç</GhostButton>
      <PrimaryButton onClick={handleApply} disabled={cellCount === 0 || names.length === 0}>
        Uygula ({Math.min(names.length, cellCount)} hücre)
      </PrimaryButton>
    </>
  );

  return (
    <Modal title="Toplu Göz Adları" onClose={onClose} footer={footer} width={520}>
      <div className="space-y-3">
        <p className="text-[12px] text-zinc-400 leading-relaxed">
          Her satıra bir göz adı yaz (ya da virgülle ayır). İsimler{' '}
          <span className="text-zinc-200">hücre sırasına göre</span> (yukarıdaki listedeki sırayla)
          tek seferde uygulanır.
        </p>

        {templates.length > 0 && (
          <div className="flex items-center gap-2">
            <label htmlFor="tpl-select" className="text-[11px] text-zinc-400 shrink-0">
              Şablon
            </label>
            <select
              id="tpl-select"
              defaultValue=""
              onChange={(e) => {
                applyTemplate(e.target.value);
                e.target.value = '';
              }}
              className="flex-1 bg-zinc-950/80 border border-zinc-700/60 rounded-md px-2 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-emerald-500/60"
            >
              <option value="" disabled>
                Şablon seç…
              </option>
              {templates.map((t) => (
                <option key={t.name} value={t.name}>
                  {t.name} ({t.names.length})
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-zinc-400 mr-0.5">Dönüştür:</span>
          <button
            type="button"
            onClick={() => setText(applyWPrefix(parseCellNames(text)).join('\n'))}
            title="Her satıra W- öneki ekler ve numarayı 2 haneye tamamlar"
            className="text-[11px] px-2 py-0.5 rounded-md border border-zinc-700/60 bg-zinc-800/60 hover:bg-zinc-700/60 text-zinc-200"
          >
            F-1 → W-F-01
          </button>
          <button
            type="button"
            onClick={() => setText(parseCellNames(text).reverse().join('\n'))}
            title="Sırayı ters çevir (numaralar tersten gidiyorsa)"
            className="text-[11px] px-2 py-0.5 rounded-md border border-zinc-700/60 bg-zinc-800/60 hover:bg-zinc-700/60 text-zinc-200"
          >
            ↑↓ Ters çevir
          </button>
        </div>

        {/* Rebin: iki yarım, her yarıya ayrı harf (sol / sağ) */}
        <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-zinc-800/80 bg-zinc-950/40 px-2 py-1.5">
          <span className="text-[11px] text-zinc-400 mr-0.5">Rebin böl:</span>
          <span className="text-[11px] text-zinc-500">sol</span>
          <input
            value={leftLetter}
            onChange={(e) => setLeftLetter(e.target.value)}
            maxLength={6}
            aria-label="Sol yarı etiketi"
            className="w-14 bg-zinc-950/80 border border-zinc-700/60 rounded px-1.5 py-0.5 text-[11px] text-center font-mono text-zinc-100 focus:outline-none focus:border-emerald-500/60"
          />
          <span className="text-[11px] text-zinc-500">sağ</span>
          <input
            value={rightLetter}
            onChange={(e) => setRightLetter(e.target.value)}
            maxLength={6}
            aria-label="Sağ yarı etiketi"
            className="w-14 bg-zinc-950/80 border border-zinc-700/60 rounded px-1.5 py-0.5 text-[11px] text-center font-mono text-zinc-100 focus:outline-none focus:border-emerald-500/60"
          />
          <button
            type="button"
            onClick={generateRebinSplit}
            title="Sol yarı = {sol}-NN, sağ yarı = {sağ}-NN olarak üret"
            className="text-[11px] px-2 py-0.5 rounded-md border border-emerald-500/40 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-200 font-medium"
          >
            Oluştur
          </button>
          <span className="text-[10px] text-zinc-500">
            → {(leftLetter || 'W').toUpperCase()}-01.. / {(rightLetter || 'E').toUpperCase()}-01..
          </span>
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          spellCheck={false}
          rows={12}
          placeholder={'F-1\nF-2\nE-1\nE-2'}
          className="w-full bg-zinc-950/80 border border-zinc-700/60 rounded-md px-3 py-2 text-xs font-mono text-zinc-100 focus:outline-none focus:border-emerald-500/60 resize-y"
        />

        <div className="flex items-center justify-between text-[11px]">
          <span className={match ? 'text-emerald-400/90' : 'text-amber-300/90'}>
            {names.length} isim · {cellCount} hücre
            {!match &&
              names.length > 0 &&
              (names.length > cellCount
                ? ` — fazlalık (${names.length - cellCount}) yok sayılır`
                : ` — son ${cellCount - names.length} hücre değişmez`)}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSaveTemplate}
              disabled={names.length === 0}
              className="text-zinc-400 hover:text-emerald-300 underline disabled:opacity-40 disabled:no-underline"
            >
              Şablon kaydet
            </button>
            {templates.length > 0 && (
              <button
                type="button"
                onClick={handleDeleteTemplate}
                className="text-zinc-500 hover:text-red-300 underline"
              >
                Şablon sil
              </button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
