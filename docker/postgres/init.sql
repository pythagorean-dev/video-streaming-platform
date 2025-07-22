-- VideoStream Pro - PostgreSQL Initialization
-- Create extensions and additional configurations

-- Enable UUID extension for better ID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable full-text search extension
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Enable unaccent extension for better search
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- Create custom functions for search
CREATE OR REPLACE FUNCTION f_unaccent(text)
  RETURNS text AS
$func$
SELECT unaccent('unaccent', $1)
$func$ LANGUAGE sql IMMUTABLE;

-- Set timezone
SET timezone = 'UTC';

-- Log initialization
INSERT INTO pg_stat_activity (query) VALUES ('VideoStream Pro Database Initialized') ON CONFLICT DO NOTHING;