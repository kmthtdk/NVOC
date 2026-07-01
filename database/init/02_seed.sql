-- ============================================================================
-- N-VOC Request System — seed data (runs after 01_schema.sql).
-- Taxonomy mirrors src/data/categories.ts exactly (ids + period flags).
-- Demo users + the 5 INITIAL_TICKETS with comments/history for demo parity.
-- All timestamps converted from source -07:00 to UTC (+7h) for deterministic storage.
-- Demo password for every seeded user: "Passw0rd!"  (bcrypt, cost 10)
-- WARNING (production): these demo accounts are dev-only. Set ADMIN_EMAIL/
--   ADMIN_PASSWORD so the backend provisions a real admin and DISABLES these
--   demo logins at boot (see backend/src/config/adminBootstrap.ts).
-- ============================================================================
SET NAMES utf8mb4;
SET time_zone = '+00:00';

-- ---------------------------------------------------------------- USERS ----
INSERT INTO users (id, full_name, email, password_hash, role, department, title) VALUES
  (1, 'System Admin',  'admin@company.com',      '$2a$10$S4stxttvBHccVzRgHnKaQ.HCLXNNIAj0.O90RWAf0BayEzmnBMZ/W', 'admin',      'IT Operations',           'IT Administrator'),
  (2, 'Marcus Vance',  'marcus.vance@company.com','$2a$10$S4stxttvBHccVzRgHnKaQ.HCLXNNIAj0.O90RWAf0BayEzmnBMZ/W', 'it_support', 'IT Operations',           'Network Architect'),
  (3, 'Alex Mercer',   'alex.mercer@company.com', '$2a$10$S4stxttvBHccVzRgHnKaQ.HCLXNNIAj0.O90RWAf0BayEzmnBMZ/W', 'requester',  'R&D / Software Engineering','Software Engineer');

-- ----------------------------------------------------------- CATEGORIES ----
INSERT INTO categories (id, name, icon, description, sort_order) VALUES
  ('general_request',  'General Request',  'Laptop',  'General support requests, troubleshooting, or office specific workspace requests / VOC.', 1),
  ('network_request',  'Network Request',  'Wifi',    'Register LAN network connections, static address assignment, or unblock connections.',   2),
  ('network_security', 'Network Security', 'Shield',  'Secure corporate networking access, boundary routing permissions, and firewall rule configurations.', 3),
  ('server_request',   'Server Request',   'Server',  'Shared file directories, folder expand requests, directory data restorations, or standard permissions.', 4),
  ('security_request', 'Security Request', 'Lock',    'Special authorization for network control exemptions, USB access, and data decryption operations.', 5),
  ('hardware_request', 'Hardware Request', 'Monitor', 'Request new, repair, upgrade, return, or replacement of physical devices.', 6);

