import { useEffect, useState } from 'react';

interface Props {
  index: number;
  label: string;
  durationMs: number;
}

export function IdentifyView({ index, label, durationMs }: Props) {
  const [remaining, setRemaining] = useState(Math.ceil(durationMs / 1000));

  useEffect(() => {
    const start = Date.now();
    const t = setInterval(() => {
      const elapsed = Date.now() - start;
      const left = Math.max(0, Math.ceil((durationMs - elapsed) / 1000));
      setRemaining(left);
      if (elapsed >= durationMs) {
        clearInterval(t);
        try {
          window.close();
        } catch {
          // ignore — some browsers block close on windows not opened via script
        }
      }
    }, 100);
    return () => clearInterval(t);
  }, [durationMs]);

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black text-white select-none">
      <div className="text-[28vw] leading-none font-black tracking-tighter">{index}</div>
      <div className="mt-6 text-2xl font-mono text-amber-300">{label}</div>
      <div className="mt-2 text-base text-zinc-400">
        {window.innerWidth}×{window.innerHeight}
      </div>
      <div className="absolute bottom-8 right-10 text-sm text-zinc-500 font-mono">{remaining}s</div>
    </div>
  );
}
