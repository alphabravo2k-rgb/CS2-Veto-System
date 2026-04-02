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

-- tournament_map_pools was missing ALL policies
CREATE POLICY "map_pools_public_read" ON tournament_map_pools 
  FOR SELECT USING (TRUE);
CREATE POLICY "map_pools_admin_write" ON tournament_map_pools 
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM tournaments t
      JOIN org_members om ON om.org_id = t.org_id
      WHERE t.id = tournament_map_pools.tournament_id
      AND om.user_id = auth.uid()::UUID
      AND om.role = 'admin'
    )
  );
CREATE POLICY "map_pools_admin_update" ON tournament_map_pools 
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM tournaments t
      JOIN org_members om ON om.org_id = t.org_id
      WHERE t.id = tournament_map_pools.tournament_id
      AND om.user_id = auth.uid()::UUID
      AND om.role = 'admin'
    )
  );
CREATE POLICY "map_pools_admin_delete" ON tournament_map_pools 
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM tournaments t
      JOIN org_members om ON om.org_id = t.org_id
      WHERE t.id = tournament_map_pools.tournament_id
      AND om.user_id = auth.uid()::UUID
      AND om.role = 'admin'
    )
  );

-- Enable RLS on new tables
ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;

-- refresh_tokens: user owns their tokens
CREATE POLICY "refresh_own_read" ON refresh_tokens 
  FOR SELECT USING (user_id = auth.uid()::UUID);
CREATE POLICY "refresh_own_delete" ON refresh_tokens 
  FOR DELETE USING (user_id = auth.uid()::UUID);
CREATE POLICY "refresh_service_all" ON refresh_tokens 
  FOR ALL USING (auth.role() = 'service_role');

-- player_accounts: public read, self write
CREATE POLICY "accounts_public_read" ON player_accounts 
  FOR SELECT USING (TRUE);
CREATE POLICY "accounts_self_write" ON player_accounts 
  FOR INSERT WITH CHECK (user_id = auth.uid()::UUID);
CREATE POLICY "accounts_self_update" ON player_accounts 
  FOR UPDATE USING (user_id = auth.uid()::UUID);
CREATE POLICY "accounts_self_delete" ON player_accounts 
  FOR DELETE USING (user_id = auth.uid()::UUID);

-- payments: org admin reads their own, platform admin reads all
CREATE POLICY "payments_org_read" ON payments 
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM org_members
      WHERE org_id = payments.org_id
      AND user_id = auth.uid()::UUID
    )
  );
CREATE POLICY "payments_admin_read" ON payments 
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid()::UUID AND role = 'platform_admin'
    )
  );
CREATE POLICY "payments_service_all" ON payments 
  FOR ALL USING (auth.role() = 'service_role');

-- plans: public read, platform admin write
CREATE POLICY "plans_public_read" ON plans 
  FOR SELECT USING (TRUE);
CREATE POLICY "plans_admin_write" ON plans 
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid()::UUID AND role = 'platform_admin'
    )
  );

-- org_branding: add missing INSERT policy
CREATE POLICY "branding_service_insert" ON org_branding 
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- Add platform admin DELETE override on orgs and tournaments
CREATE POLICY "orgs_admin_delete" ON orgs 
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid()::UUID AND role = 'platform_admin'
    )
  );
CREATE POLICY "tournaments_admin_delete" ON tournaments 
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM org_members
      WHERE org_id = tournaments.org_id
      AND user_id = auth.uid()::UUID
      AND role = 'admin'
    )
  );
