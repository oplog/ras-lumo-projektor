import { DialogHost } from './components/DialogHost';
import { ToastHost } from './components/ToastHost';
import { EditorCanvas } from './components/mapper/EditorCanvas';
import { Sidebar } from './components/mapper/Sidebar';
import { Toolbar } from './components/mapper/Toolbar';
import { useProjectionSync } from './lib/projection-sync';

export function App() {
  // The editor boots blank — no draft is auto-restored. Editing only makes
  // sense inside a file, so the user opens/creates one from the library
  // (which lives in D1); there's nothing to restore into a "no file" state.

  // Live broadcast layout changes so a projector window (manually opened on the
  // projector display) can render the boundary + cells in real time.
  useProjectionSync();

  return (
    <div className="h-screen w-screen flex flex-col bg-zinc-950 text-zinc-100 overflow-hidden">
      <Toolbar />
      <div className="flex flex-1 min-h-0">
        <Sidebar />
        <EditorCanvas />
      </div>
      <ToastHost />
      <DialogHost />
    </div>
  );
}
