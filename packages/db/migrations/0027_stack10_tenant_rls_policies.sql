-- STACK-10: tenant RLS policies generated from rls-policy-catalog.ts (do not edit by hand)
ALTER TABLE "customers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "customers" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_customers" ON "customers" FOR ALL USING (company_id::text = current_setting('app.current_company_id', true));
ALTER TABLE "import_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "import_sessions" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_import_sessions" ON "import_sessions" FOR ALL USING (company_id::text = current_setting('app.current_company_id', true));
ALTER TABLE "jobs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "jobs" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_jobs" ON "jobs" FOR ALL USING (company_id::text = current_setting('app.current_company_id', true));
