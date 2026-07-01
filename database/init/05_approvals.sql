-- ============================================================================
-- N-VOC — approval workflow (Phase 2). Runs on a FRESH DB after 01-04.
-- Idempotent (IF NOT EXISTS / ON DUPLICATE KEY). Existing DBs: apply the same
-- content via database/migrations/2026-07-01_03_approvals.sql.
-- ============================================================================

CREATE TABLE IF NOT EXISTS app_settings (
  setting_key   VARCHAR(80)  NOT NULL,
  setting_value TEXT         NULL,
  updated_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (setting_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS department_leaders (
  department     VARCHAR(150)     NOT NULL,
  leader_user_id BIGINT UNSIGNED  NOT NULL,
  PRIMARY KEY (department),
  KEY idx_dl_leader (leader_user_id),
  CONSTRAINT fk_dl_user FOREIGN KEY (leader_user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS approval_flows (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  scope_type ENUM('default','category','request_type') NOT NULL DEFAULT 'default',
  scope_ref  VARCHAR(50)  NULL,
  name       VARCHAR(150) NOT NULL,
  is_active  TINYINT(1)   NOT NULL DEFAULT 1,
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_flow_scope (scope_type, scope_ref)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS approval_flow_steps (
  id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
  flow_id          INT UNSIGNED NOT NULL,
  step_order       INT NOT NULL,
  approver_type    ENUM('requester_leader','it_leader','user','role') NOT NULL,
  approver_user_id BIGINT UNSIGNED NULL,
  approver_role    VARCHAR(50)  NULL,
  label            VARCHAR(150) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_flow_step (flow_id, step_order),
  CONSTRAINT fk_step_flow FOREIGN KEY (flow_id) REFERENCES approval_flows (id) ON DELETE CASCADE,
  CONSTRAINT fk_step_user FOREIGN KEY (approver_user_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS ticket_approvals (
  id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
  ticket_id        BIGINT UNSIGNED NOT NULL,
  step_order       INT NOT NULL,
  approver_type    ENUM('requester_leader','it_leader','user','role') NOT NULL,
  approver_user_id BIGINT UNSIGNED NULL,
  approver_label   VARCHAR(150) NULL,
  status           ENUM('pending','approved','rejected','skipped') NOT NULL DEFAULT 'pending',
  decided_by       BIGINT UNSIGNED NULL,
  decided_at       TIMESTAMP NULL,
  note             TEXT NULL,
  is_ad_hoc        TINYINT(1) NOT NULL DEFAULT 0,
  created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ticket_step (ticket_id, step_order),
  KEY idx_ta_ticket (ticket_id),
  KEY idx_ta_approver (approver_user_id),
  KEY idx_ta_status (status),
  CONSTRAINT fk_ta_ticket FOREIGN KEY (ticket_id) REFERENCES tickets (id) ON DELETE CASCADE,
  CONSTRAINT fk_ta_user FOREIGN KEY (approver_user_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS notifications (
  id                INT UNSIGNED NOT NULL AUTO_INCREMENT,
  event             VARCHAR(80)  NOT NULL,
  recipient_user_id BIGINT UNSIGNED NULL,
  recipient_email   VARCHAR(190) NULL,
  ticket_id         BIGINT UNSIGNED NULL,
  payload           JSON NULL,
  status            ENUM('pending','sent','failed') NOT NULL DEFAULT 'pending',
  attempts          INT NOT NULL DEFAULT 0,
  created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sent_at           TIMESTAMP NULL,
  PRIMARY KEY (id),
  KEY idx_notif_status (status),
  KEY idx_notif_recipient (recipient_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO approval_flows (id, scope_type, scope_ref, name, is_active)
VALUES (1, 'default', NULL, 'Default approval', 1)
ON DUPLICATE KEY UPDATE name = VALUES(name), is_active = VALUES(is_active);

INSERT INTO approval_flow_steps (flow_id, step_order, approver_type, label)
VALUES
  (1, 1, 'requester_leader', 'Requester Leader'),
  (1, 2, 'it_leader',        'IT Leader')
ON DUPLICATE KEY UPDATE approver_type = VALUES(approver_type), label = VALUES(label);

INSERT INTO app_settings (setting_key, setting_value)
VALUES ('it_leader_user_id', '2'), ('approval_enabled', '1')
ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value);

INSERT INTO department_leaders (department, leader_user_id)
VALUES ('R&D / Software Engineering', 1)
ON DUPLICATE KEY UPDATE leader_user_id = VALUES(leader_user_id);
