// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { JobDetail, JobProduct } from "@fsm/types";

const m = vi.hoisted(() => ({ create: vi.fn(), post: vi.fn(), push: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: m.push }) }));
vi.mock("@/src/hooks/invoices.hooks", () => ({
  useInvoices: () => ({ data: { data: [] } }),
  useCreateInvoice: () => ({ mutateAsync: m.create, isPending: false })
}));
vi.mock("@/src/hooks/price-book.hooks", () => ({ usePriceBookItemSearch: () => ({ data: undefined }) }));
vi.mock("@/src/lib/api", async (orig) => ({ ...(await orig<object>()), api: { post: m.post } }));

import { CreateInvoicePanel } from "./CreateInvoicePanel";

const products = [{ id: "p1", name: "No-heat diagnostic", quantity: "1", unitPrice: "129.00", total: "129.00", isTaxable: true, category: "service" }] as unknown as JobProduct[];
const job = { id: "j1", jobNumber: "J-1", title: "Diag", status: "completed", customerId: "c1", customer: { firstName: "Dana", lastName: "W" }, property: null } as unknown as JobDetail;

function renderPanel() {
  render(
    <CreateInvoicePanel job={job} products={products} taxRate={null} plan="flex" feePercent={2} paymentsReady confirmIncomplete={false} onClose={vi.fn()} />
  );
  fireEvent.click(screen.getByRole("switch"));
}
const createButtons = () => screen.getAllByRole("button", { name: "Create invoice" }) as HTMLButtonElement[];
const deferred = <T,>() => {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => ((resolve = res), (reject = rej)));
  return { promise, resolve, reject };
};

beforeEach(() => {
  m.create.mockReset();
  m.post.mockReset();
  m.push.mockReset();
});
afterEach(() => cleanup());

describe("CreateInvoicePanel create-and-send", () => {
  it("failed send shows an inline error with Retry, does not open the invoice, and retry sends the same invoice", async () => {
    m.create.mockResolvedValue({ invoice: { id: "inv1" } });
    m.post.mockImplementationOnce(() => {
      const p = Promise.reject(new Error("send failed"));
      p.catch(() => undefined);
      return p;
    });
    renderPanel();
    await act(async () => fireEvent.click(createButtons()[0]!));

    expect(screen.getByTestId("send-error").textContent).toContain("It has not been sent");
    expect(m.push).not.toHaveBeenCalled();
    expect(createButtons().every((b) => b.disabled)).toBe(true);
    expect((screen.getByTestId("create-invoice-form") as HTMLFieldSetElement).disabled).toBe(true);

    m.post.mockResolvedValueOnce({});
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Retry send" })));
    expect(m.create).toHaveBeenCalledTimes(1);
    expect(m.post).toHaveBeenCalledTimes(2);
    expect(m.post).toHaveBeenLastCalledWith("/api/v1/invoices/inv1/send", {});
    expect(m.push).toHaveBeenCalledWith("/invoices/inv1");
  });

  it("disables every action for the whole create-and-send sequence (no duplicate on double click)", async () => {
    const send = deferred<unknown>();
    m.create.mockResolvedValue({ invoice: { id: "inv2" } });
    m.post.mockReturnValue(send.promise);
    renderPanel();
    await act(async () => fireEvent.click(createButtons()[0]!));

    // Create finished, send still pending.
    expect(m.post).toHaveBeenCalledTimes(1);
    expect(createButtons().every((b) => b.disabled)).toBe(true);
    expect((screen.getByRole("button", { name: "Cancel" }) as HTMLButtonElement).disabled).toBe(true);
    await act(async () => {
      fireEvent.click(createButtons()[0]!);
      fireEvent.click(createButtons()[1]!);
    });
    expect(m.create).toHaveBeenCalledTimes(1);

    await act(async () => send.resolve({}));
    expect(m.push).toHaveBeenCalledWith("/invoices/inv2");
    expect(m.create).toHaveBeenCalledTimes(1);
  });
});
