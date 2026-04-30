import type { Layout } from './lib/types';
import type { PatternKind } from './types';

/**
 * Cross-window message protocol between the editor and the projector window.
 * Both windows are same-origin (served from the same Vite dev server), so
 * BroadcastChannel works without any setup.
 *
 * Workflow:
 *   1. User opens /projector.html in a new tab
 *   2. Drags it to the projector display, presses F11 (or it auto-fullscreens)
 *   3. Projector window broadcasts `request-layout` on mount
 *   4. Editor responds (and from then on auto-broadcasts on every change) with `set-layout`
 *   5. Projector window renders boundary + cells in real time
 */

export type ProjectionMessage =
  // Layout sync (the active calibration channel)
  | { type: 'set-layout'; layout: Layout }
  | { type: 'request-layout' }
  // Lifecycle / health
  | { type: 'projector-ready'; pixelRatio: number; innerWidth: number; innerHeight: number }
  | { type: 'projector-bye' }
  | { type: 'ping'; nonce: number }
  | { type: 'pong'; nonce: number }
  | { type: 'close' }
  // Legacy (Phase 1 colour-test demo — not used by mapper, kept for back-compat)
  | { type: 'set-color'; hex: string }
  | { type: 'set-pattern'; pattern: PatternKind }
  | { type: 'request-fullscreen' };

const CHANNEL_NAME = 'lumo-projection';

export function createProjectionChannel(): BroadcastChannel {
  return new BroadcastChannel(CHANNEL_NAME);
}

export function postProjection(channel: BroadcastChannel, msg: ProjectionMessage): void {
  channel.postMessage(msg);
}
