import type { Job, Processor } from "bullmq";
import { Worker } from "bullmq";
import pino from "pino";

import { buildDefaultWorkerOptions, handleWorkerJobFailed } from "@fsm/jobs";
import {
  applyNodeObservabilityTags,
  captureNodeException,
  extractJobObservabilityContext,
  runWithObservabilityContext
} from "@fsm/observability";

const workerLogger = pino({
  name: "fsm-worker"
});

export function createWorker<TData extends Record<string, unknown>>(
  queueName: string,
  processor: Processor<TData, void, string>
): Worker<TData, void, string> {
  const logger = workerLogger.child({
    queue: queueName
  });

  const worker = new Worker<TData, void, string>(
    queueName,
    async (job) => {
      const observabilityContext = extractJobObservabilityContext(
        job.data as Record<string, unknown>,
        job.id
      );

      return runWithObservabilityContext(observabilityContext, async () => {
        applyNodeObservabilityTags(observabilityContext);

        logger.info(
          {
            jobId: job.id,
            companyId: observabilityContext.companyId,
            importSessionId: observabilityContext.importSessionId
          },
          "Worker job started"
        );

        try {
          await processor(job);
          logger.info(
            {
              jobId: job.id
            },
            "Worker job completed"
          );
        } catch (error) {
          captureNodeException(error, observabilityContext);
          logger.error(
            {
              err: error,
              jobId: job.id,
              companyId: observabilityContext.companyId,
              importSessionId: observabilityContext.importSessionId
            },
            "Worker job failed"
          );
          throw error;
        }
      });
    },
    buildDefaultWorkerOptions()
  );

  worker.on("failed", (job, error) => {
    logger.error(
      {
        err: error,
        jobId: job?.id ?? null
      },
      "Worker failure event received"
    );

    void handleWorkerJobFailed(
      queueName,
      job as Job<Record<string, unknown>> | undefined,
      error
    ).catch((dlqError) => {
      logger.error(
        {
          err: dlqError,
          jobId: job?.id ?? null
        },
        "Failed to forward job to dead-letter queue"
      );
    });
  });

  return worker;
}
