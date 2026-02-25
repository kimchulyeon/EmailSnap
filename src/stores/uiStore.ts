import { create } from "zustand";
import type { ViewType, Project } from "../types";

type SelectedProject =
  | { type: "all" }
  | { type: "unassigned" }
  | { type: "project"; id: number; name: string; color: string };

interface UIState {
  currentView: ViewType;
  selectedProject: SelectedProject | null;
  toastMessage: string | null;

  navigateTo: (view: ViewType) => void;
  openProject: (target: "all" | "unassigned" | Project) => void;
  showToast: (message: string) => void;
  clearToast: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  currentView: "login",
  selectedProject: null,
  toastMessage: null,

  navigateTo: (view) => set({ currentView: view }),

  openProject: (target) => {
    if (target === "all") {
      set({ selectedProject: { type: "all" }, currentView: "project_mails" });
    } else if (target === "unassigned") {
      set({
        selectedProject: { type: "unassigned" },
        currentView: "project_mails",
      });
    } else {
      set({
        selectedProject: {
          type: "project",
          id: target.id,
          name: target.name,
          color: target.color,
        },
        currentView: "project_mails",
      });
    }
  },

  showToast: (message) => {
    set({ toastMessage: message });
    setTimeout(() => set({ toastMessage: null }), 3000);
  },

  clearToast: () => set({ toastMessage: null }),
}));
