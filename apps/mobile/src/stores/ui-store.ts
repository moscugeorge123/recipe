import { create } from 'zustand';

import type { ToastPayload, UiState } from '@/stores/contracts';

export const useUiStore = create<UiState>((set) => ({
  captureOpen: false,
  toast: null,
  openCapture: () => set({ captureOpen: true }),
  closeCapture: () => set({ captureOpen: false }),
  showToast: (toast: ToastPayload) => set({ toast }),
  hideToast: () => set({ toast: null }),
}));
