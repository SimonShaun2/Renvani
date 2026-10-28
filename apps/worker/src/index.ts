import type { Worker } from "bullmq";
import pino from "pino";

import { QUEUE_NAMES, agreementsQueue, aiQueue } from "@fsm/jobs";

import { createWorker } from "./lib/worker-factory.js";
import { PLAN_REMINDER_SCAN_JOB_NAME, processAgreements } from "./processors/agreements.processor.js";
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

// Daily plan renewal + tune-up reminder scan (14:00 UTC = 8-9am US Central). No-op for companies with the rule off.
await agreementsQueue.add(
  PLAN_REMINDER_SCAN_JOB_NAME,
  {},
  {
    repeat: {
      pattern: "0 14 * * *"
    },
    jobId: "plan-reminder-scan-cron"
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
