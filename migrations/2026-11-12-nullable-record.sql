-- Fight record may be unknown (bare-knuckle era fighters): allow NULL in record columns.
-- psql -h <host> -U postgres -d boxers -f back/migrations/2026-11-12-nullable-record.sql
ALTER TABLE boxers ALTER COLUMN bouts DROP NOT NULL;
ALTER TABLE boxers ALTER COLUMN won   DROP NOT NULL;
ALTER TABLE boxers ALTER COLUMN lost  DROP NOT NULL;
ALTER TABLE boxers ALTER COLUMN kos   DROP NOT NULL;
