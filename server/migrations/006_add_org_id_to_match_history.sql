-- server/migrations/006_add_org_id_to_match_history.sql
-- ADD org_id column to match_history for multi-tenant persistence.

-- SQLite doesn't support ADD COLUMN if multiple columns/constraints are involved easily,
-- but for a simple TEXT column it works fine.
ALTER TABLE match_history ADD COLUMN org_id TEXT DEFAULT 'global';

-- Update existing records to have a default org if they are null
UPDATE match_history SET org_id = 'global' WHERE org_id IS NULL;
