import type { Options } from "postgres";

import { coreEnv as env } from "@fsm/config/runtime-env";

export interface ProcessConnectionRole {
  role: "api" | "worker" | "webhook" | "migration";
  replicaCount: number;
}

export interface ConnectionBudgetInput {
  serviceMaxConnections: number;
  reservedForAdmin: number;
  processes: ProcessConnectionRole[];
  poolMaxPerProcess: number;
}

export interface ConnectionBudgetResult {
  aggregateClientConnections: number;
  headroom: number;
  withinServiceLimit: boolean;
  breakdown: Array<{ role: string; connections: number }>;
}

export function resolveDatabasePoolMax(): number {
  if (env.DATABASE_POOL_MAX !== undefined) {
    return env.DATABASE_POOL_MAX;
  }

  return env.NODE_ENV === "test" ? 1 : 10;
}

export function buildPostgresClientOptions(): Options<Record<string, never>> {
  return {
    max: resolveDatabasePoolMax(),
    idle_timeout: env.DATABASE_IDLE_TIMEOUT_SECONDS,
    connect_timeout: env.DATABASE_CONNECT_TIMEOUT_SECONDS,
    prepare: false,
    connection: {
      application_name: `fsm-${process.env.FSM_PROCESS_ROLE ?? "app"}`
    }
  };
}

export function computeConnectionBudget(input: ConnectionBudgetInput): ConnectionBudgetResult {
  const breakdown = input.processes.map((process) => ({
    role: process.role,
    connections: process.replicaCount * input.poolMaxPerProcess
  }));
  const aggregateClientConnections = breakdown.reduce((sum, row) => sum + row.connections, 0);
  const available = Math.max(0, input.serviceMaxConnections - input.reservedForAdmin);

  return {
    aggregateClientConnections,
    headroom: available - aggregateClientConnections,
    withinServiceLimit: aggregateClientConnections <= available,
    breakdown
  };
}
