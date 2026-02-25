import { create } from "zustand";
import type { AppSettings, CategoryRule } from "../types";
import { DEFAULT_SETTINGS } from "../types";
import {
  getSetting,
  setSetting,
  getCategoryRules,
  upsertCategoryRule,
  deleteCategoryRule,
} from "../services/db";

interface SettingsState {
  settings: AppSettings;
  rules: CategoryRule[];
  loaded: boolean;

  loadSettings: () => Promise<void>;
  updateSetting: <K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K]
  ) => Promise<void>;
  loadRules: () => Promise<void>;
  saveRule: (rule: Omit<CategoryRule, "id"> & { id?: number }) => Promise<void>;
  removeRule: (id: number) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: { ...DEFAULT_SETTINGS },
  rules: [],
  loaded: false,

  loadSettings: async () => {
    const keys = Object.keys(DEFAULT_SETTINGS) as (keyof AppSettings)[];
    const loaded = { ...DEFAULT_SETTINGS };

    for (const key of keys) {
      const value = await getSetting(key);
      if (value !== null) {
        const type = typeof DEFAULT_SETTINGS[key];
        if (type === "number") {
          (loaded as Record<string, unknown>)[key] = Number(value);
        } else if (type === "boolean") {
          (loaded as Record<string, unknown>)[key] = value === "true";
        } else {
          (loaded as Record<string, unknown>)[key] = value;
        }
      }
    }

    set({ settings: loaded, loaded: true });
  },

  updateSetting: async (key, value) => {
    await setSetting(key, String(value));
    set((state) => ({
      settings: { ...state.settings, [key]: value },
    }));
  },

  loadRules: async () => {
    const rules = await getCategoryRules();
    set({ rules });
  },

  saveRule: async (rule) => {
    await upsertCategoryRule(rule);
    await get().loadRules();
  },

  removeRule: async (id) => {
    await deleteCategoryRule(id);
    await get().loadRules();
  },
}));
