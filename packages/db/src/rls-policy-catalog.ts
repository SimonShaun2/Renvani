/**
 * STACK-10 — RLS policy catalog. Applied in migration `0027_stack10_tenant_rls_policies`.
 * Session variable: {@link TENANT_SESSION_GUC} from tenant-session.ts
 */
import { TENANT_SESSION_GUC } from "./tenant-session.js";

export interface RlsPolicySpec {
  table: string;
  policyName: string;
  usingExpression: string;
}

export const FS_MIGRATE_RLS_POLICY_CATALOG: RlsPolicySpec[] = [
  {
    table: "customers",
    policyName: "tenant_isolation_customers",
    usingExpression: `company_id::text = current_setting('${TENANT_SESSION_GUC}', true)`
  },
  {
    table: "import_sessions",
    policyName: "tenant_isolation_import_sessions",
    usingExpression: `company_id::text = current_setting('${TENANT_SESSION_GUC}', true)`
  },
  {
    table: "jobs",
    policyName: "tenant_isolation_jobs",
    usingExpression: `company_id::text = current_setting('${TENANT_SESSION_GUC}', true)`
  }
];
