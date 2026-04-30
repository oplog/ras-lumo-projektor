import { create } from 'zustand';
import type { PatternKind, PermissionState, ProjectorSession, ScreenDetailed } from './types';

interface ControlState {
  permission: PermissionState;
  screens: ScreenDetailed[];
  selectedScreenLabel: string | null;
  projectorSession: ProjectorSession | null;
  projectorWindow: Window | null;
  projectorAlive: boolean;
  currentColor: string;
  currentPattern: PatternKind;
  identifyRunning: boolean;

  setPermission: (state: PermissionState) => void;
  setScreens: (screens: ScreenDetailed[]) => void;
  selectScreen: (label: string | null) => void;
  setProjectorSession: (s: ProjectorSession | null) => void;
  setProjectorWindow: (w: Window | null) => void;
  setProjectorAlive: (alive: boolean) => void;
  setColor: (hex: string) => void;
  setPattern: (p: PatternKind) => void;
  setIdentifyRunning: (running: boolean) => void;
}

export const useControlStore = create<ControlState>((set) => ({
  permission: 'unknown',
  screens: [],
  selectedScreenLabel: null,
  projectorSession: null,
  projectorWindow: null,
  projectorAlive: false,
  currentColor: '#000000',
  currentPattern: 'none',
  identifyRunning: false,

  setPermission: (permission) => set({ permission }),
  setScreens: (screens) => set({ screens }),
  selectScreen: (selectedScreenLabel) => set({ selectedScreenLabel }),
  setProjectorSession: (projectorSession) => set({ projectorSession }),
  setProjectorWindow: (projectorWindow) => set({ projectorWindow }),
  setProjectorAlive: (projectorAlive) => set({ projectorAlive }),
  setColor: (currentColor) => set({ currentColor }),
  setPattern: (currentPattern) => set({ currentPattern }),
  setIdentifyRunning: (identifyRunning) => set({ identifyRunning }),
}));
