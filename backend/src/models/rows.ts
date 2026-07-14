// Raw DB row shapes (snake_case) as returned by mysql2 with dateStrings:true.
import type { RowDataPacket } from 'mysql2';
import type {
  TicketPriority,
  TicketStatus,
  CommentRole,
  UserRole,
  PeriodFlag,
} from '../types/index.js';

export interface UserRow extends RowDataPacket {
  id: number;
  full_name: string;
  email: string;
  password_hash: string;
  role: UserRole;
  department: string | null;
  title: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface TicketRow extends RowDataPacket {
  id: number;
  code: string;
  title: string;
  description: string;
  requester_id: number | null;
  requester_name: string;
  requester_email: string;
  requester_dept: string;
  category_id: string;
  subcategory_id: string;
  type_id: string | null;
  priority: TicketPriority;
  status: TicketStatus;
  assigned_to: string;
  assigned_user_id: number | null;
  period_from: string | null;
  period_to: string | null;
  details: unknown; // JSON column (object or string depending on driver)
  created_at: string;
  updated_at: string;
}

export interface CommentRow extends RowDataPacket {
  id: number;
  ticket_id: number;
  author: string;
  role: CommentRole;
  content: string;
  created_at: string;
}

export interface HistoryRow extends RowDataPacket {
  id: number;
  ticket_id: number;
  status: TicketStatus;
  status_label: string;
  updated_by: string;
  notes: string | null;
  created_at: string;
}

export interface AttachmentRow extends RowDataPacket {
  id: number;
  ticket_id: number;
  original_name: string;
  stored_name: string;
  mime_type: string;
  size_bytes: number;
  uploaded_by: string | null;
  created_at: string;
}

export interface CategoryRow extends RowDataPacket {
  id: string;
  name: string;
  icon: string;
  description: string | null;
  sort_order: number;
}
export interface SubcategoryRow extends RowDataPacket {
  id: string;
  category_id: string;
  name: string;
  description: string | null;
  sort_order: number;
}
export interface RequestTypeRow extends RowDataPacket {
  id: string;
  subcategory_id: string;
  name: string;
  period_required: PeriodFlag;
  sort_order: number;
}

export interface DeviceRow extends RowDataPacket {
  id: number;
  code: string;
  asset_code: string | null;
  device_type: string;
  model: string;
  serial_number: string;
  status: string;
  assigned_to: string | null;
  assigned_user_id: number | null;
  department: string | null;
  purchase_date: string | null;
  warranty_expiry: string | null;
  supplier: string | null;
  purchase_cost: string | null; // DECIMAL comes back as a string via mysql2
  currency: string | null;
  po_number: string | null;
  invoice_no: string | null;
  notes: string | null;
  cpu: string | null;
  ram_gb: number | null;
  storage_gb: number | null;
  storage_type: string | null;
  gpu: string | null;
  psu_watts: number | null;
  os: string | null;
  os_version: string | null;
  hostname: string | null;
  specs_json: string | null;
  created_at: string;
  updated_at: string;
}

export interface MacAddressRow extends RowDataPacket {
  id: number;
  device_id: number;
  mac_type: string;
  mac_address: string;
  created_at: string;
  updated_at: string;
}
