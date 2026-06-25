export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';

export type TicketStatus = 'submitted' | 'waiting' | 'resolved' | 'rejected';

export interface TicketComment {
  id: string;
  author: string;
  role: 'requester' | 'it_support';
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

export type UserRole = 'requester' | 'it_support' | 'admin';

export interface PublicUser {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  department: string | null;
  title: string | null;
}

export interface LinkedDevice {
  deviceId: number;
  actionType: 'new' | 'repair' | 'return' | 'replace';
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
  type?: string | null;
  priority: TicketPriority;
  description: string;
  status: TicketStatus;
  createdAt: string;
  updatedAt: string;
  assignedTo: string;
  periodFrom?: string | null;
  periodTo?: string | null;
  comments: TicketComment[];
  history: TicketHistoryItem[];
  attachments?: AttachmentMeta[];
  linkedDevices?: LinkedDevice[];
  details: {
    // Dynamic specifications
    // Daily support info:
    osType?: string;
    softwareName?: string;
    // Network info:
    ipAddress?: string;
    macAddress?: string;
    wifiUserName?: string;
    wifiDeviceType?: string;
    // Security / Firewall:
    sourceIp?: string;
    destinationIp?: string;
    protocolPort?: string;
    firewallAction?: 'allow' | 'deny';
    // Device support:
    deviceActionType?: 'new' | 'replace' | 'repair' | 'return';
    deviceType?: string;
    deviceModelName?: string;
    reasonForChange?: string;
    // Security Exception:
    usbDuration?: string;
    usbJustification?: string;
    decryptionFiles?: string;
    pcSecurityHost?: string;
    pcSecurityReason?: string;
    // Other Service:
    serviceName?: string;
    serviceDescription?: string;
    // Server:
    serverAction?: 'folder' | 'permission' | 'ai';
    folderActionType?: 'create' | 'restore';
    folderPath?: string;
    permissionActionType?: string[]; // e.g. ['read', 'write', 'modify', 'full']
    targetUser?: string;
    aiModelName?: string;
    aiPurposeOnly?: string;
  };
}

export interface ITSupportType {
  id: string;
  name: string;
  period: 'Apply' | 'Non Apply';
}

export interface ITSubcategory {
  id: string;
  name: string;
  description: string;
  types: ITSupportType[];
}

export interface CategorySpec {
  id: string;
  name: string;
  icon: string;
  description: string;
  subcategories: ITSubcategory[];
}
