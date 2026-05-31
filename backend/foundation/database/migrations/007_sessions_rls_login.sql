-- Sessions: allow SELECT/DELETE by token for auth without pre-set tenant context.
-- Writes remain tenant-scoped via INSERT policy.

DROP POLICY IF EXISTS tenant_isolation ON platform.sessions;

CREATE POLICY sessions_select ON platform.sessions
    FOR SELECT
    USING (true);

CREATE POLICY sessions_insert ON platform.sessions
    FOR INSERT
    WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

CREATE POLICY sessions_delete ON platform.sessions
    FOR DELETE
    USING (true);
