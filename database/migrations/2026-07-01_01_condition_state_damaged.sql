-- Migration: add 'damaged' to device_history.condition_state
-- Date: 2026-07-01
-- Reason: C-2 fix. Returning a device as "damaged" was a 500 because the enum
--         lacked 'damaged'. database/init/03_it_devices.sql was updated, but the
--         init scripts only run on a FRESH database (docker-entrypoint-initdb.d),
--         so existing/running databases need this ALTER applied explicitly.
--
-- Idempotent: re-running just re-asserts the same column definition. Safe.

ALTER TABLE device_history
  MODIFY condition_state ENUM('new','good','fair','poor','damaged','unknown') NULL;
