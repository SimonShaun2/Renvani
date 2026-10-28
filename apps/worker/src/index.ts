import type { Worker } from "bullmq";
import pino from "pino";

import { assertStripeLiveKeyAllowed } from "@fsm/config/deployment-environment";
import { QUEUE_NAMES, aiQueue } from "@fsm/jobs";

import { createWorker } from "./lib/worker-factory.js";
import { processAgreements } from "./processors/agreements.processor.js";
import { processAiRevenue } from "./processors/ai-revenue.processor.js";
import { processCsvImport } from "./processors/csv-import.processor.js";
import { processInvoiceReminder } from "./processors/invoice-reminder.processor.js";
import { processNotifications } from "./processors/notifications.processor.js";
import { processDataExport } from "./processors/data-export.processor.js";
import { processGrowthCheck } from "./processors/growth-check.processor.js";
import { processRetentionGates } from "./processors/retention-gates.processor.js";

const logger = pino({
  name: "fsm-worker-bootstrap"
});

// Boot guard: never run with a Stripe live key outside production (also enforced when env parses).
assertStripeLiveKeyAllowed(process.env);

const dormantCustomerCronPattern = "0 2 * * *";
const revenueSummaryPrewarmEveryMs = 30 * 60 * 1000;

await aiQueue.add(
  "dormant-customer-scan",
  {},
  {
    repeat: {
      pattern: dormantCustomerCronPattern
    },
    jobId: "dormant-customer-scan-cron"
  }
);

await aiQueue.add(
  "compute-revenue-summary-batch",
  {},
  {
    repeat: {
      every: revenueSummaryPrewarmEveryMs
    },
    jobId: "compute-revenue-summary-batch-cron"
  }
);

const workers: Array<Worker<Record<string, unknown>, void, string>> = [
  createWorker(QUEUE_NAMES.imports, processCsvImport),
  createWorker(QUEUE_NAMES.ai, processAiRevenue),
  createWorker(QUEUE_NAMES.notifications, processNotifications),
  createWorker(QUEUE_NAMES.invoices, processInvoiceReminder),
  createWorker(QUEUE_NAMES.agreements, processAgreements),
  createWorker(QUEUE_NAMES.operator, processRetentionGates),
  createWorker(QUEUE_NAMES.exports, processDataExport),
  createWorker(QUEUE_NAMES.growth, processGrowthCheck)
];

logger.info(
  {
    batchCronJobId: "compute-revenue-summary-batch-cron",
    cronJobId: "dormant-customer-scan-cron",
    queues: workers.length
  },
  "Workers started"
);

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  logger.info({ signal }, "Worker shutdown requested");
  await Promise.all(workers.map(async (worker) => worker.close()));
  process.exit(0);
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});
