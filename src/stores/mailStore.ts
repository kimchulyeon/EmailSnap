import { create } from "zustand";
import type { Mail, ProjectFilter } from "../types";
import { getMailsByProject, markAsRead, markAllAsReadByProject } from "../services/db";

interface MailState {
  mails: Mail[];
  loading: boolean;

  fetchMails: (filter: ProjectFilter) => Promise<void>;
  markMailAsRead: (id: string) => Promise<void>;
  markAllAsRead: (filter: ProjectFilter) => Promise<void>;
}

export const useMailStore = create<MailState>((set) => ({
  mails: [],
  loading: false,

  fetchMails: async (filter: ProjectFilter) => {
    set({ loading: true });
    try {
      const mails = await getMailsByProject(filter);
      set({ mails });
    } finally {
      set({ loading: false });
    }
  },

  markMailAsRead: async (id: string) => {
    await markAsRead(id);
    set((state) => ({
      mails: state.mails.map((m) =>
        m.id === id ? { ...m, is_read: true } : m
      ),
    }));
  },

  markAllAsRead: async (filter: ProjectFilter) => {
    await markAllAsReadByProject(filter);
    set((state) => ({
      mails: state.mails.map((m) => ({ ...m, is_read: true })),
    }));
  },
}));