-- -------------------------------------------------------- SUBCATEGORIES ----
INSERT INTO subcategories (id, category_id, name, description, sort_order) VALUES
  ('troubleshooting',       'general_request',  'Troubleshooting',       'Resolve workspace bugs, Knox errors, and platform integrations.', 1),
  ('night_shift',           'general_request',  'Night Shift',           'Submit requests for on-duty specialists after general business hours.', 2),
  ('network_registration',  'network_request',  'Network registration',  'Provide details for allocating secure corporate workspace IPs.', 1),
  ('ip_phone',              'network_request',  'IP Phone',              'Configure voice connection, IP phone routing, or international gateway permission.', 2),
  ('other_network',         'network_request',  'Other Network',         'Submit request for network-related troubleshooting or configuration.', 3),
  ('firewall',              'network_security', 'Firewall',              'Request port opening or IP flow configurations between physical or logical zones.', 1),
  ('folder',                'server_request',   'Folder',                'Request folder structure additions, capability enhancements, or Veeam snapshots.', 1),
  ('permission',            'server_request',   'Permission',            'Request read, write, modify, or full management credentials to specified corporate folders.', 2),
  ('ai',                    'server_request',   'AI',                    'Register corporate subscriptions for LLMs or secure workspace endpoints (API keys).', 3),
  ('e',                     'security_request', 'E',                     'Special endpoint and hardware restriction bypass requests.', 1),
  ('n',                     'security_request', 'N',                     'Secured document workflows, document mergers, or decryptions.', 2),
  ('pc_security',           'security_request', 'PC Security',           'Device security software exceptions, control exemptions, and execution policies.', 3),
  ('desktop',               'hardware_request', 'Desktop',               'Corporate desktop configurations.', 1),
  ('laptop',                'hardware_request', 'Laptop',                'Deploy or troubleshoot high-availability mobile workstations.', 2),
  ('monitor',               'hardware_request', 'Monitor',               'External graphics output screens or displays.', 3),
  ('phone',                 'hardware_request', 'Phone',                 'Corporate active smartphones or communication lines.', 4),
  ('tablet',                'hardware_request', 'Tablet',                'Active design tablets or mobile utility boards.', 5),
  ('deskphone',             'hardware_request', 'Deskphone',             'Fixed corporate workspace voice terminals.', 6),
  ('removable_disk',        'hardware_request', 'Removable Disk',        'External solid state storage drives or secure keys.', 7),
  ('accessories',           'hardware_request', 'Accessories',           'Keyboard, Mouse, Headset, Docking station, or other peripherals.', 8);

