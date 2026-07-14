// ============================================================================
// Shared domain types — mirror the frontend src/types.ts (the API contract).
// Backend serializes to exactly these shapes (camelCase, nested comments/history).
// ============================================================================

export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';
/**
 * `pending_approval` is the approval gate as a first-class state: the ticket is
 * parked on an approver's desk, not waiting on IT. Without it, IT and the
 * requester could not distinguish "nobody has triaged this" from "your director
 * hasn't signed", and fulfillment-time reports charged approval latency to IT.
 * Tickets with no approval chain go straight to `submitted`.
 */
export type TicketStatus =
  | 'submitted'
  | 'pending_approval'
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

export type StorageType = 'SSD' | 'NVMe' | 'HDD' | 'eMMC' | 'Hybrid';

/**
 * The named fields are the ones stored as real columns, because they are the ones
 * people filter and report on ("which machines are under 8GB?", "how many are
 * still on Windows 10?"). `additionalSpecs` carries the long tail — individual
 * RAM sticks, each disk, attached monitors, installed licences — in specs_json.
 */
export interface DeviceSpecifications {
  cpu?: string | null;
  ramGb?: number | null;
  storageGb?: number | null;
  storageType?: StorageType | null;
  gpu?: string | null;
  psuWatts?: number | null;
  os?: string | null;
  osVersion?: string | null;
  hostname?: string | null;
  additionalSpecs?: Record<string, string> | null;
}

/**
 * One hand-over of one device to one person. An open row (returnedAt === null)
 * is the current holder; closed rows are the custody history.
 */
export interface DeviceAssignment {
  id: number;
  deviceId: number;
  /** null only for rows the backfill could not resolve to a user — needs review. */
  userId: number | null;
  userLabel: string;
  department: string | null;
  assignedAt: string;
  assignedBy: string | null;
  ticketId: number | null;
  returnedAt: string | null;
  returnedCondition: 'good' | 'damaged' | 'unknown' | null;
  returnedBy: string | null;
  note: string | null;
  /** Joined in by the queries that need them. */
  deviceCode?: string;
  assetCode?: string | null;
  deviceType?: string;
  model?: string;
  serialNumber?: string;
}

export interface Device {
  id: number;
  /** Our own code, system-generated: ITA-2026-0001. */
  code: string;
  /**
   * The finance asset tag (sổ tài sản cố định) — a third identifier alongside
   * `code` and the vendor's `serialNumber`. Nullable: hardware arrives before
   * accounting tags it.
   */
  assetCode: string | null;
  deviceType: string;
  model: string;
  serialNumber: string;
  status: DeviceStatus;
  /** Denormalized label of the current holder. `assignedUserId` is the real link. */
  assignedTo: string | null;
  assignedUserId: number | null;
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
