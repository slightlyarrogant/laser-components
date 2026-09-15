-- =============================================================================
-- 2026-09-15 — OAuth state → Postgres (audit 2026-09-15 §1 M1 / §4 "OAuth state")
--
-- Moves the three pieces of OAuth state that used to live in process memory +
-- JSON files under STATE_DIR into Postgres:
--
--   dynamic_clients.json  → oauth_clients
--   authCodes (Map)       → oauth_auth_codes
--   refresh_tokens.json   → oauth_refresh_tokens
--
-- Why: the JSON files resolved against process.cwd() until the Phase-0 fix and
-- were lost on a re-clone (audit §0.1), the in-memory auth-code Map is dropped
-- on every restart, and writeFileSync sat on the request path of every login.
--
-- Refresh tokens are stored as the sha256 HEX DIGEST of the token, never the
-- raw value: a read of this table must not yield usable credentials.
--
-- Additive + idempotent. Safe to re-run: every statement is guarded with
-- IF NOT EXISTS / a DO-block existence check.
--
-- Applied by hand with psql (this project has NO prisma migrations directory —
-- the schema was applied ad hoc, so `prisma migrate` / `prisma db push` must
-- NOT be used here). prisma/schema.prisma mirrors these changes so that
-- `prisma migrate diff --from-url <live> --to-schema-datamodel prisma/schema.prisma`
-- reports no difference for the three oauth_* tables.
--
-- Constraint and index names deliberately follow Prisma's default convention
-- (<table>_pkey / <table>_<column>_fkey / <table>_<column>_idx) so that diff
-- stays empty.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. oauth_clients — RFC 7591 dynamic client registry.
--
--    `redirect_uris` is the /authorize allow-list and is matched EXACTLY; an
--    empty array means "registered but cannot start a flow" (that is what a
--    legacy bare-string client imports as).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS oauth_clients (
  client_id     text        NOT NULL,
  client_name   text,
  redirect_uris text[]      NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_used_at  timestamptz,
  CONSTRAINT oauth_clients_pkey PRIMARY KEY (client_id)
);

-- -----------------------------------------------------------------------------
-- 2. oauth_auth_codes — single-use authorization codes (TTL from
--    AUTH_CODE_TTL_SECONDS, 300 s by default).
--
--    The row carries everything the /token grant must re-verify: the issuing
--    client, the exact redirect_uri the code was bound to, and the PKCE
--    challenge. Redemption is a DELETE ... RETURNING, so two concurrent
--    redemptions of the same code can never both succeed.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS oauth_auth_codes (
  code                  text        NOT NULL,
  client_id             text        NOT NULL,
  user_id               integer     NOT NULL,
  redirect_uri          text        NOT NULL,
  code_challenge        text,
  code_challenge_method text,
  expires_at            timestamptz NOT NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT oauth_auth_codes_pkey PRIMARY KEY (code)
);

-- Drives the sweeper (DELETE WHERE expires_at < now()).
CREATE INDEX IF NOT EXISTS oauth_auth_codes_expires_at_idx ON oauth_auth_codes (expires_at);

-- -----------------------------------------------------------------------------
-- 3. oauth_refresh_tokens — 30-day, single-use, rotating refresh tokens.
--
--    Primary key is sha256(token) in hex; the raw token exists only in the
--    response body that carried it to the client. Rotation marks `used_at`
--    rather than deleting, so a replayed token is distinguishable from an
--    unknown one (and stays that way until the sweeper collects it at expiry).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS oauth_refresh_tokens (
  token_hash text        NOT NULL,
  client_id  text        NOT NULL,
  user_id    integer     NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  used_at    timestamptz,
  CONSTRAINT oauth_refresh_tokens_pkey PRIMARY KEY (token_hash)
);

CREATE INDEX IF NOT EXISTS oauth_refresh_tokens_user_id_idx    ON oauth_refresh_tokens (user_id);
CREATE INDEX IF NOT EXISTS oauth_refresh_tokens_expires_at_idx ON oauth_refresh_tokens (expires_at);

-- -----------------------------------------------------------------------------
-- 4. Foreign keys to users. ON DELETE CASCADE: removing an account must revoke
--    its outstanding codes and refresh tokens, not leave them danglingly valid.
--    CASCADE/CASCADE also matches Prisma's declared referential actions, which
--    is what keeps `prisma migrate diff` empty.
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'oauth_auth_codes_user_id_fkey'
  ) THEN
    ALTER TABLE oauth_auth_codes
      ADD CONSTRAINT oauth_auth_codes_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'oauth_refresh_tokens_user_id_fkey'
  ) THEN
    ALTER TABLE oauth_refresh_tokens
      ADD CONSTRAINT oauth_refresh_tokens_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

COMMIT;
