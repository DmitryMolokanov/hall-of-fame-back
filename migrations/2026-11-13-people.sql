-- "Beyond the Ring": Hall of Fame inductees who are not boxers (trainers, promoters, ...).
-- psql -h <host> -U postgres -d boxers -f back/migrations/2026-11-13-people.sql
CREATE TABLE IF NOT EXISTS people (
    id                VARCHAR(255) PRIMARY KEY,
    slug              VARCHAR(255) NOT NULL UNIQUE,
    name              VARCHAR(255) NOT NULL,
    role              VARCHAR(255) NOT NULL,
    biography         TEXT NOT NULL,
    "bioSourceUrl"    VARCHAR(255),
    born              VARCHAR(255),
    died              VARCHAR(255),
    induction         INTEGER,
    "avatarImg"       VARCHAR(255),
    img               VARCHAR(255),
    "imageAuthor"     VARCHAR(255),
    "imageLicense"    VARCHAR(255),
    "imageLicenseUrl" VARCHAR(255),
    "imageSourceUrl"  VARCHAR(255)
);
CREATE INDEX IF NOT EXISTS people_role_idx ON people (role);
