import type { PermissionState, ScreenDetailed, ScreenDetails } from './types';

/**
 * Browser sees the projector as a regular second monitor (HDMI-attached display).
 * The Window Management API exposes all attached displays as ScreenDetailed objects.
 *
 * Equivalent of the desktop app's `System.Windows.Forms.Screen.AllScreens`.
 */

export function isWindowManagementSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.getScreenDetails === 'function';
}

export async function queryPermission(): Promise<PermissionState> {
  if (!('permissions' in navigator)) return 'unknown';
  // Try modern name, fall back to legacy.
  for (const name of ['window-management', 'window-placement'] as const) {
    try {
      const result = await navigator.permissions.query({ name: name as PermissionName });
      return result.state as PermissionState;
    } catch {
      // try next
    }
  }
  return 'unknown';
}

export async function detectScreens(): Promise<ScreenDetailed[]> {
  const fn = window.getScreenDetails;
  if (!fn) {
    throw new Error('Window Management API desteklenmiyor. Chrome veya Edge kullanın.');
  }
  const details = await fn.call(window);
  return [...details.screens];
}

export interface ScreenDetailsHandle {
  details: ScreenDetails;
  unsubscribe: () => void;
}

/**
 * Subscribe to live screen changes (plug/unplug, resolution change). Returns the initial
 * details object plus an unsubscribe.
 */
export async function watchScreens(
  onChange: (screens: ScreenDetailed[]) => void,
): Promise<ScreenDetailsHandle> {
  const fn = window.getScreenDetails;
  if (!fn) {
    throw new Error('Window Management API desteklenmiyor.');
  }
  const details = await fn.call(window);
  const handler = () => onChange([...details.screens]);
  details.addEventListener('screenschange', handler);
  details.addEventListener('currentscreenchange', handler);
  onChange([...details.screens]);
  return {
    details,
    unsubscribe: () => {
      details.removeEventListener('screenschange', handler);
      details.removeEventListener('currentscreenchange', handler);
    },
  };
}

/**
 * Format a screen for display. Some Windows installations report empty `label`,
 * so we synthesize a sensible name.
 */
export function describeScreen(screen: ScreenDetailed, index: number): string {
  if (screen.label?.trim()) return screen.label;
  if (screen.isInternal) return `Yerleşik Ekran ${index + 1}`;
  return `Ekran ${index + 1}`;
}

export function screenKey(screen: ScreenDetailed): string {
  return `${screen.label}@${screen.left},${screen.top}#${screen.width}x${screen.height}`;
}
