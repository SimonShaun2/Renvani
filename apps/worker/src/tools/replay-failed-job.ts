import {
  agreementsQueue,
  aiQueue,
  exportsQueue,
  getQueueByName,
  growthQueue,
  importsQueue,
  invoicesQueue,
  notificationsQueue,
  operatorQueue,
  QUEUE_NAMES,
  replayFailedJobById,
  webhooksQueue
} from "@fsm/jobs";
import { env } from "@fsm/config";

const queueRegistry = {
  [QUEUE_NAMES.imports]: importsQueue,
  [QUEUE_NAMES.ai]: aiQueue,
  [QUEUE_NAMES.notifications]: notificationsQueue,
  [QUEUE_NAMES.invoices]: invoicesQueue,
  [QUEUE_NAMES.agreements]: agreementsQueue,
  [QUEUE_NAMES.webhooks]: webhooksQueue,
  [QUEUE_NAMES.operator]: operatorQueue,
  [QUEUE_NAMES.exports]: exportsQueue,
  [QUEUE_NAMES.growth]: growthQueue
};

function readArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);

  if (index === -1) {
    return undefined;
  }

  return process.argv[index + 1];
}

async function main(): Promise<void> {
  const queueName = readArg("--queue");
  const jobId = readArg("--job-id");
  const expectedCompanyId = readArg("--company-id");
  const requestedByUserId = readArg("--operator-id");
  const reason = readArg("--reason");

  if (env.SOURCE_QUEUE_REPLAY_ENABLED !== "true") {
    console.error("Source-queue replay is disabled; use the authenticated dead-letter recovery endpoint for exhausted jobs");
    process.exit(1);
  }

  if (!queueName || !jobId || !expectedCompanyId || !requestedByUserId || !reason) {
    console.error(
      "Usage: replay-failed-job --queue <name> --job-id <id> --company-id <uuid> --operator-id <uuid> --reason <text>"
    );
    process.exit(1);
  }

  if (!(queueName in queueRegistry)) {
    console.error(`Unknown queue "${queueName}". Valid: ${Object.keys(queueRegistry).join(", ")}`);
    process.exit(1);
  }

  const queue = getQueueByName(queueRegistry, queueName as (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES]);
  const result = await replayFailedJobById(queue, {
    queueName: queueName as (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES],
    jobId,
    expectedCompanyId,
    requestedByUserId,
    reason
  });

  console.log(JSON.stringify({
    ok: true,
    eventType: "queue.source_replayed",
    ...result
  }));
}

main().catch((error: unknown) => {
  console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }));
  process.exit(1);
});
