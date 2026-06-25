-- ============================================================================
-- N-VOC Request System — MySQL 8 schema
-- Runs first (01_) in /docker-entrypoint-initdb.d before the seed (02_).
-- Charset utf8mb4 everywhere; UTC time_zone for deterministic TIMESTAMP storage.
-- ============================================================================
SET NAMES utf8mb4;
SET time_zone = '+00:00';

-- ----------------------------------------------------------------------------
-- USERS — real auth, replacing the client-side activeRole toggle.
-- Role vocabulary is unified across schema/seed/JWT/middleware: requester|it_support|admin.
-- ----------------------------------------------------------------------------
CREATE TABLE users (
  id            BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  full_name     VARCHAR(150) NOT NULL,
  email         VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,                 -- bcrypt hash; never plaintext
  role          ENUM('requester','it_support','admin') NOT NULL DEFAULT 'requester',
  department    VARCHAR(150) NULL,
  title         VARCHAR(150) NULL,                      -- e.g. "Network Architect"
  is_active     TINYINT(1) NOT NULL DEFAULT 1,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_users_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------------------------------------------------------
-- TAXONOMY — 3 levels: category -> subcategory -> request_type (with period flag)
-- ----------------------------------------------------------------------------
CREATE TABLE categories (
  id          VARCHAR(50) PRIMARY KEY,                 -- e.g. 'network_security'
  name        VARCHAR(120) NOT NULL,
  icon        VARCHAR(50)  NOT NULL,                   -- lucide-react icon name
  description TEXT NULL,
  sort_order  INT NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE subcategories (
  id          VARCHAR(60) PRIMARY KEY,                 -- e.g. 'firewall'
  category_id VARCHAR(50) NOT NULL,
  name        VARCHAR(120) NOT NULL,
  description TEXT NULL,
  sort_order  INT NOT NULL DEFAULT 0,
  CONSTRAINT fk_sub_cat FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
  INDEX idx_sub_cat (category_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE request_types (
  id              VARCHAR(60) PRIMARY KEY,             -- e.g. 'access_server'
  subcategory_id  VARCHAR(60) NOT NULL,
  name            VARCHAR(120) NOT NULL,
  period_required ENUM('Apply','Non Apply') NOT NULL DEFAULT 'Non Apply',
  sort_order      INT NOT NULL DEFAULT 0,
  CONSTRAINT fk_type_sub FOREIGN KEY (subcategory_id) REFERENCES subcategories(id) ON DELETE CASCADE,
  INDEX idx_type_sub (subcategory_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------------------------------------------------------
-- TICKET_SEQUENCE — transaction-safe source for REQ-YYYY-NNNN codes.
-- One row per year; SELECT ... FOR UPDATE serializes concurrent code generation.
-- ----------------------------------------------------------------------------
CREATE TABLE ticket_sequence (
  year     INT UNSIGNED PRIMARY KEY,
  last_seq INT UNSIGNED NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------------------------------------------------------
-- TICKETS
-- ----------------------------------------------------------------------------
CREATE TABLE tickets (
  id               BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  code             VARCHAR(20) NOT NULL UNIQUE,        -- 'REQ-2026-0001'
  title            VARCHAR(255) NOT NULL,
  description      TEXT NOT NULL,

  requester_id     BIGINT UNSIGNED NULL,               -- FK once auth in use
  requester_name   VARCHAR(150) NOT NULL,              -- denormalized snapshot
  requester_email  VARCHAR(190) NOT NULL,
  requester_dept   VARCHAR(150) NOT NULL,

  category_id      VARCHAR(50) NOT NULL,
  subcategory_id   VARCHAR(60) NOT NULL,
  type_id          VARCHAR(60) NULL,                   -- legacy tickets predate type capture

  priority         ENUM('low','medium','high','urgent') NOT NULL DEFAULT 'medium',
  status           ENUM('submitted','waiting','resolved','rejected') NOT NULL DEFAULT 'submitted',

  -- assigned_to kept as free-text for data parity; assigned_user_id is the FK target.
  assigned_to      VARCHAR(150) NOT NULL DEFAULT 'Unassigned',
  assigned_user_id BIGINT UNSIGNED NULL,

  period_from      DATE NULL,                          -- collected by form, now persisted
  period_to        DATE NULL,

  details          JSON NULL,                          -- polymorphic spec blob

  created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_t_cat  FOREIGN KEY (category_id)      REFERENCES categories(id),
  CONSTRAINT fk_t_sub  FOREIGN KEY (subcategory_id)   REFERENCES subcategories(id),
  CONSTRAINT fk_t_type FOREIGN KEY (type_id)          REFERENCES request_types(id),
  CONSTRAINT fk_t_req  FOREIGN KEY (requester_id)     REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_t_asg  FOREIGN KEY (assigned_user_id) REFERENCES users(id) ON DELETE SET NULL,

  INDEX idx_t_status   (status),
  INDEX idx_t_category (category_id),
  INDEX idx_t_priority (priority),
  INDEX idx_t_created  (created_at),
  FULLTEXT KEY ft_t_search (title, description, requester_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------------------------------------------------------
-- COMMENTS — live chat thread on a ticket.
-- ----------------------------------------------------------------------------
CREATE TABLE comments (
  id         BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  ticket_id  BIGINT UNSIGNED NOT NULL,
  author     VARCHAR(150) NOT NULL,
  role       ENUM('requester','it_support') NOT NULL,
  content    TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_c_ticket FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
  INDEX idx_c_ticket (ticket_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------------------------------------------------------
-- TICKET_HISTORY — audit timeline (first-class in the frontend).
-- ----------------------------------------------------------------------------
CREATE TABLE ticket_history (
  id           BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  ticket_id    BIGINT UNSIGNED NOT NULL,
  status       ENUM('submitted','waiting','resolved','rejected') NOT NULL,
  status_label VARCHAR(120) NOT NULL,
  updated_by   VARCHAR(150) NOT NULL,
  notes        TEXT NULL,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_h_ticket FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
  INDEX idx_h_ticket (ticket_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------------------------------------------------------
-- ATTACHMENTS — metadata only; file bytes live on the uploads volume.
-- ----------------------------------------------------------------------------
CREATE TABLE attachments (
  id            BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  ticket_id     BIGINT UNSIGNED NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  stored_name   VARCHAR(255) NOT NULL,                 -- uuid filename on disk
  mime_type     VARCHAR(100) NOT NULL,
  size_bytes    BIGINT UNSIGNED NOT NULL,
  uploaded_by   VARCHAR(150) NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_a_ticket FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
  INDEX idx_a_ticket (ticket_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
