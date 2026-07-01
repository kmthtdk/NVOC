-- Migration: add procurement/purchase fields to devices
-- Date: 2026-07-01
-- Reason: Phase 1 — purchase management (supplier, cost, currency, PO, invoice).
--         database/init/03_it_devices.sql adds these on a FRESH DB; running DBs
--         need this ALTER. Guarded on the `supplier` column so it is idempotent
--         (safe to re-run; skips if already applied).

SET @has_supplier := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'devices'
    AND COLUMN_NAME = 'supplier'
);

SET @sql := IF(
  @has_supplier = 0,
  'ALTER TABLE devices
     ADD COLUMN supplier      VARCHAR(150)  NULL AFTER warranty_expiry,
     ADD COLUMN purchase_cost DECIMAL(12,2) NULL AFTER supplier,
     ADD COLUMN currency      VARCHAR(3)    NULL AFTER purchase_cost,
     ADD COLUMN po_number     VARCHAR(80)   NULL AFTER currency,
     ADD COLUMN invoice_no    VARCHAR(80)   NULL AFTER po_number,
     ADD INDEX idx_devices_supplier (supplier),
     ADD INDEX idx_devices_po (po_number)',
  'SELECT 1'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
