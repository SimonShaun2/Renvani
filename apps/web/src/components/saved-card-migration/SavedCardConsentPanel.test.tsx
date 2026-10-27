import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SAVED_CARD_OFF_SESSION_CONSENT_ACK_TEXT } from "@fsm/types";

const state = vi.hoisted(() => ({
  role: "owner" as string,
  data: null as unknown,
  mutateAsync: vi.fn()
}));

vi.mock("@/src/stores/auth.store", () => ({
  useAuthStore: (sel: (s: { user: { role: string } }) => unknown) => sel({ user: { role: state.role } })
}));
vi.mock("@/src/lib/auth", () => ({ getStoredSession: () => null }));
vi.mock("@/src/hooks/saved-card-migration.hooks", () => ({
  useSavedCardMigration: (_id: string, enabled: boolean) => ({
    isLoading: false,
    isError: false,
    data: enabled ? state.data : undefined
  }),
  useApplySavedCardMappings: () => ({ mutateAsync: state.mutateAsync, isPending: false })
}));

import { ApiError } from "@/src/lib/api";
import { SavedCardConsentPanel } from "./SavedCardConsentPanel";
import { SAVED_CARD_CONSENT_LEGAL_DRAFT_TEXT, SAVED_CARD_CONSENT_VERSION_MISMATCH } from "./saved-card-consent.copy";

const uuid = "11111111-1111-4111-8111-111111111111";
const migration = {
  id: uuid,
  companyId: uuid,
  importBundleId: uuid,
  status: "mapping",
  priorProcessorName: "Square",
  stripeImportReference: "imp_1",
  mappingSummary: { matched: 1, unmatched: 1, failed: 0, total: 2 },
  customerMappings: [
    { renvaniCustomerId: uuid, email: null, stripeCustomerId: "cus_1", stripePaymentMethodId: "pm_1", matchMethod: "renvani_customer_id", status: "pending", paymentMethodLabel: "Visa 4242" },
    { renvaniCustomerId: null, email: null, stripeCustomerId: "cus_2", stripePaymentMethodId: "pm_2", matchMethod: "unmatched", status: "pending" }
  ],
  lastError: null,
  fallbackEmailSentAt: null,
  completedAt: null,
  createdAt: "2026-10-26T00:00:00.000Z",
  updatedAt: "2026-10-26T00:00:00.000Z",
  stripePanImportInstructionsUrl: "https://example.com"
};

describe("SavedCardConsentPanel", () => {
  beforeEach(() => {
    state.role = "owner";
    state.data = { migration, consent: { text: "API consent text verbatim.", version: "v1-draft" } };
    state.mutateAsync = vi.fn().mockResolvedValue({ migration });
  });
  afterEach(() => cleanup());

  it("renders API text verbatim with DRAFT marker and no card data", () => {
    render(<SavedCardConsentPanel bundleId={uuid} />);
    expect(screen.getByTestId("saved-card-consent-text").textContent).toBe("API consent text verbatim.");
    expect(screen.getByText(/DRAFT · pending lawyer review/)).toBeTruthy();
    expect(screen.queryByText(/4242/)).toBeNull();
    expect(screen.queryByText(/pm_1|cus_1/)).toBeNull();
  });

  it("disables apply until ticked, then sends GET version and matched rows", async () => {
    render(<SavedCardConsentPanel bundleId={uuid} />);
    const button = screen.getByRole("button", { name: /Apply 1 mapping/ }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    fireEvent.click(screen.getByRole("checkbox"));
    expect(button.disabled).toBe(false);
    fireEvent.click(button);
    await waitFor(() => expect(state.mutateAsync).toHaveBeenCalledTimes(1));
    expect(state.mutateAsync).toHaveBeenCalledWith({
      ownerOffSessionConsentAcknowledged: true,
      ownerOffSessionConsentVersion: "v1-draft",
      rows: [{ stripeCustomerId: "cus_1", stripePaymentMethodId: "pm_1", renvaniCustomerId: uuid }]
    });
  });

  it("shows reload message on 400 version mismatch", async () => {
    state.mutateAsync = vi.fn().mockRejectedValue(
      new ApiError(400, { error: "VALIDATION_ERROR", message: "Consent version does not match the current saved-card consent text; reload and acknowledge again" } as never)
    );
    render(<SavedCardConsentPanel bundleId={uuid} />);
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /Apply/ }));
    expect((await screen.findByRole("alert")).textContent).toBe(SAVED_CARD_CONSENT_VERSION_MISMATCH);
  });

  it("renders nothing for non owner/admin roles", () => {
    state.role = "dispatcher";
    const { container } = render(<SavedCardConsentPanel bundleId={uuid} />);
    expect(container.textContent).toBe("");
  });

  it("local legal draft copy matches the API contract text", () => {
    expect(SAVED_CARD_CONSENT_LEGAL_DRAFT_TEXT).toBe(SAVED_CARD_OFF_SESSION_CONSENT_ACK_TEXT);
  });

  // The Legal draft file only exists on the dev box. Only a missing file (ENOENT) skips;
  // any other read error or a failed assertion fails the test.
  it("Legal draft saved-card-ack.md contains the consent text (skips only if the file is missing: ENOENT)", (ctx) => {
    let md: string;
    try {
      md = readFileSync("/workspace/legal/saved-card-ack.md", "utf8");
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        ctx.skip("ENOENT: /workspace/legal/saved-card-ack.md not present; legal file check skipped");
        return;
      }
      throw err;
    }
    expect(md).toContain(SAVED_CARD_CONSENT_LEGAL_DRAFT_TEXT);
  });
});
