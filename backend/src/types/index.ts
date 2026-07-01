// ============================================================================
// Shared domain types — mirror the frontend src/types.ts (the API contract).
// Backend serializes to exactly these shapes (camelCase, nested comments/history).
// ============================================================================

export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TicketStatus =
  | 'submitted'
  | 'waiting'
  | 'resolved'
  | 'rejected';

export type DeviceStatus = 'Active' | 'In Repair' | 'Retired' | 'Lost' | 'In Stock';
export type DeviceActionType = 'new' | 'repair' | 'return' | 'replace';
export type TicketDeviceActionType = 'related' | 'resolved' | 'affected' | DeviceActionType;

export type UserRole = 'requester' | 'it_support' | 'admin';
export type CommentRole = 'requester' | 'it_support';
export type PeriodFlag = 'Apply' | 'Non Apply';

export interface TicketComment {
  id: string;
  author: string;
  role: CommentRole;
  content: string;
  createdAt: string;
}

export interface TicketHistoryItem {
  id: string;
  status: TicketStatus;
  statusLabel: string;
  updatedBy: string;
  notes: string;
  createdAt: string;
}

export interface AttachmentMeta {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedBy: string | null;
  createdAt: string;
}

/** Polymorphic per-category details blob (stored as JSON). Loosely typed by design. */
export type TicketDetails = Record<string, unknown>;

export interface LinkedDevice {
  deviceId: number;
  actionType: DeviceActionType;
}

export interface Ticket {
  id: string;
  code: string;
  title: string;
  requesterName: string;
  requesterEmail: string;
  requesterDept: string;
  category: string;
  subcategory: string;
  type: string | null;
  priority: TicketPriority;
  description: string;
  status: TicketStatus;
  createdAt: string;
  updatedAt: string;
  assignedTo: string;
  periodFrom: string | null;
  periodTo: string | null;
  comments: TicketComment[];
  history: TicketHistoryItem[];
  attachments?: AttachmentMeta[];
  linkedDevices?: LinkedDevice[];
  details: TicketDetails;
}

export interface LinkedTicket {
  ticketId: number;
  actionType: TicketDeviceActionType;
}

export interface TicketDeviceLink {
  id: number;
  ticketId: number;
  deviceId: number;
  actionType: DeviceActionType;
  createdAt: string;
}

export type MacAddressType = 'Ethernet' | 'WiFi' | 'Bluetooth' | 'Other';

export interface MacAddress {
  id: number;
  deviceId: number;
  macType: MacAddressType;
  macAddress: string;
  createdAt: string;
  updatedAt: string;
}

export interface MacAddressInput {
  macType: MacAddressType;
  macAddress: string;
}

export interface DeviceSpecifications {
  cpu?: string | null;
  ramGb?: number | null;
  storageGb?: number | null;
  gpu?: string | null;
  psuWatts?: number | null;
  additionalSpecs?: Record<string, string> | null;
}

export interface Device {
  id: number;
  code: string;
  deviceType: string;
  model: string;
  serialNumber: string;
  status: DeviceStatus;
  assignedTo: string | null;
  department: string | null;
  purchaseDate: string | null;
  warrantyExpiry: string | null;
  supplier: string | null;
  purchaseCost: number | null;
  currency: string | null;
  poNumber: string | null;
  invoiceNo: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  linkedTickets: LinkedTicket[];
  macAddresses?: MacAddress[];
  specifications?: DeviceSpecifications;
}

// ---- Taxonomy (matches CategorySpec on the frontend) ----
export interface RequestTypeSpec {
  id: string;
  name: string;
  period: PeriodFlag;
}
export interface SubcategorySpec {
  id: string;
  name: string;
  description: string;
  types: RequestTypeSpec[];
}
export interface CategorySpec {
  id: string;
  name: string;
  icon: string;
  description: string;
  subcategories: SubcategorySpec[];
}

// ---- Auth ----
export interface PublicUser {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  department: string | null;
  title: string | null;
}

export interface JwtPayload {
  sub: string; // user id
  email: string;
  role: UserRole;
  name: string;
}

/** Express augmentation: req.user populated by the auth middleware. */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}
