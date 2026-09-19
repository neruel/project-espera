ALTER TABLE provider_connections ADD COLUMN display_name TEXT NOT NULL DEFAULT 'Provider connection';
ALTER TABLE provider_connections ADD COLUMN endpoint_url TEXT;

