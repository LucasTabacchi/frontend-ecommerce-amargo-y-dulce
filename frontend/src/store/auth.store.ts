"use client";

import { create } from "zustand";

type MeResponse = { user: any | null };

type AuthState = {
  user: any | null;
  loading: boolean;
  resolved: boolean;
  error: string | null;

  setUser: (u: any | null) => void;
  setResolved: (resolved: boolean) => void;
  setAuthState: (next: Partial<Pick<AuthState, "user" | "loading" | "resolved" | "error">>) => void;
  refresh: (opts?: { quiet?: boolean }) => Promise<any | null>;
  logout: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: false,
  resolved: false,
  error: null,

  setUser: (u) => set({ user: u }),
  setResolved: (resolved) => set({ resolved }),
  setAuthState: (next) => set((state) => ({ ...state, ...next })),

  refresh: async (opts) => {
    if (!opts?.quiet) {
      set({ loading: true, error: null });
    }
    try {
      const r = await fetch("/api/auth/me", {
        cache: "no-store",
        credentials: "include",
      });
      const j: MeResponse = await r.json().catch(() => ({ user: null }));

      const user = j?.user ?? null;
      set({ user, resolved: true, error: null });
      return user;
    } catch (e: any) {
      set({
        user: null,
        resolved: true,
        error: "No se pudo obtener el usuario.",
      });
      return null;
    } finally {
      if (!opts?.quiet) {
        set({ loading: false });
      }
    }
  },

  logout: async () => {
    set({ loading: true, error: null });
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        cache: "no-store",
        credentials: "include",
      });
    } finally {
      set({ user: null, loading: false, resolved: true });
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("amg-auth-changed"));
      }
    }
  },
}));
