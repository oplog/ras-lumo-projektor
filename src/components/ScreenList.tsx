import { useEffect } from 'react';
import { openIdentifyWindow, openProjectorWindow } from '../projector-actions';
import { describeScreen, screenKey } from '../screens';
import { useControlStore } from '../store';
import { ScreenCard } from './ScreenCard';

const IDENTIFY_DURATION_MS = 4000;

export function ScreenList() {
  const screens = useControlStore((s) => s.screens);
  const projectorWindow = useControlStore((s) => s.projectorWindow);
  const setProjectorWindow = useControlStore((s) => s.setProjectorWindow);
  const setProjectorSession = useControlStore((s) => s.setProjectorSession);
  const selectScreen = useControlStore((s) => s.selectScreen);
  const identifyRunning = useControlStore((s) => s.identifyRunning);
  const setIdentifyRunning = useControlStore((s) => s.setIdentifyRunning);

  // Watch projector window for manual close (user clicked X or pressed ESC).
  useEffect(() => {
    if (!projectorWindow) return;
    const t = setInterval(() => {
      if (projectorWindow.closed) {
        clearInterval(t);
        setProjectorWindow(null);
        setProjectorSession(null);
      }
    }, 750);
    return () => clearInterval(t);
  }, [projectorWindow, setProjectorWindow, setProjectorSession]);

  const handleIdentifyAll = async () => {
    if (identifyRunning || screens.length === 0) return;
    setIdentifyRunning(true);
    const wins: Array<Window | null> = [];
    screens.forEach((screen, index) => {
      const w = openIdentifyWindow(
        screen,
        index + 1,
        describeScreen(screen, index),
        IDENTIFY_DURATION_MS,
      );
      wins.push(w);
    });
    await new Promise((r) => setTimeout(r, IDENTIFY_DURATION_MS + 250));
    for (const w of wins) {
      try {
        w?.close();
      } catch {
        // ignore
      }
    }
    setIdentifyRunning(false);
  };

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Bağlı Ekranlar</h2>
          <p className="text-sm text-zinc-500 mt-0.5">
            {screens.length === 0
              ? 'Henüz ekran tespit edilmedi.'
              : `${screens.length} ekran tespit edildi. Projektör ekranını seç.`}
          </p>
        </div>
        <button
          type="button"
          onClick={handleIdentifyAll}
          disabled={identifyRunning || screens.length === 0}
          className="px-3.5 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium text-zinc-100 border border-zinc-700/60 transition-colors"
        >
          {identifyRunning ? 'Tanımlanıyor…' : 'Hepsini Tanımla'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {screens.map((screen, index) => (
          <ScreenCard
            key={screenKey(screen)}
            screen={screen}
            index={index}
            disabled={Boolean(projectorWindow) || identifyRunning}
            onSelect={() => {
              selectScreen(describeScreen(screen, index));
              const win = openProjectorWindow(screen);
              if (!win) {
                alert(
                  'Pencere açılamadı. Tarayıcı popup engelleyici aktif olabilir; izin verin ve tekrar deneyin.',
                );
                return;
              }
              setProjectorWindow(win);
              setProjectorSession({
                screenLabel: describeScreen(screen, index),
                bounds: {
                  left: screen.availLeft,
                  top: screen.availTop,
                  width: screen.availWidth,
                  height: screen.availHeight,
                },
                openedAt: Date.now(),
              });
            }}
            onIdentify={() => {
              const w = openIdentifyWindow(
                screen,
                index + 1,
                describeScreen(screen, index),
                IDENTIFY_DURATION_MS,
              );
              setTimeout(() => {
                try {
                  w?.close();
                } catch {
                  // ignore
                }
              }, IDENTIFY_DURATION_MS + 250);
            }}
          />
        ))}
      </div>
    </section>
  );
}
