import { create } from 'zustand';

/** Which global overlays are open (the bell, printer settings, mobile drawer, password change). */
interface UiState {
  notificationsOpen: boolean;
  printerSettingsOpen: boolean;
  drawerOpen: boolean;
  changePasswordOpen: boolean;
  changePasswordForced: boolean;
  profileOpen: boolean;
  shiftOpen: boolean;
  pwaOpen: boolean;
  set: (patch: Partial<Omit<UiState, 'set'>>) => void;
}

export const useUi = create<UiState>((set) => ({
  notificationsOpen: false,
  printerSettingsOpen: false,
  drawerOpen: false,
  changePasswordOpen: false,
  changePasswordForced: false,
  profileOpen: false,
  shiftOpen: false,
  pwaOpen: false,
  set: (patch) => set(patch),
}));
