import { useLayoutStore } from '../../../lib/store';
import { Field, NumberInput, Section, TextInput } from './Section';

export function ScreenSection() {
  const screen = useLayoutStore((s) => s.layout.screen);
  const update = useLayoutStore((s) => s.updateScreen);

  return (
    <Section title="Ekran (Projeksiyon)" hint="Windows app'in beklediği projektör çözünürlüğü">
      <Field label="Device Name">
        <TextInput
          value={screen.deviceName}
          onChange={(e) => update({ deviceName: e.target.value })}
          placeholder="\\.\DISPLAY2"
        />
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
