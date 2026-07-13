-- Migration: add missing indexes on hot filter paths
-- Date: 2026-07-13
-- Reason: three filters run on every list call and none were indexed, so each
--         one full-scans `tickets` / relies on index-merge as the table grows:
--           1. ticket.repo.ts  WHERE assigned_to = ?
--           2. ticket.repo.ts  WHERE LOWER(requester_email) = LOWER(?)  <- the
--              "my tickets" query every requester runs. LOWER() on the column is
--              non-sargable, so a plain index would not be used; MySQL 8
--              functional indexes match the expression as written, which avoids
--              having to normalize stored emails and change the query.
--           3. approval.repo.ts pendingForUser: (approver_user_id, status)
--              composite beats two single-column indexes merged.
-- Idempotent: each ADD INDEX is guarded on information_schema.

-- 1. tickets.assigned_to
SET @has_idx := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'tickets' AND INDEX_NAME = 'idx_tickets_assigned_to'
);
SET @sql := IF(@has_idx = 0,
  'ALTER TABLE tickets ADD INDEX idx_tickets_assigned_to (assigned_to)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2. tickets.requester_email — functional index matching LOWER(requester_email)
SET @has_idx := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'tickets' AND INDEX_NAME = 'idx_tickets_requester_email_lower'
);
SET @sql := IF(@has_idx = 0,
  'ALTER TABLE tickets ADD INDEX idx_tickets_requester_email_lower ((LOWER(requester_email)))',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 3. ticket_approvals (approver_user_id, status)
SET @has_idx := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'ticket_approvals' AND INDEX_NAME = 'idx_ta_approver_status'
);
SET @sql := IF(@has_idx = 0,
  'ALTER TABLE ticket_approvals ADD INDEX idx_ta_approver_status (approver_user_id, status)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
