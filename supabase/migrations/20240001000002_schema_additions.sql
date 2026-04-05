-- ⚡ SUPABASE MIGRATION 20240001000002_schema_additions.sql
-- =============================================================================
-- Documents manual DB schema additions made to live environment for reproducibility.
-- =============================================================================

ALTER TABLE users 
  ADD COLUMN IF NOT EXISTS linked_accounts JSONB;

ALTER TABLE veto_sessions
  ADD COLUMN IF NOT EXISTS keys_data JSONB,
  ADD COLUMN IF NOT EXISTS date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_picked_map TEXT,
  ADD COLUMN IF NOT EXISTS played_maps JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS ready JSONB 
    DEFAULT '{"A":false,"B":false}';
