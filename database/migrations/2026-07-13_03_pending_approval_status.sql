-- Migration: add the 'pending_approval' ticket status
-- Date: 2026-07-13
-- Reason: approval ran as a state machine parallel to ticket.status. A ticket
--         awaiting a leader's signature and a ticket awaiting IT triage both sat
--         at 'submitted', so:
--           * IT could not tell them apart in the queue — they discovered the
--             block by clicking Resolve and getting an error;
--           * the requester's tracker showed "Submitted" while the ticket was
--             actually parked on their own director's desk;
--           * fulfillment-time / age reports measured from created_at, silently
--             folding approval latency into "IT fulfillment time" — the SLA
--             numbers were wrong and nothing surfaced it.
--         'pending_approval' makes the gate a first-class state.
--
-- Idempotent: the ALTERs are guarded on the ENUM definition; the backfill is
-- naturally re-runnable (it only touches rows still mis-labelled 'submitted').

-- 1. tickets.status
SET @has_val := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tickets'
    AND COLUMN_NAME = 'status' AND COLUMN_TYPE LIKE '%pending_approval%'
);
SET @sql := IF(@has_val = 0,
  "ALTER TABLE tickets MODIFY status
     ENUM('submitted','pending_approval','waiting','resolved','rejected')
     NOT NULL DEFAULT 'submitted'",
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2. ticket_history.status (same vocabulary — the timeline records these states)
SET @has_val := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ticket_history'
    AND COLUMN_NAME = 'status' AND COLUMN_TYPE LIKE '%pending_approval%'
);
SET @sql := IF(@has_val = 0,
  "ALTER TABLE ticket_history MODIFY status
     ENUM('submitted','pending_approval','waiting','resolved','rejected') NOT NULL",
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 3. Backfill: existing tickets sitting at 'submitted' that actually have a
--    pending approval step belong in 'pending_approval'. Without this, every
--    ticket created before this migration keeps lying about its state.
UPDATE tickets t
   SET t.status = 'pending_approval'
 WHERE t.status = 'submitted'
   AND EXISTS (
     SELECT 1 FROM ticket_approvals a
      WHERE a.ticket_id = t.id AND a.status = 'pending'
   );
