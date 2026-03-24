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
