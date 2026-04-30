import { detectScreens, isWindowManagementSupported } from '../screens';
import { useControlStore } from '../store';

export function PermissionGate() {
  const permission = useControlStore((s) => s.permission);
  const setPermission = useControlStore((s) => s.setPermission);
  const setScreens = useControlStore((s) => s.setScreens);

  if (permission === 'granted') return null;

  if (permission === 'unsupported' || !isWindowManagementSupported()) {
    return (
      <Banner kind="error" title="Tarayıcı desteklenmiyor">
        <p>
          Lumo, ekranları algılamak için <strong>Window Management API</strong>'sine ihtiyaç duyar.
          Bu API yalnızca <strong>Chrome</strong> veya <strong>Edge</strong> üzerinde, secure
          context (localhost veya HTTPS) altında çalışır.
        </p>
        <p className="mt-2 text-zinc-400">
          Lütfen bu sayfayı Edge ya da Chrome ile <code>http://localhost:5173</code> üzerinden açın.
        </p>
      </Banner>
    );
  }

  if (permission === 'denied') {
    return (
      <Banner kind="error" title="İzin reddedilmiş">
        <p>
          Display erişim izni daha önce reddedilmiş. Tarayıcıdan adres çubuğundaki kilit simgesine
          tıklayıp "Window Management" iznini <strong>İzin Ver</strong> olarak değiştirin, sonra
          sayfayı yenileyin.
        </p>
      </Banner>
    );
  }

  return (
    <Banner kind="info" title="Display'lere erişim izni gerekli">
      <p>
        Bağlı projektörü tespit edebilmek için tarayıcıdan tüm ekranlara erişim izni vermen lazım.
        Aşağıdaki butona tıkla, açılan tarayıcı dialog'unda <strong>İzin Ver</strong>'i seç.
      </p>
      <button
        type="button"
        onClick={async () => {
          try {
            // Triggers the native permission prompt as a side-effect.
            const screens = await detectScreens();
            setScreens(screens);
            setPermission('granted');
          } catch (err) {
            console.error('Permission request failed', err);
            setPermission('denied');
          }
        }}
        className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-zinc-900 font-medium text-sm transition-colors"
      >
        İzin Ver ve Ekranları Tara
      </button>
    </Banner>
  );
}

function Banner({
  kind,
  title,
  children,
}: {
  kind: 'info' | 'error';
  title: string;
  children: React.ReactNode;
}) {
  const palette =
    kind === 'error'
      ? 'border-red-500/30 bg-red-500/5 text-red-100'
      : 'border-amber-400/30 bg-amber-400/5 text-amber-50';
  return (
    <div className={`rounded-2xl border p-6 ${palette}`}>
      <h2 className="text-base font-semibold mb-2">{title}</h2>
      <div className="text-sm leading-relaxed text-zinc-200/90 [&_code]:font-mono [&_code]:text-xs [&_code]:bg-zinc-800/60 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded">
        {children}
      </div>
    </div>
  );
}
