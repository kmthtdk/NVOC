-- ============================================================================
-- Migration: 04_mac_addresses.sql
-- Description: MAC address inventory table for IT devices.
--              Allows devices to have multiple MAC addresses (Ethernet, WiFi,
--              Bluetooth, etc.). One-to-many relationship with devices table.
-- Charset: utf8mb4 / utf8mb4_unicode_ci. Timestamps stored in UTC.
-- ============================================================================

SET NAMES utf8mb4;
SET time_zone = '+00:00';

-- ----------------------------------------------------------------------------
-- mac_addresses
-- Store multiple MAC addresses per device. Each row represents one MAC
-- address in format XX:XX:XX:XX:XX:XX (case-insensitive on read).
-- mac_type allows categorization (Ethernet, WiFi, Bluetooth, Other).
-- Device deletion cascades to remove all linked MAC addresses.
-- Unique constraint prevents duplicate MACs per device (optional).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mac_addresses (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  device_id   INT UNSIGNED NOT NULL,
  mac_type    ENUM('Ethernet','WiFi','Bluetooth','Other') NOT NULL DEFAULT 'Ethernet',
  mac_address VARCHAR(17)  NOT NULL,
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_macs_device (device_id),
  KEY idx_macs_mac (mac_address),
  CONSTRAINT fk_macs_device FOREIGN KEY (device_id) REFERENCES devices (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
