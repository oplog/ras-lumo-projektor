import { useLayoutStore } from '../../../lib/store';
import { Field, Section, TextInput } from './Section';

export function StationSection() {
  const stationName = useLayoutStore((s) => s.layout.stationName);
  const setStationName = useLayoutStore((s) => s.setStationName);
  const version = useLayoutStore((s) => s.layout.version);

  return (
    <Section title="İstasyon" hint="XML dosya adında geçer (projector-layout-{ad}.xml)">
      <Field label="Station Name">
        <TextInput
          value={stationName}
          onChange={(e) => setStationName(e.target.value)}
          placeholder="örn: 3, Put-A, askili"
        />
        {stationName.trim() && (
          <div className="mt-1.5 text-[10px] text-zinc-500 font-mono leading-snug">
            Dosya: <span className="text-zinc-400">projector-layout-</span>
            <span className="text-amber-300">{stationName.trim()}</span>
            <span className="text-zinc-400">.xml</span>
          </div>
        )}
        <div className="mt-1.5 flex gap-1.5 items-start rounded-md border border-emerald-500/20 bg-emerald-500/5 px-2 py-1.5">
          <span className="text-emerald-400 text-xs leading-4 mt-px">ℹ</span>
          <p className="text-[11px] leading-snug text-emerald-100/80">
            RAS yalnızca <code className="font-mono text-emerald-300">projector-layout-</code>
            ile başlayan dosyaları yükler. Dosya açtığında bu kısım otomatik
            ayıklanır ve XML içine yazılır.
          </p>
        </div>
      </Field>
      <div className="text-[10px] text-zinc-500 font-mono">Version: {version}</div>
    </Section>
  );
}
