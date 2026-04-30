import { useLayoutStore } from '../../../lib/store';
import { Field, NumberInput, Section } from './Section';

/**
 * Split `\\.\DISPLAY2` → prefix `\\.\DISPLAY` + number `2`. Original
 * slash style (`\\.\`, `\\?\`, etc.) is preserved in the prefix; only
 * the trailing integer is user-editable. If the value doesn't match the
 * expected shape, fall back to a sensible default so the UI stays
 * consistent.
 */
function splitDeviceName(value: string): { prefix: string; n: number } {
  const m = value.match(/^(.*DISPLAY)(\d+)$/i);
  if (m) return { prefix: m[1], n: Number(m[2]) };
  return { prefix: '\\\\.\\DISPLAY', n: 1 };
}

export function ScreenSection() {
  const screen = useLayoutStore((s) => s.layout.screen);
  const update = useLayoutStore((s) => s.updateScreen);
  const { prefix, n } = splitDeviceName(screen.deviceName);

  return (
    <Section title="Ekran (Projeksiyon)" hint="Windows app'in beklediği projektör çözünürlüğü">
      <Field label="Device Name">
        <div className="flex items-stretch rounded-md overflow-hidden border border-zinc-700/60 focus-within:border-amber-400/60">
          <span
            title="Bu kısım sabittir, RAS uygulaması böyle bekler"
            className="select-all px-2 py-1.5 text-sm font-mono bg-zinc-900/80 text-zinc-400 border-r border-zinc-700/60"
          >
            {prefix}
          </span>
          <input
            type="number"
            min="1"
            max="9"
            value={n}
            onFocus={(e) => e.currentTarget.select()}
            onChange={(e) => {
              const next = Math.max(1, Math.min(9, Number(e.target.value) || 1));
              update({ deviceName: `${prefix}${next}` });
            }}
            className="flex-1 bg-zinc-950/80 px-2.5 py-1.5 text-sm text-zinc-100 font-mono focus:outline-none"
          />
        </div>
        <div className="mt-1.5 flex gap-1.5 items-start rounded-md border border-amber-500/30 bg-amber-500/5 px-2 py-1.5">
          <span className="text-amber-400 text-xs leading-4 mt-px">⚠</span>
          <p className="text-[11px] leading-snug text-amber-200/90">
            <span className="font-semibold">Display numarası önemli.</span> Bu değer projeksiyon
            cihazının Windows'ta hangi ekran olduğunu söyler — yanlış girilirse görüntü başka
            monitöre düşer. <code className="font-mono">{prefix}</code> kısmı RAS'ın beklediği
            sabit format; sadece sondaki <span className="font-semibold">sayıyı</span> projeksiyon
            hangi display'e bağlıysa o yapın (örn. {prefix}1, {prefix}2, {prefix}3).
          </p>
        </div>
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Index">
          <NumberInput
            value={screen.index}
            onChange={(e) => update({ index: Number(e.target.value) })}
          />
        </Field>
        <Field label="Primary?">
          <select
            value={screen.isPrimary ? 'true' : 'false'}
            onChange={(e) => update({ isPrimary: e.target.value === 'true' })}
            className="w-full bg-zinc-950/80 border border-zinc-700/60 rounded-md px-2.5 py-1.5 text-sm text-zinc-100"
          >
            <option value="false">false</option>
            <option value="true">true</option>
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Width">
          <NumberInput
            value={screen.width}
            onChange={(e) => update({ width: Number(e.target.value) })}
          />
        </Field>
        <Field label="Height">
          <NumberInput
            value={screen.height}
            onChange={(e) => update({ height: Number(e.target.value) })}
          />
        </Field>
      </div>
    </Section>
  );
}
