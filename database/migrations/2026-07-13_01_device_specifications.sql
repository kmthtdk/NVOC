-- Migration: add hardware specification columns to devices
-- Date: 2026-07-13
-- Reason: database/init/03_it_devices.sql adds these on a FRESH DB only. Its
--         sibling ALTER (purchase fields) was backported to a migration; this
--         one never was, so any running DB provisioned before the specs feature
--         hard-fails every device create with "Unknown column 'cpu'"
--         (device.repo.ts create() INSERTs all six columns unconditionally).
--         Guarded on `cpu` so it is idempotent (safe to re-run; skips if applied).

SET @has_cpu := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'devices'
    AND COLUMN_NAME = 'cpu'
);

SET @sql := IF(
  @has_cpu = 0,
  'ALTER TABLE devices
     ADD COLUMN cpu        VARCHAR(255)  NULL AFTER notes,
     ADD COLUMN ram_gb     INT UNSIGNED  NULL AFTER cpu,
     ADD COLUMN storage_gb INT UNSIGNED  NULL AFTER ram_gb,
     ADD COLUMN gpu        VARCHAR(255)  NULL AFTER storage_gb,
     ADD COLUMN psu_watts  INT UNSIGNED  NULL AFTER gpu,
     ADD COLUMN specs_json JSON          NULL AFTER psu_watts,
     ADD INDEX idx_devices_cpu (cpu),
     ADD INDEX idx_devices_ram (ram_gb),
     ADD INDEX idx_devices_storage (storage_gb),
     ADD INDEX idx_devices_gpu (gpu),
     ADD INDEX idx_devices_psu (psu_watts),
     ADD FULLTEXT KEY ft_devices_specs (cpu, gpu)',
  'SELECT 1'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
