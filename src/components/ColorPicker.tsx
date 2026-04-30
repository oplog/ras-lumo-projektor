interface Props {
  value: string;
  onChange: (hex: string) => void;
}

const PRESETS: Array<{ hex: string; name: string }> = [
  { hex: '#000000', name: 'Siyah' },
  { hex: '#ffffff', name: 'Beyaz' },
  { hex: '#ff0000', name: 'Kırmızı' },
  { hex: '#00ff00', name: 'Yeşil' },
  { hex: '#0000ff', name: 'Mavi' },
  { hex: '#ffff00', name: 'Sarı' },
  { hex: '#00ffff', name: 'Cyan' },
  { hex: '#ff00ff', name: 'Magenta' },
];

export function ColorPicker({ value, onChange }: Props) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-2">
        {PRESETS.map((preset) => (
          <button
            key={preset.hex}
            type="button"
            onClick={() => onChange(preset.hex)}
            className={`group relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
              value.toLowerCase() === preset.hex.toLowerCase()
                ? 'border-amber-300 scale-105 shadow-lg'
                : 'border-zinc-700/60 hover:border-zinc-500'
            }`}
            style={{ background: preset.hex }}
            title={preset.name}
          >
            <span className="sr-only">{preset.name}</span>
          </button>
        ))}
      </div>
      <label className="flex items-center gap-2 text-xs text-zinc-400">
        <span className="text-zinc-500">Özel:</span>
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-10 h-7 rounded cursor-pointer bg-transparent border border-zinc-700"
        />
        <span className="font-mono text-zinc-300">{value.toUpperCase()}</span>
      </label>
    </div>
  );
}
