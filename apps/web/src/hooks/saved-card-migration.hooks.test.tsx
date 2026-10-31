import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

const post = vi.hoisted(() => vi.fn());
vi.mock("@/src/lib/api", () => ({ api: { post, get: vi.fn() } }));

import { useConfirmStripeImport, useStartSavedCardMigration } from "./saved-card-migration.hooks";

describe("useConfirmStripeImport", () => {
  it("POSTs the confirm-stripe-import body through the authenticated API client", async () => {
    post.mockResolvedValue({ id: "m1" });
    const client = new QueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    const { result } = renderHook(() => useConfirmStripeImport("b1"), { wrapper });
    const body = {
      stripeImportReference: "imp_1",
      importedPaymentMethods: [{ stripeCustomerId: "cus_1", stripePaymentMethodId: "pm_1", email: "a@example.com" }]
    };
    await act(() => result.current.mutateAsync(body));
    expect(post).toHaveBeenCalledWith("/api/v1/migrate/onboarding/sessions/b1/saved-card-migration/confirm-stripe-import", body);
  });

  it("useStartSavedCardMigration POSTs start to the bundle's saved-card-migration path", async () => {
    post.mockReset();
    post.mockResolvedValue({ id: "m1", status: "awaiting_stripe_import" });
    const client = new QueryClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    const { result } = renderHook(() => useStartSavedCardMigration("b1"), { wrapper });
    const body = { priorProcessorName: "Prior", stripeImportReference: "imp_1" };
    const res = await act(() => result.current.mutateAsync(body));
    expect(post).toHaveBeenCalledWith("/api/v1/migrate/onboarding/sessions/b1/saved-card-migration", body);
    expect(res).toEqual({ id: "m1", status: "awaiting_stripe_import" });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["saved-card-migration", "b1"] });
  });
});
