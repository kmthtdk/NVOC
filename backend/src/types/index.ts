// ============================================================================
// Shared domain types — mirror the frontend src/types.ts (the API contract).
// Backend serializes to exactly these shapes (camelCase, nested comments/history).
// ============================================================================

export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TicketStatus =
  | 'submitted'
  | 'processing'
  | 'pending_user'
  | 'resolved'
  | 'rejected';

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
  details: TicketDetails;
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
