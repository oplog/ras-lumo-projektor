import { useEffect } from 'react';
import { EditorCanvas } from './components/mapper/EditorCanvas';
import { Sidebar } from './components/mapper/Sidebar';
import { Toolbar } from './components/mapper/Toolbar';
import { loadDraft, startAutoSave } from './lib/persistence';
import { useProjectionSync } from './lib/projection-sync';
import { useLayoutStore } from './lib/store';

export function App() {
  // Restore last draft from localStorage and start auto-saving on layout changes.
  useEffect(() => {
    const draft = loadDraft();
    if (draft) {
      useLayoutStore.setState({ layout: draft });
      // Reset undo history so the loaded draft becomes the new baseline.
      useLayoutStore.temporal.getState().clear();
    }
    const stop = startAutoSave();
    return () => stop();
  }, []);

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
    </div>
  );
}
