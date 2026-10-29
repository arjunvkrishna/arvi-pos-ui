import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastState {
  message: string;
  type: ToastType;
  visible: boolean;
  /** Increments on every toast so the auto-dismiss timer restarts. */
  seq: number;
  show: (message: string, type?: ToastType) => void;
  dismiss: () => void;
}

export const useToast = create<ToastState>((set) => ({
  message: '',
  type: 'success',
  visible: false,
  seq: 0,
  show: (message, type = 'success') => set((s) => ({ message, type, visible: true, seq: s.seq + 1 })),
  dismiss: () => set({ visible: false }),
}));

export const showToast = (message: string, type: ToastType = 'success') => useToast.getState().show(message, type);
