import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createLangfuseHttpTraceSink,
  createNoopLangfuseTraceSink,
  getLangfuseTraceSink,
  recordAgentAuditObservation,
  recordImportAiObservation,
  resetLangfuseTraceSinkForTests
} from "./client.js";
import { buildAgentActivityAuditPayloadV1 } from "@fsm/types";

const audit = buildAgentActivityAuditPayloadV1({
  lifecycle: "proposal_approved",
  policyVersion: "agent-policy-v1",
  agentProduct: "revenue",
  actionType: "message.send_proposed",
  requiresApproval: true,
  agentActionId: "00000000-0000-4000-8000-000000000001",
  loyaltyRemindersDryRun: true,
  loyaltyRemindersEnabled: false
});

afterEach(() => {
  resetLangfuseTraceSinkForTests();
  vi.unstubAllGlobals();
  delete process.env.LANGFUSE_PUBLIC_KEY;
  delete process.env.LANGFUSE_SECRET_KEY;
  delete process.env.LANGFUSE_BASE_URL;
});

describe("langfuse client stub", () => {
  it("no-ops without credentials", async () => {
    const sink = createNoopLangfuseTraceSink();
    await expect(
      sink.recordAgentAudit({
        companyId: "00000000-0000-4000-8000-000000000010",
        eventType: "agent.proposal_approved",
        summary: "approved",
        audit,
        occurredAt: new Date().toISOString()
      })
    ).resolves.toBeUndefined();
  });

  it("uses noop sink from factory when env is unset", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await recordAgentAuditObservation({
      companyId: "00000000-0000-4000-8000-000000000010",
      eventType: "agent.proposal_approved",
      summary: "approved",
      audit,
      occurredAt: new Date().toISOString()
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(getLangfuseTraceSink()).toBe(getLangfuseTraceSink());
  });

  it("posts ingestion payload when credentials are configured", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response("", { status: 200 }));
    const sink = createLangfuseHttpTraceSink({
      config: {
        LANGFUSE_PUBLIC_KEY: "pk-lf-test",
        LANGFUSE_SECRET_KEY: "sk-lf-test",
        LANGFUSE_BASE_URL: "https://langfuse.example.com"
      },
      fetchImpl: fetchMock
    });

    await sink.recordAgentAudit({
      companyId: "00000000-0000-4000-8000-000000000010",
      eventType: "agent.proposal_approved",
      summary: "approved",
      audit,
      occurredAt: "2026-10-23T00:00:00.000Z"
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const firstCall = fetchMock.mock.calls[0];
    expect(firstCall).toBeDefined();
    const [url, init] = firstCall as [string, RequestInit];
    expect(url).toBe("https://langfuse.example.com/api/public/ingestion");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({
      "X-Langfuse-Public-Key": "pk-lf-test",
      "X-Langfuse-Secret-Key": "sk-lf-test"
    });
  });

  it("posts import AI trace with importSessionId metadata", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response("", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    process.env.LANGFUSE_PUBLIC_KEY = "pk-lf-test";
    process.env.LANGFUSE_SECRET_KEY = "sk-lf-test";
    process.env.LANGFUSE_BASE_URL = "https://langfuse.example.com";

    await recordImportAiObservation({
      companyId: "00000000-0000-4000-8000-000000000010",
      importSessionId: "00000000-0000-4000-8000-000000000020",
      entityType: "customers",
      outcome: "succeeded",
      headerCount: 4,
      mappedColumnCount: 3,
      occurredAt: "2026-10-23T00:00:00.000Z"
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as {
      batch: Array<{ body: { name: string; metadata: Record<string, unknown> } }>;
    };
    expect(body.batch[0]?.body.name).toBe("import.ai_column_mapping");
    expect(body.batch[0]?.body.metadata.importSessionId).toBe("00000000-0000-4000-8000-000000000020");
  });
});
