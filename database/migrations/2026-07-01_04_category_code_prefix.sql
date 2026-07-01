-- Migration: per-category ticket code prefixes
-- Date: 2026-07-01
-- Adds categories.code_prefix and re-keys ticket_sequence by (prefix, year) so
-- each main category numbers independently (HW-2026-0001, SE-2026-0001, ...).
-- Existing REQ-* tickets are untouched (codes are immutable identifiers).
-- Idempotent: guarded on column existence; prefix seed only fills NULLs.

-- 1) categories.code_prefix
SET @has_cp := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'categories' AND COLUMN_NAME = 'code_prefix'
);
SET @sql := IF(@has_cp = 0,
  'ALTER TABLE categories ADD COLUMN code_prefix VARCHAR(8) NULL AFTER description',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- Seed default prefixes (only where unset, so admin customisations survive re-runs)
UPDATE categories SET code_prefix = 'GR' WHERE id = 'general_request'  AND code_prefix IS NULL;
UPDATE categories SET code_prefix = 'NW' WHERE id = 'network_request'  AND code_prefix IS NULL;
UPDATE categories SET code_prefix = 'NS' WHERE id = 'network_security' AND code_prefix IS NULL;
UPDATE categories SET code_prefix = 'SV' WHERE id = 'server_request'   AND code_prefix IS NULL;
UPDATE categories SET code_prefix = 'SE' WHERE id = 'security_request' AND code_prefix IS NULL;
UPDATE categories SET code_prefix = 'HW' WHERE id = 'hardware_request' AND code_prefix IS NULL;

-- 2) ticket_sequence -> keyed by (prefix, year). Existing year-only rows become
--    prefix='REQ' (the legacy counter continues for that prefix).
SET @has_pref := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ticket_sequence' AND COLUMN_NAME = 'prefix'
);
SET @sql2 := IF(@has_pref = 0,
  'ALTER TABLE ticket_sequence DROP PRIMARY KEY, ADD COLUMN prefix VARCHAR(8) NOT NULL DEFAULT ''REQ'' FIRST, ADD PRIMARY KEY (prefix, year)',
  'SELECT 1');
PREPARE s2 FROM @sql2; EXECUTE s2; DEALLOCATE PREPARE s2;
