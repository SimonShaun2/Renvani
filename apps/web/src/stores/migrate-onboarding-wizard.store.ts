"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { MigrateOnboardingWizardStep } from "@fsm/types";

interface MigrateOnboardingWizardStore {
  bundleId: string | null;
  lastWizardStep: MigrateOnboardingWizardStep | null;
  setBundle: (bundleId: string, wizardStep: MigrateOnboardingWizardStep) => void;
  clearBundle: () => void;
}

export const useMigrateOnboardingWizardStore = create<MigrateOnboardingWizardStore>()(
  persist(
    (set) => ({
      bundleId: null,
      lastWizardStep: null,
      setBundle: (bundleId, lastWizardStep) => set({ bundleId, lastWizardStep }),
      clearBundle: () => set({ bundleId: null, lastWizardStep: null })
    }),
    { name: "migrate-onboarding-wizard-v1" }
  )
);
