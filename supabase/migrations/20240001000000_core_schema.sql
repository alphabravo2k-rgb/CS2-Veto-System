-- ⚡ SUPABASE MIGRATION 20240001000000_core_schema.sql
-- =============================================================================
-- Core unified schema for the Universal Esports Veto Platform.
-- This replaces the fragmented SQLite tables with a consistent Postgres implementation.
-- =============================================================================

-- Orgs (tenants)
CREATE TABLE IF NOT EXISTS orgs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Org branding (one row per org)
CREATE TABLE IF NOT EXISTS org_branding (
  org_id TEXT PRIMARY KEY REFERENCES orgs(id) ON DELETE CASCADE,
  display_name TEXT,
  primary_color TEXT NOT NULL DEFAULT '#00d4ff',
  secondary_color TEXT NOT NULL DEFAULT '#0a0f1e',
  logo_url TEXT,
  banner_url TEXT,
  custom_domain TEXT,
  trial_count INTEGER NOT NULL DEFAULT 0,
  trial_limit INTEGER NOT NULL DEFAULT 3,
  is_registered BOOLEAN NOT NULL DEFAULT FALSE,
  plan TEXT NOT NULL DEFAULT 'trial'
);

-- Users (Profile extension of auth.users)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  role TEXT NOT NULL DEFAULT 'user',
  country TEXT,
  server_region TEXT,
  avatar_url TEXT,
  bio TEXT,
  suspended BOOLEAN NOT NULL DEFAULT FALSE,
  username_changed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Org members
CREATE TABLE IF NOT EXISTS org_members (
  org_id TEXT REFERENCES orgs(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (org_id, user_id)
);

-- Tournaments
CREATE TABLE IF NOT EXISTS tournaments (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  format TEXT DEFAULT 'bo1',
  game_module TEXT DEFAULT 'cs2',
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tournament map pools
CREATE TABLE IF NOT EXISTS tournament_map_pools (
  tournament_id TEXT REFERENCES tournaments(id) ON DELETE CASCADE,
  map_name TEXT NOT NULL,
  map_image_url TEXT,
  sort_order INTEGER DEFAULT 0,
  PRIMARY KEY (tournament_id, map_name)
);

-- Veto sessions (Matches)
CREATE TABLE IF NOT EXISTS veto_sessions (
  id TEXT PRIMARY KEY,
  tournament_id TEXT REFERENCES tournaments(id) ON DELETE CASCADE,
  org_id TEXT REFERENCES orgs(id),
  team_a TEXT NOT NULL,
  team_b TEXT NOT NULL,
  team_a_logo TEXT,
  team_b_logo TEXT,
  format TEXT NOT NULL,
  sequence JSONB,
  step INTEGER DEFAULT 0,
  maps JSONB DEFAULT '[]',
  logs JSONB DEFAULT '[]',
  finished BOOLEAN DEFAULT FALSE,
  game_module TEXT DEFAULT 'cs2',
  status TEXT DEFAULT 'veto_in_progress',
  timer_duration INTEGER,
  use_timer BOOLEAN DEFAULT FALSE,
  use_coin_flip BOOLEAN DEFAULT FALSE,
  coin_flip JSONB,
  temp_webhook_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);

-- Settings (platform-level config)
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit log
CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  actor_id TEXT,
  action TEXT NOT NULL,
  target_id TEXT,
  meta JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add missing columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS dob DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS age_verified BOOLEAN 
  NOT NULL DEFAULT FALSE;

-- refresh_tokens table (missing entirely)
CREATE TABLE IF NOT EXISTS refresh_tokens (
  token TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_refresh_user 
  ON refresh_tokens(user_id);

-- player_accounts table (missing entirely)
CREATE TABLE IF NOT EXISTS player_accounts (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  platform_id TEXT NOT NULL,
  platform_username TEXT,
  PRIMARY KEY (user_id, platform)
);

-- payments table (new — for USDT invoice tracking)
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES orgs(id),
  amount_usd NUMERIC(10,2) NOT NULL,
  amount_crypto NUMERIC(18,8),
  currency TEXT NOT NULL DEFAULT 'USDT',
  network TEXT NOT NULL DEFAULT 'TRC20',
  status TEXT NOT NULL DEFAULT 'pending',
  nowpayments_id TEXT,
  pay_address TEXT,
  plan TEXT NOT NULL,
  period_months INTEGER NOT NULL DEFAULT 1,
  invoice_url TEXT,
  confirmed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  meta JSONB
);

-- plans table (pricing config, managed by master admin)
CREATE TABLE IF NOT EXISTS plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  price_usd NUMERIC(10,2) NOT NULL,
  veto_limit INTEGER,
  allow_custom_domain BOOLEAN DEFAULT FALSE,
  allow_own_branding BOOLEAN DEFAULT FALSE,
  show_watermark BOOLEAN DEFAULT TRUE,
  features JSONB,
  active BOOLEAN DEFAULT TRUE
);

-- Seed default plans
INSERT INTO plans (id, name, price_usd, veto_limit, 
  allow_own_branding, show_watermark) VALUES
('free_individual', 'Free Individual', 0, NULL, FALSE, TRUE),
('org_trial', 'Org Trial', 0, 3, TRUE, FALSE),
('org_pro', 'Org Pro', 19.99, NULL, TRUE, FALSE),
('org_enterprise', 'Enterprise', 99.99, NULL, TRUE, FALSE)
ON CONFLICT (id) DO NOTHING;
