// snake_case row  ->  camelCase API shape. Single place where DB meets contract.
import { toIso, toDateOnly, parseJsonColumn } from '../utils/helpers.js';
import type {
  Ticket,
  TicketComment,
  TicketHistoryItem,
  AttachmentMeta,
  PublicUser,
  Device,
  LinkedTicket,
  MacAddress,
  DeviceSpecifications,
} from '../types/index.js';
import type {
  UserRow,
  TicketRow,
  CommentRow,
  HistoryRow,
  AttachmentRow,
  DeviceRow,
  MacAddressRow,
} from './rows.js';

export function mapComment(r: CommentRow): TicketComment {
  return {
    id: String(r.id),
    author: r.author,
    role: r.role,
    content: r.content,
    createdAt: toIso(r.created_at)!,
  };
}

export function mapHistory(r: HistoryRow): TicketHistoryItem {
  return {
    id: String(r.id),
    status: r.status,
    statusLabel: r.status_label,
    updatedBy: r.updated_by,
    notes: r.notes ?? '',
    createdAt: toIso(r.created_at)!,
  };
}

export function mapAttachment(r: AttachmentRow): AttachmentMeta {
  return {
    id: String(r.id),
    originalName: r.original_name,
    mimeType: r.mime_type,
    sizeBytes: Number(r.size_bytes),
    uploadedBy: r.uploaded_by,
    createdAt: toIso(r.created_at)!,
  };
}

export function mapPublicUser(r: UserRow): PublicUser {
  return {
    id: String(r.id),
    fullName: r.full_name,
    email: r.email,
    role: r.role,
    department: r.department,
    title: r.title,
  };
}

/**
 * Build the full Ticket API object. Nested collections are passed in (they come
 * from separate queries) so this mapper stays pure and reusable.
 */
export function mapTicket(
  r: TicketRow,
  comments: TicketComment[] = [],
  history: TicketHistoryItem[] = [],
  attachments?: AttachmentMeta[],
): Ticket {
  return {
    id: String(r.id),
    code: r.code,
    title: r.title,
    requesterName: r.requester_name,
    requesterEmail: r.requester_email,
    requesterDept: r.requester_dept,
    category: r.category_id,
    subcategory: r.subcategory_id,
    type: r.type_id,
    priority: r.priority,
    description: r.description,
    status: r.status,
    createdAt: toIso(r.created_at)!,
    updatedAt: toIso(r.updated_at)!,
    assignedTo: r.assigned_to,
    periodFrom: toDateOnly(r.period_from),
    periodTo: toDateOnly(r.period_to),
    comments,
    history,
    ...(attachments ? { attachments } : {}),
    details: parseJsonColumn(r.details),
  };
}

export function mapMacAddress(r: MacAddressRow): MacAddress {
  return {
    id: r.id,
    deviceId: r.device_id,
    macType: r.mac_type as any, // MacAddressType
    macAddress: r.mac_address,
    createdAt: toIso(r.created_at)!,
    updatedAt: toIso(r.updated_at)!,
  };
}

/**
 * Build the full Device API object. Linked tickets, MAC addresses, and specifications are passed in
 * (they come from separate queries) so this mapper stays pure and reusable.
 */
export function mapDevice(
  r: DeviceRow,
  linkedTickets: LinkedTicket[] = [],
  macAddresses: MacAddress[] = [],
): Device {
  const specifications: DeviceSpecifications = {
    cpu: r.cpu,
    ramGb: r.ram_gb,
    storageGb: r.storage_gb,
    gpu: r.gpu,
    psuWatts: r.psu_watts,
    additionalSpecs: r.specs_json ? JSON.parse(r.specs_json) : undefined,
  };

  const hasSpecs = Object.values(specifications).some(v => v !== null && v !== undefined);

  return {
    id: r.id,
    code: r.code,
    deviceType: r.device_type,
    model: r.model,
    serialNumber: r.serial_number,
    status: r.status as any, // DeviceStatus type
    assignedTo: r.assigned_to,
    department: r.department,
    purchaseDate: toDateOnly(r.purchase_date),
    warrantyExpiry: toDateOnly(r.warranty_expiry),
    notes: r.notes,
    createdAt: toIso(r.created_at)!,
    updatedAt: toIso(r.updated_at)!,
    linkedTickets,
    ...(macAddresses.length > 0 ? { macAddresses } : {}),
    ...(hasSpecs ? { specifications } : {}),
  };
}