-- -------------------------------------------------------- REQUEST_TYPES ----
INSERT INTO request_types (id, subcategory_id, name, period_required, sort_order) VALUES
  -- general_request / troubleshooting
  ('office',        'troubleshooting',      'Office',     'Non Apply', 1),
  ('window',        'troubleshooting',      'Window',     'Non Apply', 2),
  ('knox',          'troubleshooting',      'Knox',       'Non Apply', 3),
  ('other_trouble', 'troubleshooting',      'Other',      'Non Apply', 4),
  -- general_request / night_shift
  ('support_ns',    'night_shift',          'Support NS', 'Non Apply', 1),
  -- network_request / network_registration
  ('ip_office',     'network_registration', 'IP Office',  'Non Apply', 1),
  ('ip_line',       'network_registration', 'IP Line',    'Non Apply', 2),
  ('ip_wifi',       'network_registration', 'IP WIFI',    'Non Apply', 3),
  -- network_request / ip_phone
  ('c2d',               'ip_phone',         'C2D',                'Non Apply', 1),
  ('international_call', 'ip_phone',         'International Call', 'Non Apply', 2),
  -- network_request / other_network
  ('unblock_ip',    'other_network',        'Unblock IP', 'Non Apply', 1),
  -- network_security / firewall (all Apply)
  ('access_line',       'firewall',         'Access to Line Zone',         'Apply', 1),
  ('access_office',     'firewall',         'Access to Office Zone',       'Apply', 2),
  ('access_server',     'firewall',         'Access to Server Zone',       'Apply', 3),
  ('access_ai',         'firewall',         'Access to AI Zone',           'Apply', 4),
  ('firewall_external', 'firewall',         'Firewall for external network','Apply', 5),
  -- server_request / folder
  ('create_folder',   'folder',             'Create New Folder', 'Non Apply', 1),
  ('expand_capacity', 'folder',             'Expand Capacity',   'Non Apply', 2),
  ('restore_data',    'folder',             'Restore Data',      'Non Apply', 3),
  -- server_request / permission
  ('modify_folder',   'permission',         'Modify Folder',     'Non Apply', 1),
  ('read_folder',     'permission',         'Read Folder',       'Non Apply', 2),
  ('write_folder',    'permission',         'Write Folder',      'Non Apply', 3),
  ('account_server',  'permission',         'Account Server',    'Non Apply', 4),
  -- server_request / ai
  ('gemini',          'ai',                 'Gemini',            'Non Apply', 1),
  ('gpt',             'ai',                 'GPT',               'Non Apply', 2),
  ('api_access',      'ai',                 'API',               'Non Apply', 3),
  -- security_request / e (all Apply)
  ('network_sharing', 'e',                  'Network sharing Control', 'Apply', 1),
  ('usb_rw',          'e',                  'USB Read/ Write',         'Apply', 2),
  -- security_request / n (all Apply)
  ('auto_decrypt',    'n',                  'Automatic Decryption', 'Apply', 1),
  ('compare_merge',   'n',                  'Comparison/Merge',     'Apply', 2),
  ('enforce_decrypt', 'n',                  'Enforce Decryption',   'Apply', 3),
  ('manual_decrypt',  'n',                  'Manual Decryption',    'Apply', 4),
  -- security_request / pc_security (all Apply)
  ('no_security_app', 'pc_security',        'No Security Application', 'Apply', 1),
  ('mds_execution',   'pc_security',        'MDS Excution',           'Apply', 2),
  -- hardware_request / desktop
  ('desktop_new',         'desktop',        'New',         'Non Apply', 1),
  ('desktop_repair',      'desktop',        'Repair',      'Non Apply', 2),
  ('desktop_replacement', 'desktop',        'Replacement', 'Non Apply', 3),
  ('desktop_return',      'desktop',        'Return',      'Non Apply', 4),
  -- hardware_request / laptop
  ('laptop_new',          'laptop',         'New',         'Non Apply', 1),
  ('laptop_repair',       'laptop',         'Repair',      'Non Apply', 2),
  ('laptop_replacement',  'laptop',         'Replacement', 'Non Apply', 3),
  ('laptop_return',       'laptop',         'Return',      'Non Apply', 4),
  -- hardware_request / monitor
  ('monitor_new',         'monitor',        'New',         'Non Apply', 1),
  ('monitor_repair',      'monitor',        'Repair',      'Non Apply', 2),
  ('monitor_replacement', 'monitor',        'Replacement', 'Non Apply', 3),
  ('monitor_return',      'monitor',        'Return',      'Non Apply', 4),
  -- hardware_request / phone
  ('phone_new',           'phone',          'New',         'Non Apply', 1),
  ('phone_repair',        'phone',          'Repair',      'Non Apply', 2),
  ('phone_replacement',   'phone',          'Replacement', 'Non Apply', 3),
  ('phone_return',        'phone',          'Return',      'Non Apply', 4),
  -- hardware_request / tablet
  ('tablet_new',          'tablet',         'New',         'Non Apply', 1),
  ('tablet_repair',       'tablet',         'Repair',      'Non Apply', 2),
  ('tablet_replacement',  'tablet',         'Replacement', 'Non Apply', 3),
  ('tablet_return',       'tablet',         'Return',      'Non Apply', 4),
  -- hardware_request / deskphone
  ('deskphone_new',         'deskphone',    'New',         'Non Apply', 1),
  ('deskphone_repair',      'deskphone',    'Repair',      'Non Apply', 2),
  ('deskphone_replacement', 'deskphone',    'Replacement', 'Non Apply', 3),
  ('deskphone_return',      'deskphone',    'Return',      'Non Apply', 4),
  -- hardware_request / removable_disk
  ('removable_new',         'removable_disk','New',        'Non Apply', 1),
  ('removable_replacement', 'removable_disk','Replacement','Non Apply', 2),
  ('removable_return',      'removable_disk','Return',     'Non Apply', 3),
  -- hardware_request / accessories
  ('accessories_new',         'accessories','New',         'Non Apply', 1),
  ('accessories_repair',      'accessories','Repair',      'Non Apply', 2),
  ('accessories_replacement', 'accessories','Replacement', 'Non Apply', 3),
  ('accessories_return',      'accessories','Return',      'Non Apply', 4);

