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
          placeholder="örn: RAS-TOPLAMA-1"
        />
      </Field>
      <div className="text-[10px] text-zinc-500 font-mono">Version: {version}</div>
    </Section>
  );
}
