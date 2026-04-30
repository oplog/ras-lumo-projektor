/**
 * W3C Window Management API types.
 *
 * Spec: https://w3c.github.io/window-management/
 * Browser support: Chromium-based browsers (Chrome, Edge) with permission.
 *
 * The legacy permission name was 'window-placement'; current spec uses 'window-management'.
 * We try both during permission queries for maximum compatibility.
 */

export interface ScreenDetailed extends Screen {
  readonly availLeft: number;
  readonly availTop: number;
  readonly availWidth: number;
  readonly availHeight: number;
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
  readonly isPrimary: boolean;
  readonly isInternal: boolean;
  readonly devicePixelRatio: number;
  readonly label: string;
}

export interface ScreenDetails extends EventTarget {
  readonly screens: readonly ScreenDetailed[];
  readonly currentScreen: ScreenDetailed;
  oncurrentscreenchange: ((this: ScreenDetails, ev: Event) => unknown) | null;
  onscreenschange: ((this: ScreenDetails, ev: Event) => unknown) | null;
}

declare global {
  interface Window {
    getScreenDetails?: () => Promise<ScreenDetails>;
  }
}

export type PermissionState = 'unknown' | 'prompt' | 'granted' | 'denied' | 'unsupported';

export type PatternKind = 'none' | 'grid' | 'crosshair' | 'corners' | 'all';

export interface ProjectorSession {
  screenLabel: string;
  bounds: { left: number; top: number; width: number; height: number };
  openedAt: number;
}
