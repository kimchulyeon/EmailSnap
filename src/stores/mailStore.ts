import { create } from "zustand";
import type { Mail, MailCategory, CategoryFilter } from "../types";
import { getMails, markAsRead, insertMail } from "../services/db";

interface MailState {
  mails: Mail[];
  filter: CategoryFilter;
  loading: boolean;

  fetchMails: () => Promise<void>;
  setFilter: (filter: CategoryFilter) => void;
  addMail: (mail: Omit<Mail, "created_at">) => Promise<boolean>;
  markMailAsRead: (id: string) => Promise<void>;
}

export const useMailStore = create<MailState>((set, get) => ({
  mails: [],
  filter: "all",
  loading: false,

  fetchMails: async () => {
    set({ loading: true });
    try {
      const filter = get().filter;
      const category =
        filter === "all" ? undefined : (filter as MailCategory);
      const mails = await getMails(category);
      set({ mails });
    } finally {
      set({ loading: false });
    }
  },

  setFilter: (filter: CategoryFilter) => {
    set({ filter });
    get().fetchMails();
  },

  addMail: async (mail) => {
    const inserted = await insertMail(mail);
    if (inserted) {
      await get().fetchMails();
    }
    return inserted;
  },

  markMailAsRead: async (id: string) => {
    await markAsRead(id);
    set((state) => ({
      mails: state.mails.map((m) =>
        m.id === id ? { ...m, is_read: true } : m
      ),
    }));
  },
}));
