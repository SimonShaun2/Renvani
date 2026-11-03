import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";

import { coreEnv as env } from "@fsm/config/runtime-env";

import { buildPostgresClientOptions } from "./connection-config.js";
import * as schema from "./schema.js";

const sql = postgres(env.DATABASE_URL, buildPostgresClientOptions());

export const db = drizzle(sql, {
  schema
});

export type Database = typeof db;