-- ----------------------------------------------------- TICKET SEQUENCE ----
-- 5 demo tickets already use REQ-2026-0001..0005, so next allocated is 0006.
INSERT INTO ticket_sequence (year, last_seq) VALUES (2026, 5);

-- ------------------------------------------------------------- TICKETS ----
-- type_id NULL: source INITIAL_TICKETS have no 'type' field (design decision).
INSERT INTO tickets
  (id, code, title, description, requester_id, requester_name, requester_email, requester_dept,
   category_id, subcategory_id, type_id, priority, status, assigned_to, assigned_user_id,
   period_from, period_to, details, created_at, updated_at) VALUES
  (1, 'REQ-2026-0001',
   'Request Firewall permission access to server zone database',
   'Need access to the server database zone database environment to support a critical hotfix deployment this weekend. I confirm adherence to corporate security protocols.',
   3, 'Alex Mercer', 'alex.mercer@company.com', 'R&D / Software Engineering',
   'network_security', 'firewall', NULL, 'high', 'resolved',
   'Marcus Vance (Network Architect)', 2, NULL, NULL,
   '{"sourceIp":"10.20.15.5","destinationIp":"192.168.100.12","protocolPort":"TCP-5432"}',
   '2026-06-16 16:30:00', '2026-06-16 22:45:00'),
  (2, 'REQ-2026-0002',
   'Restore accidentally deleted project directory "Campaign_Q2"',
   'Someone from the design workflow deleted the folder Campaign_Q2 on the shared drive (S:\\Marketing\\Active_Projects\\). It contains high-resolution assets and media plan templates for Q3 rollout.',
   NULL, 'Sarah Connor', 'sarah.c@company.com', 'Marketing & PR Dept',
   'server_request', 'folder', NULL, 'urgent', 'processing',
   'Lucas Croft (System Administrator)', NULL, NULL, NULL,
   '{"serverAction":"folder","folderActionType":"restore","folderPath":"S:\\\\Marketing\\\\Active_Projects\\\\Campaign_Q2"}',
   '2026-06-17 15:00:00', '2026-06-17 21:10:00'),
  (3, 'REQ-2026-0003',
   'Provision Write access to S:\\Finance\\Reports_2026 for Emily Thorne',
   'We need to provision granular write/change access control permissions for our new accountant Emily Thorne (emily.t@company.com) so she can publish recent audit reports.',
   NULL, 'Jonathan Davis', 'jona.davis@company.com', 'Finance & Accounts',
   'server_request', 'permission', NULL, 'medium', 'submitted',
   'Unassigned', NULL, NULL, NULL,
   '{"serverAction":"permission","targetUser":"Emily Thorne (emily.t@company.com)","folderPath":"S:\\\\Finance\\\\Reports_2026","permissionActionType":["read","write","modify"]}',
   '2026-06-17 22:20:00', '2026-06-17 22:20:00'),
  (4, 'REQ-2026-0004',
   'Laptop producing abnormal noise and thermal shutting down',
   'My primary workstation laptop emits a high-pitched whistling noise when starting high-load processes. It has shut down abruptly three times while rendering Photoshop artboards this morning due to extreme heat.',
   NULL, 'Chloe Frazer', 'chloe.f@company.com', 'Creative Art & Animation Suite',
   'hardware_request', 'laptop', NULL, 'high', 'pending_user',
   'Nicholas Croft (Hardware Support)', NULL, NULL, NULL,
   '{"deviceActionType":"repair","deviceType":"Laptop","deviceModelName":"Dell XPS 9310"}',
   '2026-06-15 18:00:00', '2026-06-16 17:10:00'),
  (5, 'REQ-2026-0005',
   'PC Security exemption for local driver development compilation',
   'Require temporary No Security Application exclusion on my engineering machine. Need to bypass the automated sandboxing engine to compile, build, and local-test customized native software drivers.',
   NULL, 'Khoa Tran', 'khoatpv@gmail.com', 'R&D / Software Engineering',
   'security_request', 'pc_security', NULL, 'medium', 'submitted',
   'Unassigned', NULL, NULL, NULL,
   '{"pcSecurityHost":"PC-KHOATPV-DEV1","pcSecurityReason":"Building customized native binaries for low-level platform interfaces."}',
   '2026-06-18 16:12:00', '2026-06-18 16:12:00');

