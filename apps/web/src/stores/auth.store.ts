"use client";

import { create } from "zustand";

import type { AuthCompany, AuthUser } from "@/src/lib/auth";
import { clearFieldWorkQueues } from "@/src/lib/field-work-queue";

interface AuthStore {
  user: AuthUser | null;
  company: AuthCompany | null;
  token: string | null;
  hydrateSession: (user: AuthUser, company: AuthCompany) => void;
  setAuth: (user: AuthUser, company: AuthCompany, token: string) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  company: null,
  token: null,
  hydrateSession: (user, company) => {
    set({ user, company, token: null });
  },
  setAuth: (user, company, token) => {
    set({
      user,
      company,
      token
    });
  },
  clearAuth: () => {
    clearFieldWorkQueues();
    set({
      user: null,
      company: null,
      token: null
    });
  }
}));
