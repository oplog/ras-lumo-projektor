import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLayoutStore } from '../../lib/store';
import { serializeLayoutToXml } from '../../lib/xml';

export function XmlViewerModal({ onClose }: { onClose: () => void }) {
  const layout = useLayoutStore((s) => s.layout);
  const [copied, setCopied] = useState(false);

  // Defensive: serialize can throw on a partially-formed layout. Catch it
  // and show a friendly error instead of unmounting silently.
  let xml: string;
  let serializeError: string | null = null;
  try {
    xml = serializeLayoutToXml(layout);
  } catch (err) {
    xml = '';
    serializeError = (err as Error).message ?? 'XML üretilemedi.';
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(xml);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard may be blocked in some contexts; fall back silently.
    }
  };

  const lineCount = xml.split('\n').length;
  const sizeKb = (new Blob([xml]).size / 1024).toFixed(1);

  const drawer = (
    <div className="fixed inset-0 z-[100] flex">
      {/* Backdrop — clicking closes the drawer. */}
      <button
        type="button"
        aria-label="Kapat"
        onClick={onClose}
        className="flex-1 bg-black/60 backdrop-blur-[2px] cursor-default"
      />
      {/* Drawer panel — slides in from the right, ~80% viewport wide. */}
      <aside className="w-[80vw] max-w-[1400px] min-w-[480px] h-full flex flex-col bg-zinc-950 border-l border-zinc-700/80 shadow-2xl shadow-black/60 animate-[xmlDrawerIn_180ms_ease-out]">
        <header className="flex items-center justify-between gap-3 px-5 py-3 border-b border-zinc-800/80 bg-zinc-900/40">
          <div className="flex items-center gap-3 min-w-0">
            <div className="text-sm font-semibold text-zinc-100 shrink-0">
              XML Önizleme
            </div>
            <span className="text-[11px] font-mono text-zinc-500 truncate">
              {layout.stationName || '(adsız)'} · {lineCount} satır · {sizeKb} KB
            </span>
            <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-300 shrink-0">
              salt-okunur
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleCopy}
              disabled={!!serializeError}
              className="px-2.5 py-1 text-xs font-medium rounded-md bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/60 text-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {copied ? '✓ Kopyalandı' : '⧉ Kopyala'}
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Kapat"
              className="px-3 py-1 text-xs text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800 rounded-md border border-zinc-700/60"
            >
              Kapat (Esc)
            </button>
          </div>
        </header>
        <div className="flex-1 overflow-auto font-mono text-[13px] leading-5">
          {serializeError ? (
            <div className="p-6 text-sm text-red-300">
              <div className="font-semibold mb-1">XML üretilemedi.</div>
              <div className="font-mono text-xs text-red-200/80 whitespace-pre-wrap">
                {serializeError}
              </div>
              <div className="text-zinc-500 mt-3 text-xs">
                Önce sidebar'dan layout alanlarını doldurun ya da bir XML açın.
              </div>
            </div>
          ) : (
            <pre className="px-6 py-4 text-zinc-300 whitespace-pre">
              <HighlightedXml xml={xml} />
            </pre>
          )}
        </div>
        <footer className="px-5 py-2 border-t border-zinc-800/80 text-[11px] text-zinc-500 bg-zinc-900/40">
          Bu önizleme mevcut layout'tan üretilmiştir. Düzenlemek için drawer'ı
          kapatıp sidebar'daki ilgili bölümü kullanın — değişiklikler buraya
          canlı yansır.
        </footer>
      </aside>
    </div>
  );

  return createPortal(drawer, document.body);
}

/**
 * Lightweight XML colorizer — splits into tags/attrs/text without pulling
 * in a real parser. Just enough to make the preview easy on the eyes.
 */
function HighlightedXml({ xml }: { xml: string }) {
  // Tokenize on tag boundaries. Inside tags, colorize tag name + attrs.
  const parts: React.ReactNode[] = [];
  let i = 0;
  let key = 0;
  while (i < xml.length) {
    const lt = xml.indexOf('<', i);
    if (lt === -1) {
      parts.push(<span key={key++}>{xml.slice(i)}</span>);
      break;
    }
    if (lt > i) {
      parts.push(
        <span key={key++} className="text-zinc-300">
          {xml.slice(i, lt)}
        </span>,
      );
    }
    const gt = xml.indexOf('>', lt);
    if (gt === -1) {
      parts.push(<span key={key++}>{xml.slice(lt)}</span>);
      break;
    }
    const tag = xml.slice(lt, gt + 1);
    parts.push(<TagToken key={key++} tag={tag} />);
    i = gt + 1;
  }
  return <>{parts}</>;
}

function TagToken({ tag }: { tag: string }) {
  // <?xml ... ?> processing instruction
  if (tag.startsWith('<?')) {
    return <span className="text-zinc-500">{tag}</span>;
  }
  // <!-- comment -->
  if (tag.startsWith('<!--')) {
    return <span className="text-zinc-500 italic">{tag}</span>;
  }
  const isClose = tag.startsWith('</');
  const inner = tag.replace(/^<\/?/, '').replace(/\/?>$/, '');
  const [name, ...rest] = inner.split(/\s+/);
  const attrs = rest.join(' ');

  return (
    <>
      <span className="text-zinc-500">{isClose ? '</' : '<'}</span>
      <span className="text-emerald-400">{name}</span>
      {attrs && (
        <>
          {' '}
          <AttrTokens text={attrs} />
        </>
      )}
      <span className="text-zinc-500">{tag.endsWith('/>') ? '/>' : '>'}</span>
    </>
  );
}

function AttrTokens({ text }: { text: string }) {
  // Match name="value" pairs.
  const re = /(\w[\w-]*)\s*=\s*"([^"]*)"/g;
  const out: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null = re.exec(text);
  let key = 0;
  while (m) {
    if (m.index > last) {
      out.push(<span key={key++}>{text.slice(last, m.index)}</span>);
    }
    out.push(
      <span key={key++}>
        <span className="text-amber-300">{m[1]}</span>
        <span className="text-zinc-500">=</span>
        <span className="text-sky-300">{`"${m[2]}"`}</span>
      </span>,
    );
    last = m.index + m[0].length;
    m = re.exec(text);
  }
  if (last < text.length) {
    out.push(<span key={key++}>{text.slice(last)}</span>);
  }
  return <>{out}</>;
}
