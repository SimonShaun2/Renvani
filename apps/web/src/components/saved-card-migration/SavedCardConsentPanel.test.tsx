import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SAVED_CARD_OFF_SESSION_CONSENT_ACK_TEXT } from "@fsm/types";

const state = vi.hoisted(() => ({
  role: "owner" as string,
  data: null as unknown,
  mutateAsync: vi.fn(),
  confirmAsync: vi.fn(),
  startAsync: vi.fn()
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
  useApplySavedCardMappings: () => ({ mutateAsync: state.mutateAsync, isPending: false }),
  useConfirmStripeImport: () => ({ mutateAsync: state.confirmAsync, isPending: false }),
  useStartSavedCardMigration: () => ({ mutateAsync: state.startAsync, isPending: false })
}));

import { ApiError } from "@/src/lib/api";
import { SavedCardConsentPanel } from "./SavedCardConsentPanel";
import { SAVED_CARD_APPLY_FAILED, SAVED_CARD_START_FAILED, SAVED_CARD_CONSENT_LEGAL_DRAFT_TEXT, SAVED_CARD_CONSENT_VERSION_MISMATCH } from "./saved-card-consent.copy";

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
    state.confirmAsync = vi.fn().mockResolvedValue(migration);
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

  it("null migration -> start form -> start -> import form", async () => {
    const started = { ...migration, status: "awaiting_stripe_import", stripeImportReference: null, customerMappings: [], mappingSummary: { matched: 0, unmatched: 0, failed: 0, total: 0 } };
    state.data = { migration: null, consent: { text: "API consent text verbatim.", version: "v1-draft" } };
    state.startAsync = vi.fn().mockImplementation(async () => {
      state.data = { migration: started, consent: { text: "API consent text verbatim.", version: "v1-draft" } };
      return started;
    });
    const { rerender } = render(<SavedCardConsentPanel bundleId={uuid} />);
    expect(screen.queryByRole("form", { name: "Stripe import result" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Start saved-card migration" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/previous payment processor/);
    expect(state.startAsync).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Previous payment processor"), { target: { value: "  Prior processor  " } });
    fireEvent.change(screen.getByLabelText("Stripe import reference (optional)"), { target: { value: "imp_9" } });
    fireEvent.click(screen.getByRole("button", { name: "Start saved-card migration" }));
    await waitFor(() => expect(state.startAsync).toHaveBeenCalledWith({ priorProcessorName: "Prior processor", stripeImportReference: "imp_9" }));
    rerender(<SavedCardConsentPanel bundleId={uuid} />);
    expect(screen.getByRole("form", { name: "Stripe import result" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Start saved-card migration" })).toBeNull();
  });

  it("start omits an empty reference and shows generic copy on failure", async () => {
    state.data = { migration: null, consent: { text: "x", version: "v1-draft" } };
    state.startAsync = vi.fn().mockRejectedValue(new ApiError(409, { error: "CONFLICT", message: "raw detail" } as never));
    render(<SavedCardConsentPanel bundleId={uuid} />);
    fireEvent.change(screen.getByLabelText("Previous payment processor"), { target: { value: "Prior" } });
    fireEvent.click(screen.getByRole("button", { name: "Start saved-card migration" }));
    expect((await screen.findByRole("alert")).textContent).toBe(SAVED_CARD_START_FAILED);
    expect(state.startAsync).toHaveBeenCalledWith({ priorProcessorName: "Prior" });
  });

  it("renders nothing for non owner/admin roles", () => {
    state.role = "dispatcher";
    const { container } = render(<SavedCardConsentPanel bundleId={uuid} />);
    expect(container.textContent).toBe("");
  });

  it("local legal draft copy matches the API contract text", () => {
    expect(SAVED_CARD_CONSENT_LEGAL_DRAFT_TEXT).toBe(SAVED_CARD_OFF_SESSION_CONSENT_ACK_TEXT);
  });

  it("shows generic copy (not the raw API message) on other apply errors", async () => {
    state.mutateAsync = vi.fn().mockRejectedValue(
      new ApiError(500, { error: "INTERNAL", message: "db exploded at pm_1 cus_1" } as never)
    );
    render(<SavedCardConsentPanel bundleId={uuid} />);
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /Apply/ }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe(SAVED_CARD_APPLY_FAILED);
    expect(alert.textContent).not.toMatch(/db exploded|pm_1|cus_1/);
  });

  it("confirm-stripe-import form shows row errors and does not send invalid rows", async () => {
    render(<SavedCardConsentPanel bundleId={uuid} />);
    fireEvent.change(screen.getByLabelText("Import result rows"), {
      target: { value: "stripeCustomerId,stripePaymentMethodId,email\ncus_A1,pm_A1,a@example.com\nbad,pm_B1,\ncus_C1,pm_C1,not-an-email" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Save import result" }));
    const list = await screen.findByRole("alert", { name: "Row errors" });
    expect(list.textContent).toContain("Row 3: Invalid stripeCustomerId.");
    expect(list.textContent).toContain("Row 4: Invalid email.");
    expect(state.confirmAsync).not.toHaveBeenCalled();
  });

  it("confirm-stripe-import form sends reference + importedPaymentMethods", async () => {
    render(<SavedCardConsentPanel bundleId={uuid} />);
    fireEvent.change(screen.getByLabelText("Import result rows"), {
      target: { value: `stripeCustomerId,stripePaymentMethodId,renvaniCustomerId,email\ncus_A1,pm_A1,${uuid},\ncus_B1,pm_B1,,b@example.com` }
    });
    fireEvent.click(screen.getByRole("button", { name: "Save import result" }));
    await waitFor(() => expect(state.confirmAsync).toHaveBeenCalledTimes(1));
    expect(state.confirmAsync).toHaveBeenCalledWith({
      stripeImportReference: "imp_1",
      importedPaymentMethods: [
        { stripeCustomerId: "cus_A1", stripePaymentMethodId: "pm_A1", renvaniCustomerId: uuid },
        { stripeCustomerId: "cus_B1", stripePaymentMethodId: "pm_B1", email: "b@example.com" }
      ]
    });
    expect((await screen.findByRole("status")).textContent).toBe("2 cards added for review.");
  });
});
