-- Profile URL slug and biography source link.
-- psql -h <host> -U postgres -d boxers -f back/migrations/2026-11-12-slug.sql
ALTER TABLE boxers ADD COLUMN IF NOT EXISTS slug VARCHAR(255);
ALTER TABLE boxers ADD COLUMN IF NOT EXISTS "bioSourceUrl" VARCHAR(255);
CREATE UNIQUE INDEX IF NOT EXISTS boxers_slug_key ON boxers (slug);
