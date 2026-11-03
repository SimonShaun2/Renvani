/** PostgreSQL custom GUC for RLS policies (STACK-10). Set per transaction/request. */
export const TENANT_SESSION_GUC = "app.current_company_id";

const COMPANY_ID_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseCompanyId(companyId: string): string {
  const trimmed = companyId.trim();
  if (!COMPANY_ID_UUID_RE.test(trimmed)) {
    throw new Error("Invalid company id");
  }
  return trimmed.toLowerCase();
}

export function buildTenantSessionSetLocal(companyId: string): { sql: string; values: [string] } {
  const parsed = parseCompanyId(companyId);
  return {
    sql: `SELECT set_config('${TENANT_SESSION_GUC}', $1, true)`,
    values: [parsed]
  };
}

export function readTenantCompanyIdFromGucRow(row: { current_setting: string | null }): string | null {
  const value = row.current_setting?.trim();
  if (!value || value === "") {
    return null;
  }
  return parseCompanyId(value);
}
