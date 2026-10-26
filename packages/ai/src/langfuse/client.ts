import pino from "pino";

import { resolveLangfuseEnv, type LangfuseEnvConfig } from "@fsm/config/langfuse-env";
import type { AgentActivityAuditPayloadV1 } from "@fsm/types";

const logger = pino({
  name: "langfuse",
  level: process.env.LOG_LEVEL ?? "info"
});

export type LangfuseAgentAuditObservation = {
  companyId: string;
  eventType: string;
  summary: string;
  audit: AgentActivityAuditPayloadV1;
  actorId?: string;
  actorType?: string;
  occurredAt: string;
};

export type LangfuseImportAiObservation = {
  companyId: string;
  importSessionId: string;
  entityType: string;
  outcome: "succeeded" | "failed" | "fallback";
  headerCount: number;
  mappedColumnCount: number;
  model?: string;
  totalTokens?: number;
  errorMessage?: string;
  occurredAt: string;
};

export type LangfuseTraceSink = {
  recordAgentAudit(observation: LangfuseAgentAuditObservation): Promise<void>;
  recordImportAi(observation: LangfuseImportAiObservation): Promise<void>;
};

type LangfuseHttpSinkOptions = {
  config: LangfuseEnvConfig;
  fetchImpl?: typeof fetch;
};

/**
 * STACK-07 stub: posts a single observation to Langfuse public ingestion when configured.
 * No SDK dependency; safe to no-op in dev/CI without credentials.
 */
export function createLangfuseHttpTraceSink(options: LangfuseHttpSinkOptions): LangfuseTraceSink {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
  const baseUrl = options.config.LANGFUSE_BASE_URL.replace(/\/$/u, "");

  async function postIngestionBatch(batch: unknown[]): Promise<void> {
    const response = await fetchImpl(`${baseUrl}/api/public/ingestion`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Langfuse-Public-Key": options.config.LANGFUSE_PUBLIC_KEY,
        "X-Langfuse-Secret-Key": options.config.LANGFUSE_SECRET_KEY
      },
      body: JSON.stringify({ batch })
    });

    if (!response.ok) {
      const text = await response.text();
      logger.warn(
        { status: response.status, body: text.slice(0, 200) },
        "Langfuse ingestion returned non-success status"
      );
    }
  }

  return {
    async recordAgentAudit(observation: LangfuseAgentAuditObservation): Promise<void> {
      await postIngestionBatch([
        {
          type: "trace-create",
          body: {
            id: `${observation.audit.agentActionId}:${observation.audit.lifecycle}`,
            name: `agent.${observation.audit.lifecycle}`,
            metadata: {
              companyId: observation.companyId,
              eventType: observation.eventType,
              agentActionId: observation.audit.agentActionId,
              policyVersion: observation.audit.policyVersion,
              agentProduct: observation.audit.agentProduct,
              actionType: observation.audit.actionType,
              requiresApproval: observation.audit.requiresApproval,
              loyaltyRemindersDryRun: observation.audit.loyaltyRemindersDryRun,
              loyaltyRemindersEnabled: observation.audit.loyaltyRemindersEnabled,
              ...(observation.actorId ? { actorId: observation.actorId } : {}),
              ...(observation.actorType ? { actorType: observation.actorType } : {})
            },
            timestamp: observation.occurredAt
          }
        }
      ]);
    },
    async recordImportAi(observation: LangfuseImportAiObservation): Promise<void> {
      await postIngestionBatch([
        {
          type: "trace-create",
          body: {
            id: `${observation.importSessionId}:import-ai-column-mapping`,
            name: "import.ai_column_mapping",
            metadata: {
              companyId: observation.companyId,
              importSessionId: observation.importSessionId,
              entityType: observation.entityType,
              outcome: observation.outcome,
              headerCount: observation.headerCount,
              mappedColumnCount: observation.mappedColumnCount,
              ...(observation.model ? { model: observation.model } : {}),
              ...(observation.totalTokens !== undefined ? { totalTokens: observation.totalTokens } : {}),
              ...(observation.errorMessage ? { errorMessage: observation.errorMessage } : {})
            },
            timestamp: observation.occurredAt
          }
        }
      ]);
    }
  };
}

export function createNoopLangfuseTraceSink(): LangfuseTraceSink {
  return {
    async recordAgentAudit(): Promise<void> {
      // intentionally empty
    },
    async recordImportAi(): Promise<void> {
      // intentionally empty
    }
  };
}

let cachedSink: LangfuseTraceSink | undefined;

export function resetLangfuseTraceSinkForTests(): void {
  cachedSink = undefined;
}

export function getLangfuseTraceSink(
  env: Record<string, string | undefined> = process.env
): LangfuseTraceSink {
  if (cachedSink) {
    return cachedSink;
  }

  const resolution = resolveLangfuseEnv(env);
  if (!resolution.enabled) {
    cachedSink = createNoopLangfuseTraceSink();
    return cachedSink;
  }

  cachedSink = createLangfuseHttpTraceSink({ config: resolution.config });
  return cachedSink;
}

export async function recordAgentAuditObservation(
  observation: LangfuseAgentAuditObservation,
  env: Record<string, string | undefined> = process.env
): Promise<void> {
  const sink = getLangfuseTraceSink(env);
  await sink.recordAgentAudit(observation);
}

export async function recordImportAiObservation(
  observation: LangfuseImportAiObservation,
  env: Record<string, string | undefined> = process.env
): Promise<void> {
  const sink = getLangfuseTraceSink(env);
  await sink.recordImportAi(observation);
}
