// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { JobDetail } from "@fsm/types";

const m = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), upload: vi.fn(), push: vi.fn() }));
vi.mock("@/src/lib/api", () => ({ api: { get: m.get, post: m.post } }));
vi.mock("@/src/lib/upload", () => ({ uploadFile: m.upload }));
vi.mock("@/src/lib/field-work-queue", () => ({ getDeviceId: () => "web-dev-1" }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: m.push }) }));
vi.mock("next/link", () => ({ default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a> }));

import { CrewSignatureForm } from "./CrewSignature";
import { buildSignatureBatch, deriveSignatureState, signatureJobLine, signatureMetaLine } from "./crew-signature";

const JOB_ID = "11111111-1111-4111-8111-111111111111";
const UPDATED = "2026-10-29T17:00:00.000Z";
const job = {
  id: JOB_ID, jobNumber: "J-4519", title: "No-heat diagnostic", updatedAt: UPDATED,
  signatureUrl: null, signedAt: null, signedByName: null,
  customer: { id: "c1", firstName: "Dana", lastName: "Whitfield" }
} as unknown as JobDetail;

function renderForm(j: JobDetail = job) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <CrewSignatureForm job={j} />
    </QueryClientProvider>
  );
}
const state = () => screen.getByTestId("crew-signature").getAttribute("data-state");
function draw() {
  const pad = screen.getByTestId("signature-pad");
  fireEvent.pointerDown(pad, { clientX: 10, clientY: 20, pointerId: 1 });
  fireEvent.pointerMove(pad, { clientX: 40, clientY: 50, pointerId: 1 });
  fireEvent.pointerUp(pad, { pointerId: 1 });
}
const btn = (name: string) => screen.getByRole("button", { name }) as HTMLButtonElement;

beforeEach(() => {
  Object.values(m).forEach((f) => f.mockReset());
  HTMLCanvasElement.prototype.toBlob = function (cb: BlobCallback) { cb(new Blob(["png"], { type: "image/png" })); };
  m.upload.mockResolvedValue({ id: "22222222-2222-4222-8222-222222222222" });
  m.get.mockResolvedValue({ job: { ...job, signedByName: "Dana Whitfield", signedAt: "2026-10-29T16:58:00.000Z", signatureUrl: "https://cdn.example/s.png" } });
});
afterEach(() => cleanup());

describe("crew signature helpers", () => {
  it("derives states and lines", () => {
    expect(deriveSignatureState({ saved: false, saving: false, failed: false, strokes: 0 })).toBe("empty");
    expect(deriveSignatureState({ saved: false, saving: false, failed: false, strokes: 1 })).toBe("drawing");
    expect(deriveSignatureState({ saved: false, saving: true, failed: false, strokes: 1 })).toBe("saving");
    expect(deriveSignatureState({ saved: false, saving: false, failed: true, strokes: 1 })).toBe("error");
    expect(deriveSignatureState({ saved: true, saving: false, failed: false, strokes: 1 })).toBe("saved");
    expect(signatureJobLine(job)).toBe("J-4519 · No-heat diagnostic");
    expect(signatureMetaLine("Dana Whitfield", null)).toBe("Dana Whitfield");
    expect(signatureMetaLine("Dana", "2026-10-29T16:58:00")).toMatch(/^Dana · Oct 29, 2026 · 4:58 PM$/);
  });
  it("builds the job.signature.capture batch", () => {
    const body = buildSignatureBatch({ jobId: JOB_ID, jobUpdatedAt: UPDATED, attachmentId: "a1", signedByName: " Dana ", deviceId: "d", operationId: "op1" });
    expect(body.operations[0]).toEqual({
      sequence: 1, clientOperationId: "op1", jobId: JOB_ID, type: "job.signature.capture",
      baseRecordVersion: `rv1:job:${JOB_ID}:${UPDATED}`, payload: { attachmentId: "a1", signedByName: "Dana" }
    });
  });
});

