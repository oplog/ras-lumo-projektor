import { useLayoutStore } from '../../../lib/store';
import { NumberInput, Section } from './Section';

const LABELS = ['TL (Sol-Üst)', 'TR (Sağ-Üst)', 'BL (Sol-Alt)', 'BR (Sağ-Alt)'] as const;

export function BoundarySection() {
  const boundary = useLayoutStore((s) => s.layout.boundaryCorners);
  const setExact = useLayoutStore((s) => s.setBoundaryCornerExact);

  return (
    <Section
      title="Boundary (4 Köşe)"
      hint="Rebin'in dış 4 köşesinin projeksiyon piksellerindeki yeri"
    >
      <div className="space-y-2">
        {boundary.map((c, i) => (
          <div key={i} className="grid grid-cols-[1fr_70px_70px] items-center gap-1.5">
            <span className="text-[11px] text-zinc-300">{LABELS[i]}</span>
            <NumberInput
              value={c.x}
              onChange={(e) =>
                setExact(i as 0 | 1 | 2 | 3, { x: Number(e.target.value), y: c.y })
              }
              placeholder="X"
              step="any"
            />
            <NumberInput
              value={c.y}
              onChange={(e) =>
                setExact(i as 0 | 1 | 2 | 3, { x: c.x, y: Number(e.target.value) })
              }
              placeholder="Y"
              step="any"
            />
          </div>
        ))}
      </div>
    </Section>
  );
}
