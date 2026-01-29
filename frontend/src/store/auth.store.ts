"use client";

import { create } from "zustand";

type MeResponse = { user: any | null };

type AuthState = {
  user: any | null;
  loading: boolean;
  error: string | null;

  setUser: (u: any | null) => void;
  refresh: () => Promise<any | null>;
  logout: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  loading: false,
  error: null,

  setUser: (u) => set({ user: u }),

  refresh: async () => {
    set({ loading: true, error: null });
    try {
      const r = await fetch("/api/auth/me", { cache: "no-store" });
      const j: MeResponse = await r.json().catch(() => ({ user: null }));

      // si no está logueado, puede ser 401 o user null
      const user = j?.user ?? null;
      set({ user });
      return user;
    } catch (e: any) {
      set({ user: null, error: "No se pudo obtener el usuario." });
      return null;
    } finally {
      set({ loading: false });
    }
  },

  logout: async () => {
    set({ loading: true, error: null });
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      set({ user: null, loading: false });
    }
  },
}));