describe("CrewSignatureForm", () => {
  it("Empty: Save and Clear disabled, header and signer prefilled", () => {
    renderForm();
    expect(state()).toBe("empty");
    expect(btn("Save signature").disabled).toBe(true);
    expect(btn("Clear").disabled).toBe(true);
    expect(screen.getByText("Customer signature")).toBeTruthy();
    expect(screen.getByTestId("signature-job-line").textContent).toBe("J-4519 · No-heat diagnostic");
    expect((screen.getByLabelText("Signed by") as HTMLInputElement).value).toBe("Dana Whitfield");
    expect(screen.getByTestId("signature-pad").className).toContain("pad");
  });

  it("Drawing: both enabled; Clear resets to Empty", () => {
    renderForm();
    draw();
    expect(state()).toBe("drawing");
    expect(btn("Save signature").disabled).toBe(false);
    expect(btn("Clear").disabled).toBe(false);
    fireEvent.click(btn("Clear"));
    expect(state()).toBe("empty");
  });

  it("Saving: locks pad and shows spinner text, then Saved posts the right payload", async () => {
    let release!: (v: unknown) => void;
    m.post.mockReturnValue(new Promise((r) => (release = r)));
    renderForm();
    draw();
    await act(async () => { fireEvent.click(btn("Save signature")); });
    expect(state()).toBe("saving");
    expect(screen.getByText("Saving signature…")).toBeTruthy();
    expect(screen.getByTestId("signature-pad").className).toContain("pointer-events-none");
    expect(btn("Clear").disabled).toBe(true);
    expect(m.upload).toHaveBeenCalledWith(expect.objectContaining({ entityType: "job", entityId: JOB_ID }));
    const [path, body] = m.post.mock.calls[0]!;
    expect(path).toBe("/api/v1/field-work/sync/batches");
    expect(body.operations[0].payload).toEqual({ attachmentId: "22222222-2222-4222-8222-222222222222", signedByName: "Dana Whitfield" });
    expect(body.deviceId).toBe("web-dev-1");
    await act(async () => { release({ results: [{ outcome: "applied" }] }); });
    expect(state()).toBe("saved");
    expect(screen.getByText("✓ Signature saved")).toBeTruthy();
    expect(screen.getByText("Read-only")).toBeTruthy();
    expect(screen.getByTestId("signature-meta").textContent).toMatch(/^Dana Whitfield · Oct 29, 2026 · /);
    expect((screen.getByLabelText("Signed by") as HTMLInputElement).readOnly).toBe(true);
    fireEvent.click(btn("Done"));
    expect(m.push).toHaveBeenCalledWith(`/mobile/jobs/${JOB_ID}`);
  });

  const opOf = (i: number) => m.post.mock.calls[i]![1].operations[0];
  const LIVE = `rv1:job:${JOB_ID}:2026-10-29T17:05:00.000Z`;

  it("Error on conflict: banner + Retry, strokes kept; retry uses a NEW op id and the liveRecordVersion", async () => {
    m.post
      .mockResolvedValueOnce({ results: [{ outcome: "conflict", conflict: { liveRecordVersion: LIVE, reason: "signature differs" } }] })
      .mockResolvedValueOnce({ results: [{ outcome: "applied" }] });
    renderForm();
    draw();
    await act(async () => { fireEvent.click(btn("Save signature")); });
    expect(state()).toBe("error");
    expect(screen.queryByText("✓ Signature saved")).toBeNull();
    expect(screen.getByRole("alert").textContent).toBe("We couldn't save the signature. Try again.");
    expect(screen.getByText("Your strokes are kept.")).toBeTruthy();
    expect(btn("Clear").disabled).toBe(false);
    await act(async () => { fireEvent.click(btn("Retry")); });
    expect(state()).toBe("saved");
    expect(m.upload).toHaveBeenCalledTimes(1);
    expect(m.post).toHaveBeenCalledTimes(2);
    expect(opOf(1).clientOperationId).not.toBe(opOf(0).clientOperationId);
    expect(opOf(1).baseRecordVersion).toBe(LIVE);
  });

  it("never shows Saved for rejected; retry uses a new op id with a re-read base", async () => {
    m.post.mockResolvedValueOnce({ results: [{ outcome: "rejected", code: "STALE" }] }).mockResolvedValueOnce({ results: [{ outcome: "duplicate" }] });
    renderForm();
    draw();
    await act(async () => { fireEvent.click(btn("Save signature")); });
    expect(state()).toBe("error");
    expect(screen.queryByText("✓ Signature saved")).toBeNull();
    await act(async () => { fireEvent.click(btn("Retry")); });
    expect(opOf(1).clientOperationId).not.toBe(opOf(0).clientOperationId);
    expect(state()).toBe("saved");
  });

  it("HTTP 409 / 400 show the error state (strokes kept) and rotate the op id", async () => {
    m.post
      .mockRejectedValueOnce(Object.assign(new Error("conflict"), { status: 409, payload: { conflict: { liveRecordVersion: LIVE } } }))
      .mockRejectedValueOnce(Object.assign(new Error("bad"), { status: 400, payload: {} }));
    renderForm();
    draw();
    await act(async () => { fireEvent.click(btn("Save signature")); });
    expect(state()).toBe("error");
    expect(screen.getByText("Your strokes are kept.")).toBeTruthy();
    await act(async () => { fireEvent.click(btn("Retry")); });
    expect(state()).toBe("error");
    expect(screen.queryByText("✓ Signature saved")).toBeNull();
    expect(opOf(1).clientOperationId).not.toBe(opOf(0).clientOperationId);
    expect(opOf(1).baseRecordVersion).toBe(LIVE);
  });

  it("network / 5xx retry reuses the same op id and base", async () => {
    m.post
      .mockRejectedValueOnce(Object.assign(new Error("down"), { status: 503, payload: {} }))
      .mockResolvedValueOnce({ results: [{ outcome: "duplicate" }] });
    renderForm();
    draw();
    await act(async () => { fireEvent.click(btn("Save signature")); });
    expect(state()).toBe("error");
    await act(async () => { fireEvent.click(btn("Retry")); });
    expect(state()).toBe("saved");
    expect(opOf(1).clientOperationId).toBe(opOf(0).clientOperationId);
    expect(opOf(1).baseRecordVersion).toBe(opOf(0).baseRecordVersion);
  });

  it("Saved on load when the job already has a signature", () => {
    renderForm({ ...job, signatureUrl: "https://cdn.example/s.png", signedByName: "Dana Whitfield", signedAt: "2026-10-29T16:58:00.000Z" } as unknown as JobDetail);
    expect(state()).toBe("saved");
    expect(screen.getByAltText("Signature of Dana Whitfield")).toBeTruthy();
  });
});
