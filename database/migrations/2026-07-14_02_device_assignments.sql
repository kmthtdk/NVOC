-- Migration: device assignment as a first-class record
-- Date: 2026-07-14
--
-- Until now "who has this device" was a free-text string:
--     devices.assigned_to = 'Alex Mercer (alex@company.com)'
-- with no foreign key. So the one question this module exists to answer —
-- "which assets is employee X holding?" — was a string match. Rename someone,
-- change their email, add a stray space, and their assets silently vanish from
-- their list. No error, no warning, just a wrong number.
--
-- Worse, the return path never recorded WHO returned a device (device.repo's
-- checkout() omits assigned_to from its history INSERT), so a device's history
-- reads "issued to A" -> "returned" -> "issued to B" and you cannot tell who
-- gave it back or how long anyone held it.
--
-- This table fixes both. An open row (returned_at IS NULL) is the current
-- holder; closed rows are the custody history, with real user ids.
--
-- devices.assigned_to is deliberately KEPT for now, not dropped: it is the only
-- record of the old state, and it is what we reconcile against. Drop it in a
-- later migration once the new table has been trusted in production.
--
-- Idempotent: guarded on information_schema.

SET @has_tbl := (
  SELECT COUNT(*) FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'device_assignments'
);

SET @sql := IF(@has_tbl = 0, "
CREATE TABLE device_assignments (
  id                 BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  device_id          INT UNSIGNED    NOT NULL,
  user_id            BIGINT UNSIGNED NULL,        -- NULL only for rows we could not map during backfill
  user_label         VARCHAR(190)    NOT NULL,    -- snapshot of the holder at hand-over time
  department         VARCHAR(100)    NULL,

  assigned_at        TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  assigned_by        VARCHAR(150)    NULL,        -- the IT operator who issued it
  ticket_id          BIGINT UNSIGNED NULL,        -- the hardware_request this came from

  returned_at        TIMESTAMP       NULL,
  returned_condition ENUM('good','damaged','unknown') NULL,
  returned_by        VARCHAR(150)    NULL,        -- the IT operator who took it back
  note               TEXT            NULL,

  -- 'At most one OPEN assignment per device.' MySQL has no partial unique index,
  -- so mirror the trick this schema already uses for mac_addresses.active_mac:
  -- a generated column that is the device_id only while the row is open, NULL
  -- once it is closed — and NULLs do not collide in a UNIQUE index.
  --
  -- VIRTUAL, not STORED, and that is not a style choice: MySQL forbids
  -- ON DELETE CASCADE on a column that a STORED generated column is derived
  -- from, and this one is derived from device_id. (mac_addresses gets away with
  -- STORED because active_mac derives from is_active/mac_address, not from its
  -- foreign key.) VIRTUAL still supports the UNIQUE index we need here.
  active_device_id   INT UNSIGNED GENERATED ALWAYS AS (IF(returned_at IS NULL, device_id, NULL)) VIRTUAL,

  PRIMARY KEY (id),
  UNIQUE KEY uq_da_active_device (active_device_id),
  KEY idx_da_device (device_id),
  KEY idx_da_user (user_id),
  KEY idx_da_ticket (ticket_id),
  KEY idx_da_open (returned_at),
  CONSTRAINT fk_da_device FOREIGN KEY (device_id) REFERENCES devices (id) ON DELETE CASCADE,
  CONSTRAINT fk_da_user   FOREIGN KEY (user_id)   REFERENCES users (id)   ON DELETE SET NULL,
  CONSTRAINT fk_da_ticket FOREIGN KEY (ticket_id) REFERENCES tickets (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Denormalized pointer to the current holder, so listing devices does not need a
-- join. Kept in sync inside the same transaction as the assignment write.
SET @has_col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'devices' AND COLUMN_NAME = 'assigned_user_id'
);
SET @sql := IF(@has_col = 0,
  'ALTER TABLE devices
     ADD COLUMN assigned_user_id BIGINT UNSIGNED NULL AFTER assigned_to,
     ADD INDEX idx_devices_assigned_user (assigned_user_id),
     ADD CONSTRAINT fk_devices_assigned_user
       FOREIGN KEY (assigned_user_id) REFERENCES users (id) ON DELETE SET NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---------------------------------------------------------------------------
-- BACKFILL — open an assignment row for every device currently held by someone.
--
-- devices.assigned_to looks like 'Alex Mercer (alex@company.com)'. The email in
-- the brackets is the only reliable key, so match on that. A device whose string
-- does NOT resolve to a user still gets a row (user_id NULL) rather than being
-- dropped — losing the fact that somebody has the machine is far worse than not
-- knowing exactly who. Those rows are then listed for a human to fix; nothing
-- here guesses, because guessing means assigning an asset to the wrong person.
--
-- Re-runnable: skips devices that already have an open assignment.
-- ---------------------------------------------------------------------------
INSERT INTO device_assignments (device_id, user_id, user_label, department, assigned_at, assigned_by, note)
SELECT
  d.id,
  u.id,
  d.assigned_to,
  d.department,
  COALESCE(d.updated_at, d.created_at),
  'System (backfill)',
  IF(u.id IS NULL,
     'Backfilled from devices.assigned_to; the holder could not be resolved to a user account and needs review.',
     'Backfilled from devices.assigned_to.')
FROM devices d
LEFT JOIN users u
  -- The explicit COLLATE is required, not decorative: `users` is utf8mb4_0900_ai_ci
  -- (it declares no COLLATE, so it takes the charset default) while `devices` is
  -- utf8mb4_unicode_ci. Comparing a string across the two raises
  -- "Illegal mix of collations". This is the first query in the codebase to join
  -- text across that boundary.
  ON u.email COLLATE utf8mb4_unicode_ci
     = LOWER(TRIM(TRAILING ')' FROM SUBSTRING_INDEX(d.assigned_to, '(', -1)))
WHERE d.assigned_to IS NOT NULL
  AND d.assigned_to <> ''
  AND d.assigned_to <> 'Unassigned'
  AND NOT EXISTS (
    SELECT 1 FROM device_assignments a
     WHERE a.device_id = d.id AND a.returned_at IS NULL
  );

-- Point the denormalized column at whoever we just resolved.
UPDATE devices d
  JOIN device_assignments a
    ON a.device_id = d.id AND a.returned_at IS NULL
   SET d.assigned_user_id = a.user_id
 WHERE d.assigned_user_id IS NULL
   AND a.user_id IS NOT NULL;
