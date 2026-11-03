import { parseRuntimeEnv } from "@fsm/config/runtime-env";

/** Validate required worker configuration before registering schedules or processors. */
export function assertWorkerBootEnvironment(source: Record<string, string | undefined> = process.env): void {
  parseRuntimeEnv("worker", source);
}
