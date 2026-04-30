import type { ScreenDetailed } from './types';

/**
 * Opens a popup window targeting a specific physical screen.
 * Requires window-management permission. The `fullscreen` feature is honored on
 * Chromium-based browsers when permission has been granted.
 */
export function openOnScreen(
  url: string,
  screen: ScreenDetailed,
  windowName: string,
  fullscreen = true,
): Window | null {
  const features = [
    `left=${screen.availLeft}`,
    `top=${screen.availTop}`,
    `width=${screen.availWidth}`,
    `height=${screen.availHeight}`,
    fullscreen ? 'fullscreen' : '',
    'popup=yes',
    'menubar=no',
    'toolbar=no',
    'location=no',
    'status=no',
  ]
    .filter(Boolean)
    .join(',');

  return window.open(url, windowName, features);
}

export function openProjectorWindow(screen: ScreenDetailed): Window | null {
  return openOnScreen('/projector.html', screen, 'lumo-projector', true);
}

export function openIdentifyWindow(
  screen: ScreenDetailed,
  index: number,
  label: string,
  durationMs: number,
): Window | null {
  const params = new URLSearchParams({
    mode: 'identify',
    index: String(index),
    label,
    duration: String(durationMs),
  });
  return openOnScreen(
    `/projector.html?${params.toString()}`,
    screen,
    `lumo-identify-${index}`,
    true,
  );
}
