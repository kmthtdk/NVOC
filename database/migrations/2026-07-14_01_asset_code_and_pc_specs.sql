-- Migration: company asset tag + queryable PC/laptop configuration
-- Date: 2026-07-14
--
-- asset_code is the FINANCE asset tag (sổ tài sản cố định), a third identifier
-- alongside our own `code` (ITA-2026-0001, system-generated) and the vendor's
-- `serial_number`. Deliberately NULLABLE: hardware arrives before accounting
-- tags it, and forcing a value at intake just makes people type junk to get past
-- the form. UNIQUE still holds for the rows that have one — MySQL permits many
-- NULLs in a UNIQUE index, which is exactly the "unique when present" we want.
--
-- The spec columns are the ones that get FILTERED and REPORTED on ("which
-- machines are under 8GB and need an upgrade", "how many are still on Windows
-- 10"). Those must be columns — buried in specs_json every such question becomes
-- a full table scan. Everything else (individual RAM sticks, each disk, attached
-- monitors, installed licences) stays in specs_json, which already exists.
--
-- Idempotent: guarded on information_schema.

-- 1. asset_code
SET @has_col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'devices' AND COLUMN_NAME = 'asset_code'
);
SET @sql := IF(@has_col = 0,
  'ALTER TABLE devices
     ADD COLUMN asset_code VARCHAR(60) NULL AFTER code,
     ADD UNIQUE KEY uq_devices_asset_code (asset_code)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2. Queryable configuration
SET @has_col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'devices' AND COLUMN_NAME = 'os'
);
SET @sql := IF(@has_col = 0,
  "ALTER TABLE devices
     ADD COLUMN storage_type ENUM('SSD','NVMe','HDD','eMMC','Hybrid') NULL AFTER storage_gb,
     ADD COLUMN os           VARCHAR(60)  NULL AFTER psu_watts,
     ADD COLUMN os_version   VARCHAR(60)  NULL AFTER os,
     ADD COLUMN hostname     VARCHAR(100) NULL AFTER os_version,
     ADD INDEX idx_devices_os (os),
     ADD INDEX idx_devices_storage_type (storage_type),
     ADD INDEX idx_devices_hostname (hostname)",
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
