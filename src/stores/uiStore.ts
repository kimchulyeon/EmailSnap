import { create } from "zustand";
import type { ViewType } from "../types";

interface UIState {
  currentView: ViewType;
  toastMessage: string | null;

  navigateTo: (view: ViewType) => void;
  showToast: (message: string) => void;
  clearToast: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  currentView: "login",
  toastMessage: null,

  navigateTo: (view) => set({ currentView: view }),

  showToast: (message) => {
    set({ toastMessage: message });
    setTimeout(() => set({ toastMessage: null }), 3000);
  },

  clearToast: () => set({ toastMessage: null }),
}));
