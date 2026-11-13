-- IBHOF category of a boxer: modern | late-era | early-era | pioneer
-- psql -h <host> -U postgres -d boxers -f back/migrations/2026-11-12-category.sql
ALTER TABLE boxers ADD COLUMN IF NOT EXISTS category VARCHAR(20);
CREATE INDEX IF NOT EXISTS boxers_category_idx ON boxers (category);
