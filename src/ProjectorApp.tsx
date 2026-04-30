import { IdentifyView } from './components/IdentifyView';
import { OperationalView } from './components/OperationalView';

type Mode = 'identify' | 'operational';

export function ProjectorApp() {
  const params = new URLSearchParams(window.location.search);
  const mode = (params.get('mode') ?? 'operational') as Mode;

  if (mode === 'identify') {
    const index = Number.parseInt(params.get('index') ?? '0', 10);
    const label = params.get('label') ?? `Ekran ${index}`;
    const duration = Number.parseInt(params.get('duration') ?? '4000', 10);
    return <IdentifyView index={index} label={label} durationMs={duration} />;
  }

  return <OperationalView />;
}
