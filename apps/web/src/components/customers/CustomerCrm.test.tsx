import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const apiGet = vi.fn();
const uploadFile = vi.fn();
vi.mock("@/src/lib/api", () => ({ api: { get: (path: string) => apiGet(path) } }));
vi.mock("@/src/lib/upload", () => ({ uploadFile: (input: unknown) => uploadFile(input) }));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>
}));

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { buildHistoryTimelinePath, getAttachmentDownloadUrl } from "@/src/hooks/customer-crm.hooks";

import { CustomerFilesTab } from "./CustomerFilesTab";
import { CustomerHistoryFeed } from "./CustomerHistoryFeed";
import { CustomerNotesPanel } from "./CustomerNotesPanel";

const CID = "11111111-1111-4111-8111-111111111111";

function wrap(node: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
}

function item(id: string, title: string) {
  return {
    id, type: "job", occurredAt: "2026-10-01T00:00:00.000Z", title, subtitle: null, status: "completed",
    amount: null, lineage: "native", sourceSystem: null, sourceId: null, importSessionId: null, href: null
  };
}

beforeEach(() => {
  apiGet.mockReset();
  uploadFile.mockReset();
});
afterEach(() => cleanup());

describe("customer CRM helpers", () => {
  it("builds paged history-timeline paths", () => {
    expect(buildHistoryTimelinePath(CID)).toBe(`/api/v1/customers/${CID}/history-timeline?limit=20`);
    expect(buildHistoryTimelinePath(CID, "abc")).toBe(`/api/v1/customers/${CID}/history-timeline?limit=20&cursor=abc`);
  });

  it("mints a signed download URL", async () => {
    apiGet.mockResolvedValue({ download: { url: "https://signed/x", expiresAt: "", objectKey: "k" } });
    await expect(getAttachmentDownloadUrl("a 1")).resolves.toBe("https://signed/x");
    expect(apiGet).toHaveBeenCalledWith("/api/v1/attachments/a%201/download-url");
  });
});

describe("CustomerHistoryFeed", () => {
  it("loads the next page with the cursor", async () => {
    apiGet
      .mockResolvedValueOnce({ customerId: CID, items: [item("1", "First job")], nextCursor: "c2" })
      .mockResolvedValueOnce({ customerId: CID, items: [item("2", "Second job")], nextCursor: null });
    wrap(<CustomerHistoryFeed customerId={CID} />);
    await screen.findByText("First job");
    fireEvent.click(screen.getByRole("button", { name: "Load more" }));
    await screen.findByText("Second job");
    expect(apiGet).toHaveBeenLastCalledWith(expect.stringContaining("cursor=c2"));
    expect(screen.queryByRole("button", { name: "Load more" })).toBeNull();
  });
});

describe("CustomerNotesPanel", () => {
  it("renders notes from /customers/:id/notes", async () => {
    apiGet.mockResolvedValue({
      notes: [{ id: "n1", customerId: CID, authorId: null, content: "Gate code 2290", isInternal: true, notedAt: null, createdAt: "2026-10-01T00:00:00.000Z" }]
    });
    wrap(<CustomerNotesPanel customerId={CID} />);
    await screen.findByText("Gate code 2290");
    expect(apiGet).toHaveBeenCalledWith(`/api/v1/customers/${CID}/notes`);
  });
});

describe("CustomerFilesTab", () => {
  const doc = {
    id: "f1", fileName: "invoice.pdf", fileType: "document", fileUrl: "https://raw/unsigned", thumbnailUrl: null,
    caption: null, photoType: null, fileSizeBytes: 2048, createdAt: "2026-10-01T00:00:00.000Z"
  };

  it("opens files through a freshly signed URL", async () => {
    const tab = { opener: {}, location: { href: "" }, close: vi.fn() };
    vi.spyOn(window, "open").mockReturnValue(tab as unknown as Window);
    apiGet.mockImplementation(async (path: string) =>
      path.includes("download-url")
        ? { download: { url: "https://signed/f1", expiresAt: "", objectKey: "k" } }
        : { data: [doc], total: 1, page: 1, limit: 100, totalPages: 1 }
    );
    wrap(<CustomerFilesTab customerId={CID} />);
    fireEvent.click(await screen.findByRole("button", { name: "Download" }));
    await waitFor(() => expect(tab.location.href).toBe("https://signed/f1"));
    expect(tab.opener).toBeNull();
  });

  it("uploads to the customer and surfaces errors", async () => {
    apiGet.mockResolvedValue({ data: [], total: 0, page: 1, limit: 100, totalPages: 1 });
    uploadFile.mockRejectedValue(new Error("This file type is not supported"));
    wrap(<CustomerFilesTab customerId={CID} />);
    const input = await screen.findByLabelText("Upload files");
    const file = new File(["x"], "a.exe", { type: "application/octet-stream" });
    fireEvent.change(input, { target: { files: [file] } });
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "This file type is not supported");
    expect(uploadFile).toHaveBeenCalledWith(expect.objectContaining({ file, entityType: "customer", entityId: CID }));
  });
});
