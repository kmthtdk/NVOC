-- ============================================================================
-- Migration: 03_it_devices.sql
-- Description: IT device inventory tables for the VOC system.
--              Matches the backend contract in backend/src/models
--              (device.repo.ts, rows.ts DeviceRow, types/index.ts Device).
-- Charset: utf8mb4 / utf8mb4_unicode_ci. Timestamps stored in UTC.
-- ============================================================================

SET NAMES utf8mb4;
SET time_zone = '+00:00';

-- ----------------------------------------------------------------------------
-- device_sequence
-- Per-year counter that backs the human-readable device code ITA-YYYY-NNNN.
-- device.repo.nextDeviceCode() locks the matching row (SELECT ... FOR UPDATE)
-- inside a transaction so concurrent inserts cannot allocate the same code.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS device_sequence (
  year      INT NOT NULL,
  last_seq  INT NOT NULL DEFAULT 0,
  PRIMARY KEY (year)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- devices
-- Canonical inventory table. Column names mirror DeviceRow (snake_case);
-- the mapper converts to the camelCase Device API shape.
-- status values match DeviceStatus: 'Active' | 'In Repair' | 'Retired' | 'Lost'.
-- FULLTEXT(code, model, serial_number) backs the deviceRepo.list() `q` search.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS devices (
  id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
  code             VARCHAR(20)  NOT NULL,
  device_type      VARCHAR(50)  NOT NULL,
  model            VARCHAR(150) NOT NULL,
  serial_number    VARCHAR(100) NOT NULL,
  status           ENUM('Active','In Repair','Retired','Lost') NOT NULL DEFAULT 'Active',
  assigned_to      VARCHAR(150) NULL,
  department       VARCHAR(100) NULL,
  purchase_date    DATE         NULL,
  warranty_expiry  DATE         NULL,
  notes            TEXT         NULL,
  created_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_devices_code (code),
  UNIQUE KEY uq_devices_serial (serial_number),
  KEY idx_devices_type (device_type),
  KEY idx_devices_status (status),
  KEY idx_devices_assigned_to (assigned_to),
  KEY idx_devices_department (department),
  FULLTEXT KEY ft_devices_search (code, model, serial_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- ticket_device_links
-- Many-to-many between tickets and devices. action_type matches LinkedTicket:
-- 'related' | 'resolved' | 'affected'. Unique (ticket_id, device_id) prevents
-- duplicate links. ON DELETE CASCADE keeps links consistent with both parents.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ticket_device_links (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  ticket_id    BIGINT UNSIGNED NOT NULL,
  device_id    INT UNSIGNED NOT NULL,
  action_type  ENUM('related','resolved','affected') NOT NULL DEFAULT 'related',
  created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ticket_device (ticket_id, device_id),
  KEY idx_tdl_device (device_id),
  CONSTRAINT fk_tdl_ticket FOREIGN KEY (ticket_id) REFERENCES tickets (id) ON DELETE CASCADE,
  CONSTRAINT fk_tdl_device FOREIGN KEY (device_id) REFERENCES devices (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- Seed: 5 demo devices ITA-2026-0001 .. ITA-2026-0005
-- ----------------------------------------------------------------------------
INSERT INTO device_sequence (year, last_seq) VALUES (2026, 5)
  ON DUPLICATE KEY UPDATE last_seq = GREATEST(last_seq, VALUES(last_seq));

INSERT INTO devices
  (code, device_type, model, serial_number, status, assigned_to, department, purchase_date, warranty_expiry, notes)
VALUES
  ('ITA-2026-0001', 'laptop',  'Dell Latitude 7440',   'SN-DL7440-0001', 'Active',    'Alice Tan',   'Finance',    '2026-01-15', '2029-01-15', 'Primary work laptop'),
  ('ITA-2026-0002', 'desktop', 'HP EliteDesk 800 G9',  'SN-HP800-0002',  'Active',    'Ben Lim',     'HR',         '2026-02-01', '2029-02-01', 'Front-desk workstation'),
  ('ITA-2026-0003', 'monitor', 'Dell U2723QE 27"',     'SN-DLU27-0003',  'Active',    'Ben Lim',     'HR',         '2026-02-01', '2028-02-01', 'Paired with ITA-2026-0002'),
  ('ITA-2026-0004', 'phone',   'iPhone 15',            'SN-IP15-0004',   'In Repair', 'Carla Reyes', 'Sales',      '2026-03-10', '2027-03-10', 'Screen replacement in progress'),
  ('ITA-2026-0005', 'laptop',  'Lenovo ThinkPad X1',   'SN-LTX1-0005',   'Active',    NULL,          'IT',         '2026-04-05', '2029-04-05', 'Spare in stock')
ON DUPLICATE KEY UPDATE code = VALUES(code);

-- ----------------------------------------------------------------------------
-- Link existing ticket #4 to device #1 (demo data).
-- Guarded so the migration is safe if ticket #4 does not exist in this DB.
-- ----------------------------------------------------------------------------
INSERT INTO ticket_device_links (ticket_id, device_id, action_type)
SELECT 4, 1, 'related'
FROM dual
WHERE EXISTS (SELECT 1 FROM tickets WHERE id = 4)
  AND EXISTS (SELECT 1 FROM devices WHERE id = 1)
ON DUPLICATE KEY UPDATE action_type = VALUES(action_type);

-- ============================================================================
-- mac_addresses
-- Storage for multiple MAC addresses per device (wireless, wired, ethernet,
-- bluetooth, etc.). Supports soft-delete via is_active flag with generated
-- column to maintain uniqueness constraint across only active entries.
-- Foreign key references devices.id (INT UNSIGNED to match FK constraint).
-- ============================================================================
CREATE TABLE IF NOT EXISTS mac_addresses (
  id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  device_id         INT UNSIGNED NOT NULL,
  mac_address       VARCHAR(17) NOT NULL COLLATE utf8mb4_unicode_ci,
  mac_type          VARCHAR(50) NOT NULL COLLATE utf8mb4_unicode_ci,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  active_mac        VARCHAR(17) GENERATED ALWAYS AS (IF(is_active=1, mac_address, NULL)) STORED NULL,
  created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_mac_active (active_mac),
  KEY idx_mac_device (device_id),
  KEY idx_mac_type (mac_type),
  KEY idx_mac_active (is_active),
  CONSTRAINT fk_mac_device FOREIGN KEY (device_id) REFERENCES devices (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- Seed: MAC addresses for demo laptops (ITA-2026-0001 and ITA-2026-0005)
-- ============================================================================
INSERT INTO mac_addresses (device_id, mac_address, mac_type, is_active)
VALUES
  (1, '00:1A:2B:3C:4D:5E', 'wireless',  TRUE),
  (1, '00:1A:2B:3C:4D:5F', 'wired',     TRUE),
  (5, '00:1A:2B:3C:4D:60', 'wireless',  TRUE),
  (5, '00:1A:2B:3C:4D:61', 'ethernet',  TRUE),
  (1, '00:1A:2B:3C:4D:62', 'bluetooth', FALSE)
ON DUPLICATE KEY UPDATE is_active = VALUES(is_active);
