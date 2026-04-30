import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { loadLibrary } from './lib/library';
import './index.css';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Root element not found');

// Wait for the library to come down from R2 before first paint so the
// sidebar doesn't flash an empty state and clobber existing variants.
loadLibrary().finally(() => {
  createRoot(rootEl).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
