-- Migration to address SEC-001: Move keys_data from veto_sessions to a secure table
CREATE TABLE IF NOT EXISTS veto_keys (
    match_id TEXT PRIMARY KEY REFERENCES veto_sessions(id) ON DELETE CASCADE,
    keys_data JSONB NOT NULL
);

-- Enable RLS on the new table
ALTER TABLE veto_keys ENABLE ROW LEVEL SECURITY;

-- Only service_role can access this table directly
CREATE POLICY "keys_service_all" ON veto_keys FOR ALL USING (auth.role() = 'service_role');

-- Copy existing keys to the new table
INSERT INTO veto_keys (match_id, keys_data)
SELECT id, keys_data FROM veto_sessions WHERE keys_data IS NOT NULL
ON CONFLICT (match_id) DO NOTHING;

-- Remove keys_data from veto_sessions to prevent public exposure
ALTER TABLE veto_sessions DROP COLUMN IF EXISTS keys_data;

-- RPC Function to safely resolve a key to a role without exposing keys
CREATE OR REPLACE FUNCTION get_veto_role(match_id_param text, provided_key text)
RETURNS text AS $$
DECLARE
    keys_obj JSONB;
BEGIN
    SELECT keys_data INTO keys_obj FROM veto_keys WHERE match_id = match_id_param;
    IF keys_obj IS NULL THEN
        RETURN 'viewer';
    END IF;
    
    IF keys_obj->>'admin' = provided_key THEN
        RETURN 'admin';
    ELSIF keys_obj->>'A' = provided_key THEN
        RETURN 'A';
    ELSIF keys_obj->>'B' = provided_key THEN
        RETURN 'B';
    ELSE
        RETURN 'viewer';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
