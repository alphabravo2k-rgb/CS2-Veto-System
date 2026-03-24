-- ⚡ SUPABASE MIGRATION 20240001000001_rls_policies.sql
-- =============================================================================
-- Row Level Security (RLS) policies for all core tables.
-- =============================================================================

-- Enable RLS on every table
ALTER TABLE orgs ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_branding ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_map_pools ENABLE ROW LEVEL SECURITY;
ALTER TABLE veto_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Orgs: public read, authenticated create, org admin update
CREATE POLICY "orgs_public_read" ON orgs FOR SELECT USING (TRUE);
CREATE POLICY "orgs_auth_insert" ON orgs FOR INSERT 
  WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "orgs_admin_update" ON orgs FOR UPDATE 
  USING (EXISTS (
    SELECT 1 FROM org_members 
    WHERE org_id = orgs.id 
    AND user_id = auth.uid()::UUID 
    AND role = 'admin'
  ));

-- Org branding: public read, org admin write
CREATE POLICY "branding_public_read" ON org_branding FOR SELECT USING (TRUE);
CREATE POLICY "branding_admin_write" ON org_branding FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM org_members
    WHERE org_id = org_branding.org_id
    AND user_id = auth.uid()::UUID
    AND role = 'admin'
  ));

-- Users: public read (non-suspended), self write
CREATE POLICY "users_public_read" ON users FOR SELECT 
  USING (suspended = FALSE OR id = auth.uid()::UUID);
CREATE POLICY "users_self_update" ON users FOR UPDATE 
  USING (id = auth.uid()::UUID);

-- Org members: org members can read their org, admins can write
CREATE POLICY "members_org_read" ON org_members FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM org_members om2
    WHERE om2.org_id = org_members.org_id
    AND om2.user_id = auth.uid()::UUID
  ));
CREATE POLICY "members_admin_write" ON org_members FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM org_members
    WHERE org_id = org_members.org_id
    AND user_id = auth.uid()::UUID
    AND role = 'admin'
  ));

-- Tournaments: public read, org admin write
CREATE POLICY "tournaments_public_read" ON tournaments FOR SELECT USING (TRUE);
CREATE POLICY "tournaments_admin_write" ON tournaments FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM org_members
    WHERE org_id = tournaments.org_id
    AND user_id = auth.uid()::UUID
    AND role = 'admin'
  ));
CREATE POLICY "tournaments_admin_update" ON tournaments FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM org_members
    WHERE org_id = tournaments.org_id
    AND user_id = auth.uid()::UUID
    AND role = 'admin'
  ));

-- Veto sessions: public read, service role write
CREATE POLICY "veto_public_read" ON veto_sessions FOR SELECT USING (TRUE);
CREATE POLICY "veto_service_insert" ON veto_sessions FOR INSERT
  WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "veto_service_update" ON veto_sessions FOR UPDATE
  USING (auth.role() = 'service_role');

-- Audit logs: platform admin read only, service role insert
CREATE POLICY "audit_admin_read" ON audit_logs FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid()::UUID AND role = 'platform_admin'
  ));
CREATE POLICY "audit_service_insert" ON audit_logs FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- Settings: platform admin only
CREATE POLICY "settings_admin_read" ON settings FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid()::UUID AND role = 'platform_admin'
  ));
CREATE POLICY "settings_admin_write" ON settings FOR ALL
  USING (EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid()::UUID AND role = 'platform_admin'
  ));
