import { useEffect, useMemo } from 'react';
import { createProjectionChannel, postProjection } from '../projection-channel';
import { useControlStore } from '../store';
import { ColorPicker } from './ColorPicker';
import { PatternToggle } from './PatternToggle';

export function ProjectorControls() {
  const projectorWindow = useControlStore((s) => s.projectorWindow);
  const projectorSession = useControlStore((s) => s.projectorSession);
  const projectorAlive = useControlStore((s) => s.projectorAlive);
  const setProjectorAlive = useControlStore((s) => s.setProjectorAlive);
  const setProjectorWindow = useControlStore((s) => s.setProjectorWindow);
  const setProjectorSession = useControlStore((s) => s.setProjectorSession);
  const currentColor = useControlStore((s) => s.currentColor);
  const currentPattern = useControlStore((s) => s.currentPattern);
  const setColor = useControlStore((s) => s.setColor);
  const setPattern = useControlStore((s) => s.setPattern);

  const channel = useMemo(() => createProjectionChannel(), []);

  // Listen for ready/bye/pong from the projector window.
  useEffect(() => {
    const onMessage = (ev: MessageEvent) => {
      const msg = ev.data;
      if (!msg || typeof msg !== 'object') return;
      if (msg.type === 'projector-ready' || msg.type === 'pong') {
        setProjectorAlive(true);
      }
      if (msg.type === 'projector-bye') {
        setProjectorAlive(false);
      }
    };
    channel.addEventListener('message', onMessage);
    // Re-broadcast current state on mount so a freshly opened projector picks it up.
    postProjection(channel, { type: 'set-color', hex: currentColor });
    postProjection(channel, { type: 'set-pattern', pattern: currentPattern });
    return () => {
      channel.removeEventListener('message', onMessage);
    };
  }, [channel, currentColor, currentPattern, setProjectorAlive]);

  // Heartbeat ping every 2s to confirm the projector window is responding.
  useEffect(() => {
    const t = setInterval(() => {
      postProjection(channel, { type: 'ping', nonce: Date.now() });
    }, 2000);
    return () => clearInterval(t);
  }, [channel]);

  const handleColor = (hex: string) => {
    setColor(hex);
    postProjection(channel, { type: 'set-color', hex });
  };

  const handlePattern = (pattern: typeof currentPattern) => {
    setPattern(pattern);
    postProjection(channel, { type: 'set-pattern', pattern });
  };

  const handleClose = () => {
    postProjection(channel, { type: 'close' });
    try {
      projectorWindow?.close();
    } catch {
      // ignore
    }
    setProjectorWindow(null);
    setProjectorSession(null);
    setProjectorAlive(false);
  };

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Projektör Kontrolü</h2>
          <p className="text-sm text-zinc-500 mt-0.5">
            {projectorSession ? (
              <>
                <span className="text-zinc-300">{projectorSession.screenLabel}</span> ·{' '}
                {projectorSession.bounds.width}×{projectorSession.bounds.height}
              </>
            ) : (
              'Bağlanıyor…'
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`text-xs px-2.5 py-1 rounded-full border ${
              projectorAlive
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-zinc-800/40 border-zinc-700/60 text-zinc-400'
            }`}
          >
            {projectorAlive ? 'Canlı' : 'Bekleniyor'}
          </span>
          <button
            type="button"
            onClick={handleClose}
            className="px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-300 text-xs font-medium border border-red-500/30 transition-colors"
          >
            Projektörü Kapat
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-5">
          <h3 className="text-sm font-semibold mb-3 text-zinc-200">Renk</h3>
          <ColorPicker value={currentColor} onChange={handleColor} />
        </div>
        <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-5">
          <h3 className="text-sm font-semibold mb-3 text-zinc-200">Hizalama Deseni</h3>
          <PatternToggle value={currentPattern} onChange={handlePattern} />
        </div>
      </div>
    </section>
  );
}
