-- Adds photo credit columns to boxers.
-- Run BEFORE deploying the backend: the model selects these columns, so queries fail without them.
-- psql -h <host> -U postgres -d boxers -f back/migrations/2026-11-12-add-image-credit.sql
ALTER TABLE boxers ADD COLUMN IF NOT EXISTS "imageAuthor"     VARCHAR(255);
ALTER TABLE boxers ADD COLUMN IF NOT EXISTS "imageLicense"    VARCHAR(255);
ALTER TABLE boxers ADD COLUMN IF NOT EXISTS "imageLicenseUrl" VARCHAR(255);
ALTER TABLE boxers ADD COLUMN IF NOT EXISTS "imageSourceUrl"  VARCHAR(255);