-- ------------------------------------------------------------ COMMENTS ----
INSERT INTO comments (ticket_id, author, role, content, created_at) VALUES
  (1, 'Alex Mercer',   'requester',  'Hi IT support! Please review and approve this as soon as possible so we can hit our evening staging target.', '2026-06-16 17:00:00'),
  (1, 'Marcus Vance',  'it_support', 'Your network security rule has been successfully deployed. Let us know if checking connection holds alright.', '2026-06-16 22:30:00'),
  (1, 'Alex Mercer',   'requester',  'Successfully authenticated. Connecting fine. Thank you so much!', '2026-06-16 22:45:00'),
  (2, 'Lucas Croft',   'it_support', 'I am tracking down the latest nightly backup on our Veeam Backup catalog. The last automated backup of the share completed at 23:00 yesterday. I am mounting that copy now.', '2026-06-17 18:00:00'),
  (2, 'Sarah Connor',  'requester',  'That works beautifully! We only edited a few spreadsheets this morning, we can recreate those. Restoring to yesterdays state will prevent massive delays! Thank you.', '2026-06-17 18:20:00'),
  (4, 'Nicholas Croft','it_support', 'This feels like a mechanical blockage in the cooler fan or dried CPU thermal compound. Please hand over the computer at the IT Desk (Room 402, 4th floor) during business hours.', '2026-06-15 21:30:00'),
  (4, 'Nicholas Croft','it_support', 'Kindly reminder: We still await your laptop handoff at the desk. Let us resolve this before any permanent silicon hardware degradation occurred. Thanks!', '2026-06-16 17:10:00');

-- ------------------------------------------------------ TICKET_HISTORY ----
INSERT INTO ticket_history (ticket_id, status, status_label, updated_by, notes, created_at) VALUES
  (1, 'submitted',  'VOC Submitted',          'Alex Mercer',   'Awaiting IT triage.', '2026-06-16 16:30:00'),
  (1, 'processing', 'Under Investigation',    'Marcus Vance',  'Triage complete. Configuring policy rules on Fortigate firewall and provisioning database credentials.', '2026-06-16 18:15:00'),
  (1, 'resolved',   'Issue Resolved',         'Marcus Vance',  'Access granted. Policy finalized and tested successfully.', '2026-06-16 22:30:00'),
  (2, 'submitted',  'VOC Submitted',          'Sarah Connor',  'Awaiting SLA prioritisation.', '2026-06-17 15:00:00'),
  (2, 'processing', 'System Diagnostics',     'Lucas Croft',   'Identified the directory mount structure. Initialising folder snapshot restore process.', '2026-06-17 17:45:00'),
  (3, 'submitted',  'VOC Raised',             'Jonathan Davis','The system has successfully logged the access request. Awaiting administrator approval.', '2026-06-17 22:20:00'),
  (4, 'submitted',  'VOC Logs Received',      'Chloe Frazer',  'Awaiting physical hardware diagnosis.', '2026-06-15 18:00:00'),
  (4, 'processing', 'Assigned & Accepted',    'Nicholas Croft','Identified hardware thermal throttling error. Requested direct handoff for physical dusting and re-pasting.', '2026-06-15 21:30:00'),
  (4, 'pending_user','Awaiting Device Handoff','Nicholas Croft','Pending customer physical delivery to IT suite.', '2026-06-16 17:10:00'),
  (5, 'submitted',  'Exemption Requested',    'Khoa Tran',     'Exemption policy initialized in system queue. Target software policy will apply on approval matching.', '2026-06-18 16:12:00');
