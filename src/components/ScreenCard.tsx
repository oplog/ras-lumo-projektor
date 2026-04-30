import { describeScreen } from '../screens';
import type { ScreenDetailed } from '../types';

interface Props {
  screen: ScreenDetailed;
  index: number;
  disabled: boolean;
  onSelect: () => void;
  onIdentify: () => void;
}

export function ScreenCard({ screen, index, disabled, onSelect, onIdentify }: Props) {
  const name = describeScreen(screen, index);
  const isPrimary = screen.isPrimary;
  const isInternal = screen.isInternal;

  return (
    <div
      className={`relative rounded-2xl border bg-zinc-900/40 p-5 transition-colors ${
        isPrimary ? 'border-zinc-700/70' : 'border-amber-500/30 bg-amber-500/5'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-400">
              #{index + 1}
            </span>
            <h3 className="text-sm font-semibold truncate">{name}</h3>
          </div>
          <div className="mt-3 space-y-1 text-xs text-zinc-400 font-mono">
            <div>
              <span className="text-zinc-600">Çözünürlük:</span>{' '}
              <span className="text-zinc-200">
                {screen.width}×{screen.height}
              </span>
              <span className="text-zinc-600"> · {screen.devicePixelRatio.toFixed(2)}x DPR</span>
            </div>
            <div>
              <span className="text-zinc-600">Konum:</span> ({screen.left}, {screen.top})
            </div>
            <div className="flex gap-1.5 mt-2">
              {isPrimary && (
                <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 text-[10px] uppercase tracking-wider">
                  Primary
                </span>
              )}
              {isInternal ? (
                <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 text-[10px] uppercase tracking-wider">
                  Yerleşik
                </span>
              ) : (
                <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-200 text-[10px] uppercase tracking-wider">
                  Harici (HDMI?)
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={onSelect}
          disabled={disabled}
          className="flex-1 px-3 py-2 rounded-lg bg-amber-400 hover:bg-amber-300 disabled:opacity-40 disabled:cursor-not-allowed text-zinc-900 text-sm font-semibold transition-colors"
        >
          Bu Projektör → Aç
        </button>
        <button
          type="button"
          onClick={onIdentify}
          disabled={disabled}
          className="px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed text-zinc-100 text-sm font-medium border border-zinc-700/60 transition-colors"
        >
          Tanımla
        </button>
      </div>
    </div>
  );
}
