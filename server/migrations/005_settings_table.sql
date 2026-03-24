-- ⚡ MIGRATION 005 — SETTINGS TABLE
-- =============================================================================
-- This table stores platform-level configuration (e.g. admin Discord webhook).
-- It was previously created ad-hoc but is now part of the formal schema.
-- =============================================================================

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
