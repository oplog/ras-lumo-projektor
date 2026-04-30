import { useEffect } from 'react';
import { createProjectionChannel, postProjection } from '../projection-channel';
import { useLayoutStore } from './store';

/**
 * Editor-side sync: every time the layout changes, broadcast it on the
 * lumo-projection BroadcastChannel so any open projector window can re-render.
 *
 * Also responds to `request-layout` from a freshly-opened projector window with
 * the current layout (initial sync).
 */
export function useProjectionSync(): void {
  useEffect(() => {
    const channel = createProjectionChannel();

    // Initial broadcast (in case a projector window is already listening).
    postProjection(channel, {
      type: 'set-layout',
      layout: useLayoutStore.getState().layout,
    });

    // Respond to projector windows that ask for the current layout.
    const onMessage = (ev: MessageEvent) => {
      const msg = ev.data;
      if (!msg || typeof msg !== 'object') return;
      if (msg.type === 'request-layout') {
        postProjection(channel, {
          type: 'set-layout',
          layout: useLayoutStore.getState().layout,
        });
      }
    };
    channel.addEventListener('message', onMessage);

    // Stream layout changes.
    let lastLayout = useLayoutStore.getState().layout;
    const unsub = useLayoutStore.subscribe((state) => {
      if (state.layout === lastLayout) return;
      lastLayout = state.layout;
      postProjection(channel, { type: 'set-layout', layout: state.layout });
    });

    return () => {
      channel.removeEventListener('message', onMessage);
      channel.close();
      unsub();
    };
  }, []);
}
