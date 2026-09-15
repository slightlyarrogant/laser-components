-- db/seed/regions-countries.sql
--
-- Reference geography for LC Connect: top-level regions and the countries that
-- actually occur in the lead data (see scripts/README-geography.md for the
-- inventory this was derived from).
--
-- Idempotent: safe to run any number of times. Every statement is
-- INSERT ... ON CONFLICT DO NOTHING keyed on the unique name/code constraints,
-- and region ids are resolved by CODE, never hard-coded.
--
-- Apply:
--   psql "$DATABASE_URL_WITHOUT_SCHEMA_PARAM" -f db/seed/regions-countries.sql
--
-- Deliberately NOT added: Africa/AF. No lead in the database carries any
-- African signal, and the brief is to add top-level regions only when the data
-- needs them. Add it together with the first African country.
--
-- Deliberately NOT added as countries: Netherlands, Belgium, Switzerland,
-- Portugal, Lithuania, North Macedonia, Israel, UAE, Saudi Arabia, South
-- Africa. None of them appear in the current data. Add one with the same
-- pattern used below when a lead needs it.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Top-level regions
--    Already present: North America (NA, id 1), Europe (EU, id 2), Asia (AS, id 3).
--    Added here because the country list below needs them.
-- ---------------------------------------------------------------------------
INSERT INTO regions (name, code, parent_region_id) VALUES
  ('South America', 'SA', NULL),   -- Brazil, Chile, Argentina, Peru, Venezuela, Colombia
  ('Oceania',       'OC', NULL),   -- Australia, New Zealand
  ('Middle East',   'ME', NULL)    -- Turkey (see README: decision to confirm)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2. Countries occurring in the lead data and missing from `countries`.
--    ISO 3166-1 alpha-2 codes. region_id resolved by region code.
--    countries.updated_at is NOT NULL with no DB default -> set explicitly.
-- ---------------------------------------------------------------------------
INSERT INTO countries (name, code, region_id, updated_at)
SELECT c.name, c.code, r.id, NOW()
FROM (VALUES
  -- Europe
  ('Poland',                 'PL', 'EU'),
  ('Czech Republic',         'CZ', 'EU'),
  ('Austria',                'AT', 'EU'),
  ('Ireland',                'IE', 'EU'),
  ('Slovakia',               'SK', 'EU'),
  ('Slovenia',               'SI', 'EU'),
  ('Croatia',                'HR', 'EU'),
  ('Bosnia and Herzegovina', 'BA', 'EU'),
  ('Serbia',                 'RS', 'EU'),
  ('Albania',                'AL', 'EU'),
  ('Greece',                 'GR', 'EU'),
  ('Romania',                'RO', 'EU'),
  ('Bulgaria',               'BG', 'EU'),
  ('Hungary',                'HU', 'EU'),
  ('Ukraine',                'UA', 'EU'),
  ('Estonia',                'EE', 'EU'),
  ('Latvia',                 'LV', 'EU'),
  -- Middle East
  ('Turkey',                 'TR', 'ME'),
  -- South America
  ('Brazil',                 'BR', 'SA'),
  ('Argentina',              'AR', 'SA'),
  ('Chile',                  'CL', 'SA'),
  ('Peru',                   'PE', 'SA'),
  ('Colombia',               'CO', 'SA'),
  ('Venezuela',              'VE', 'SA'),
  -- Oceania
  ('Australia',              'AU', 'OC'),
  ('New Zealand',            'NZ', 'OC')
) AS c(name, code, region_code)
JOIN regions r ON r.code = c.region_code
ON CONFLICT DO NOTHING;

COMMIT;
