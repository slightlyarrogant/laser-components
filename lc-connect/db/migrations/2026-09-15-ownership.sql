-- =============================================================================
-- 2026-09-15 — per-user OWNERSHIP + ROLES for LC Connect
--
-- Additive + idempotent. Safe to re-run: every statement is guarded with
-- IF NOT EXISTS / DO-block existence checks, so applying it twice is a no-op.
--
-- Applied by hand with psql (this project has NO prisma migrations directory —
-- the schema was applied ad hoc, so `prisma migrate` / `prisma db push` must
-- NOT be used here). prisma/schema.prisma mirrors these changes so that
-- `prisma migrate diff --from-url <live> --to-schema-datamodel prisma/schema.prisma`
-- reports no difference for users / leads / notes / user_regions.
--
-- Index and constraint names deliberately follow Prisma's default naming
-- convention (<table>_<column>_idx / <table>_<column>_fkey) so the diff above
-- stays empty.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. users: activation flag + human-readable display name.
-- -----------------------------------------------------------------------------
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name text;

-- -----------------------------------------------------------------------------
-- 2. user_regions: a user's region competency (empty set = global competency).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_regions (
  user_id   integer NOT NULL,
  region_id integer NOT NULL,
  CONSTRAINT user_regions_pkey PRIMARY KEY (user_id, region_id)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_regions_user_id_fkey'
  ) THEN
    ALTER TABLE user_regions
      ADD CONSTRAINT user_regions_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_regions_region_id_fkey'
  ) THEN
    ALTER TABLE user_regions
      ADD CONSTRAINT user_regions_region_id_fkey
      FOREIGN KEY (region_id) REFERENCES regions(id) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

-- -----------------------------------------------------------------------------
-- 3. leads: explicit owner (distinct from the immutable creator).
-- -----------------------------------------------------------------------------
ALTER TABLE leads ADD COLUMN IF NOT EXISTS owner_user_id integer;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'leads_owner_user_id_fkey'
  ) THEN
    ALTER TABLE leads
      ADD CONSTRAINT leads_owner_user_id_fkey
      FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

-- -----------------------------------------------------------------------------
-- 4. Indexes covering the new ownership/competency filters and the existing
--    hot lead/note lookups (the live leads + notes tables had NO index beyond
--    their primary key before this migration).
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS leads_owner_user_id_idx      ON leads (owner_user_id);
CREATE INDEX IF NOT EXISTS leads_created_by_user_id_idx ON leads (created_by_user_id);
CREATE INDEX IF NOT EXISTS leads_region_id_idx          ON leads (region_id);
CREATE INDEX IF NOT EXISTS leads_country_id_idx         ON leads (country_id);
CREATE INDEX IF NOT EXISTS leads_status_idx             ON leads (status);
-- NOTE: the live lead product FK column is the camelCase, quoted "productId"
-- (the Prisma field carries no @map), not product_id.
CREATE INDEX IF NOT EXISTS "leads_productId_idx"        ON leads ("productId");
CREATE INDEX IF NOT EXISTS leads_created_at_idx         ON leads (created_at DESC);
CREATE INDEX IF NOT EXISTS notes_lead_id_idx            ON notes (lead_id);
CREATE INDEX IF NOT EXISTS notes_user_id_idx            ON notes (user_id);

-- -----------------------------------------------------------------------------
-- 5. Retire the three legacy junk ADMIN accounts (ids 1, 2, 3). They keep their
--    rows (leads/notes reference them) but can no longer sign in.
-- -----------------------------------------------------------------------------
UPDATE users SET is_active = false WHERE id IN (1, 2, 3);

COMMIT;
