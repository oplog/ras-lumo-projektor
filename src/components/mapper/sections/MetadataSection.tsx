import { useLayoutStore } from '../../../lib/store';
import { ALL_SURFACE_TYPES, SURFACE_TYPE_LABELS } from '../../../lib/types';
import { Field, Section, TextInput } from './Section';

export function MetadataSection() {
  const metadata = useLayoutStore((s) => s.layout.metadata);
  const setSurfaceType = useLayoutStore((s) => s.setSurfaceType);
  const updateMetadata = useLayoutStore((s) => s.updateMetadata);
  const addFace = useLayoutStore((s) => s.addFace);
  const removeFace = useLayoutStore((s) => s.removeFace);
  const updateFace = useLayoutStore((s) => s.updateFace);

  return (
    <Section title="Metadata (Surface + Face)" hint="WMS mesajındaki PodFace/IsPalette eşleşmesi">
      <Field label="Surface Type">
        <select
          value={metadata.surfaceType}
          onChange={(e) => setSurfaceType(e.target.value as typeof metadata.surfaceType)}
          className="w-full bg-zinc-950/80 border border-zinc-700/60 rounded-md px-2.5 py-1.5 text-sm text-zinc-100"
        >
          {ALL_SURFACE_TYPES.map((t) => (
            <option key={t} value={t}>
              {SURFACE_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Surface (label)">
        <TextInput
          value={metadata.surface}
          onChange={(e) => updateMetadata({ surface: e.target.value })}
        />
      </Field>

      <div>
        <div className="flex items-center justify-between mb-1">
          <div className="text-[11px] font-medium text-zinc-400">Face değerleri</div>
          <button
            type="button"
            onClick={() => addFace('')}
            className="text-[11px] px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700/60"
          >
            + Ekle
          </button>
        </div>
        <div className="space-y-1.5">
          {metadata.face.length === 0 && (
            <div className="text-[11px] text-zinc-600 italic">Henüz Face eklenmemiş.</div>
          )}
          {metadata.face.map((f, i) => (
            <div key={i} className="flex gap-1.5">
              <TextInput
                value={f}
                onChange={(e) => updateFace(i, e.target.value)}
                placeholder="A / B / North ..."
              />
              <button
                type="button"
                onClick={() => removeFace(i)}
                className="px-2 rounded-md bg-zinc-800 hover:bg-red-500/20 hover:text-red-300 text-zinc-400 border border-zinc-700/60 text-xs"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}
