// ============================================================================
// Typed API client for the N-VOC backend.
// - Base URL comes from VITE_API_BASE_URL (defaults to '/api' for same-origin /
//   reverse-proxy deploys).
// - JWT is held in module state + localStorage and attached as a Bearer token.
// - All errors are normalised into a single ApiError shape that mirrors the
//   backend envelope: { error: { code, message, details? } }.
// ============================================================================

import type {
  Ticket,
  TicketComment,
  TicketPriority,
  TicketStatus,
  AttachmentMeta,
  CategorySpec,
  PublicUser,
  ApprovalStep,
  ApprovalInboxItem,
} from '../types';

const BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') || '/api';

const TOKEN_STORAGE_KEY = 'nvoc_token';

// ---- Token management -------------------------------------------------------

let authToken: string | null =
  typeof localStorage !== 'undefined' ? localStorage.getItem(TOKEN_STORAGE_KEY) : null;

export function setAuthToken(token: string | null): void {
  authToken = token;
  if (typeof localStorage === 'undefined') return;
  if (token) localStorage.setItem(TOKEN_STORAGE_KEY, token);
  else localStorage.removeItem(TOKEN_STORAGE_KEY);
}

export function getAuthToken(): string | null {
  return authToken;
}

// ---- Error type -------------------------------------------------------------

export interface ApiErrorDetail {
  path: string;
  message: string;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: ApiErrorDetail[];

  constructor(status: number, code: string, message: string, details?: ApiErrorDetail[]) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  /** True when the session is invalid/expired and the user should be logged out. */
  get isAuthError(): boolean {
    return this.status === 401;
  }
}

// Callback invoked whenever a request returns 401 — wired up by AuthContext so a
// single expired token can force a global logout.
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: (() => void) | null): void {
  onUnauthorized = fn;
}

// ---- Core request helper ----------------------------------------------------

interface RequestOptions {
  method?: string;
  body?: unknown;
  // When provided, body is sent as multipart/form-data (no JSON content-type).
  formData?: FormData;
  signal?: AbortSignal;
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

  let body: BodyInit | undefined;
  if (opts.formData) {
    body = opts.formData; // browser sets the multipart boundary
  } else if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(opts.body);
  }

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method: opts.method ?? 'GET',
      headers,
      body,
      signal: opts.signal,
      credentials: 'include',
    });
  } catch (err) {
    // Network failure, CORS, or aborted request.
    if ((err as Error)?.name === 'AbortError') throw err;
    throw new ApiError(0, 'NETWORK_ERROR', 'Unable to reach the server. Check your connection.');
  }

  if (res.status === 204) return undefined as T;

  // Some endpoints (attachment download) return non-JSON; callers use rawFetch.
  const contentType = res.headers.get('content-type') ?? '';
  const isJson = contentType.includes('application/json');
  const payload = isJson ? await res.json().catch(() => null) : null;

  if (!res.ok) {
    // Rate-limit responses (429) from express-rate-limit return text/html,
    // not JSON. Handle non-JSON error bodies gracefully.
    if (!isJson) {
      const textBody = await res.text().catch(() => '');
      const apiErr = new ApiError(
        res.status,
        res.status === 429 ? 'RATE_LIMITED' : 'ERROR',
        res.status === 429
          ? 'Too many requests. Please wait a moment and try again.'
          : textBody || `Request failed (${res.status})`,
      );
      if (apiErr.isAuthError && onUnauthorized) onUnauthorized();
      throw apiErr;
    }

    const envelope = (payload as { error?: { code?: string; message?: string; details?: ApiErrorDetail[] } } | null)?.error;
    const apiErr = new ApiError(
      res.status,
      envelope?.code ?? 'ERROR',
      envelope?.message ?? `Request failed (${res.status})`,
      envelope?.details,
    );
    if (apiErr.isAuthError && onUnauthorized) onUnauthorized();
    throw apiErr;
  }

  return payload as T;
}

// Expose the resolved base URL for non-JSON cases (e.g. attachment links).
export function apiUrl(path: string): string {
  return `${BASE_URL}${path}`;
}

// ---- Response shapes (match the backend controllers) ------------------------

export interface LoginResponse {
  token: string;
  user: PublicUser;
}
export interface ValidateResponse {
  valid: boolean;
  user: PublicUser;
}
export interface TicketListResponse {
  data: Ticket[];
  page: number;
  pageSize: number;
  total: number;
}
export interface TriageResponse {
  suggestedCategory: string;
  suggestedPriority: TicketPriority;
  summary: string;
}

// ---- Ticket report response shapes ------------------------------------------

export interface PendingHardwareRequest {
  id: string;
  code: string;
  title: string;
  created_at: string;
  priority: string;
  requester_name: string;
  assigned_to: string;
  status: string;
}

export interface PendingHardwareResponse {
  pendingRequests: PendingHardwareRequest[];
}

export interface FulfillmentStat {
  category_id: string;
  total_resolved: number;
  avg_hours: number;
  min_hours: number;
  max_hours: number;
}

export interface FulfillmentTimeResponse {
  fulfillmentStats: FulfillmentStat[];
}

export interface AgeBucketsResponse {
  ageBuckets: Record<string, Record<string, number>>;
}

export interface CategoryTrendItem {
  month: string;
  category_id: string;
  count: number;
}

export interface CategoryTrendResponse {
  categoryTrend: CategoryTrendItem[];
}

// ---- Device report response shapes ------------------------------------------

export interface DeviceSummaryData {
  total: number;
  by_status: Record<string, number>;
  by_type: Record<string, number>;
  by_department: Record<string, number>;
}

export interface DeviceSummaryResponse {
  summary: DeviceSummaryData;
}

export interface AssignmentReportItem {
  device_code: string;
  model: string;
  serial_number: string;
  assigned_to: string | null;
  status: string;
  department: string | null;
}

export interface DeviceAssignmentsResponse {
  assignments: AssignmentReportItem[];
}

export interface AgingReportItem {
  device_code: string;
  model: string;
  assigned_to: string | null;
  warranty_expiry: string | null;
  days_until_expiry: number;
  status: string;
}

export interface DeviceAgingResponse {
  aging: AgingReportItem[];
}

export interface DepartmentReportItem {
  department: string;
  total: number;
  active: number;
  in_repair: number;
  retired: number;
}

export interface DeviceDepartmentResponse {
  departments: DepartmentReportItem[];
}

export interface AvailabilityData {
  in_stock: number;
  active: number;
  in_repair: number;
  retired: number;
  lost: number;
}

export interface DeviceAvailabilityResponse {
  availability: AvailabilityData;
}
export interface DeviceHistoryResponse {
  history: unknown[];
}
export interface StockMovementResponse {
  movement: unknown[];
}
export interface StockByTypeResponse {
  stockByType: unknown[];
}
export interface UnassignedDevicesResponse {
  unassigned: unknown[];
}
export interface DevicesByUserResponse {
  byUser: unknown[];
}

// ---- Device data shapes -----------------------------------------------------

export interface DeviceRecord {
  id: number;
  asset_tag: string;
  device_type: string;
  brand: string;
  model: string;
  serial_number: string;
  status: string;
  assigned_to_name: string | null;
  assigned_to_email: string | null;
  assigned_to_dept: string | null;
  condition_status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface DeviceListResponse {
  data: DeviceRecord[];
  page: number;
  pageSize: number;
  total: number;
}

export interface DeviceSingleResponse {
  data: DeviceRecord;
}

export interface ListTicketsParams {
  status?: TicketStatus;
  category?: string;
  priority?: TicketPriority;
  assignedTo?: string;
  requesterEmail?: string;
  q?: string;
  page?: number;
  pageSize?: number;
  sort?: 'newest' | 'oldest';
}

export interface DeviceReportFilters {
  department?: string;
  deviceType?: string;
  status?: string;
  [key: string]: string | undefined;
}

export interface CreateTicketPayload {
  title: string;
  description: string;
  requesterName: string;
  requesterEmail: string;
  requesterDept: string;
  category: string;
  subcategory: string;
  type?: string | null;
  priority?: TicketPriority;
  assignedTo?: string;
  periodFrom?: string | null;
  periodTo?: string | null;
  details?: Record<string, unknown>;
}

export interface UpdateTicketPayload {
  status?: TicketStatus;
  priority?: TicketPriority;
  assignedTo?: string;
  notes?: string;
}

function buildQuery(params: Record<string, unknown>): string {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') usp.set(k, String(v));
  }
  const s = usp.toString();
  return s ? `?${s}` : '';
}

// ---- Public API surface -----------------------------------------------------

export const api = {
  // Generic GET — enables ad-hoc `api.get<T>('/path')` calls.
  get<T = unknown>(path: string, signal?: AbortSignal): Promise<T> {
    return request<T>(path, { signal });
  },

  // Auth
  login(email: string, password: string): Promise<LoginResponse> {
    return request<LoginResponse>('/auth/login', { method: 'POST', body: { email, password } });
  },
  validate(): Promise<ValidateResponse> {
    return request<ValidateResponse>('/auth/validate');
  },

  // Taxonomy
  getCategories(signal?: AbortSignal): Promise<CategorySpec[]> {
    return request<CategorySpec[]>('/categories', { signal });
  },

  // Tickets
  listTickets(params: ListTicketsParams = {}, signal?: AbortSignal): Promise<TicketListResponse> {
    return request<TicketListResponse>(`/tickets${buildQuery(params as Record<string, unknown>)}`, { signal });
  },
  getTicket(id: string, signal?: AbortSignal): Promise<{ ticket: Ticket; approvals?: ApprovalStep[] }> {
    return request<{ ticket: Ticket; approvals?: ApprovalStep[] }>(`/tickets/${id}`, { signal });
  },
  createTicket(payload: CreateTicketPayload): Promise<{ ticket: Ticket }> {
    return request<{ ticket: Ticket }>('/tickets', { method: 'POST', body: payload });
  },
  // Returns updated ticket; callers may use returned ticket or refetch via getTicket
  updateTicket(id: string, payload: UpdateTicketPayload): Promise<{ ticket: Ticket }> {
    return request<{ ticket: Ticket }>(`/tickets/${id}`, { method: 'PUT', body: payload });
  },
  deleteTicket(id: string): Promise<void> {
    return request<void>(`/tickets/${id}`, { method: 'DELETE' });
  },
  // Approval workflow
  decideApproval(
    ticketId: string,
    step: number,
    payload: { decision: 'approve' | 'reject'; note?: string | null },
  ): Promise<{ ticketAction: 'advance' | 'reject' | 'none'; chain: ApprovalStep[] }> {
    return request(`/tickets/${ticketId}/approvals/${step}/decide`, { method: 'POST', body: payload });
  },
  assignApprover(
    ticketId: string,
    step: number,
    userId: number,
  ): Promise<{ chain: ApprovalStep[] }> {
    return request(`/tickets/${ticketId}/approvals/${step}/assign`, { method: 'POST', body: { userId } });
  },
  getApprovalInbox(signal?: AbortSignal): Promise<{ pending: ApprovalInboxItem[] }> {
    return request<{ pending: ApprovalInboxItem[] }>('/tickets/approvals/inbox', { signal });
  },
  addComment(
    id: string,
    payload: { author: string; role: 'requester' | 'it_support'; content: string },
  ): Promise<{ comment: TicketComment }> {
    return request<{ comment: TicketComment }>(`/tickets/${id}/comments`, {
      method: 'POST',
      body: payload,
    });
  },
  uploadAttachments(id: string, files: File[]): Promise<{ attachments: AttachmentMeta[] }> {
    const fd = new FormData();
    for (const f of files) fd.append('files', f);
    return request<{ attachments: AttachmentMeta[] }>(`/tickets/${id}/attachments`, {
      method: 'POST',
      formData: fd,
    });
  },

  // Attachments — download URL (auth header can't ride an <a href>, so we fetch).
  async downloadAttachment(id: string): Promise<Blob> {
    const res = await fetch(apiUrl(`/attachments/${id}`), {
      headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
      credentials: 'include',
    });
    if (!res.ok) throw new ApiError(res.status, 'DOWNLOAD_FAILED', 'Could not download attachment');
    return res.blob();
  },

  // AI triage
  triage(title: string, description: string): Promise<TriageResponse> {
    return request<TriageResponse>('/ai/triage', { method: 'POST', body: { title, description } });
  },

  // Ticket reports
  getPendingHardwareReport(signal?: AbortSignal): Promise<PendingHardwareResponse> {
    return request<PendingHardwareResponse>('/tickets/reports/pending-hardware', { signal });
  },
  getFulfillmentTimeReport(signal?: AbortSignal): Promise<FulfillmentTimeResponse> {
    return request<FulfillmentTimeResponse>('/tickets/reports/fulfillment-time', { signal });
  },
  getAgeBucketsReport(signal?: AbortSignal): Promise<AgeBucketsResponse> {
    return request<AgeBucketsResponse>('/tickets/reports/age-buckets', { signal });
  },
  getCategoryTrendReport(signal?: AbortSignal): Promise<CategoryTrendResponse> {
    return request<CategoryTrendResponse>('/tickets/reports/category-trend', { signal });
  },

  // Device management
  // NOTE: These return `any` because existing components use camelCase Device
  // interfaces while the backend sends snake_case. Fixing the mismatch requires
  // updating all Device component interfaces or adding a mapper layer.
  listAvailableDevices(page = 1, pageSize = 100): Promise<any> {
    return request<any>(`/devices?page=${page}&pageSize=${pageSize}&status=In%20Stock`);
  },
  listDevices(page = 1, pageSize = 100, filters: DeviceReportFilters = {}): Promise<any> {
    return request<any>(`/devices${buildQuery({ page, pageSize, ...filters })}`);
  },
  getDevice(id: number): Promise<any> {
    return request<any>(`/devices/${id}`);
  },
  createDevice(payload: any): Promise<any> {
    return request<any>('/devices', {
      method: 'POST',
      body: payload,
    });
  },
  updateDevice(id: number, payload: any): Promise<any> {
    return request<any>(`/devices/${id}`, {
      method: 'PUT',
      body: payload,
    });
  },
  createMacAddress(deviceId: number, payload: any): Promise<any> {
    return request<any>(`/devices/${deviceId}/mac`, {
      method: 'POST',
      body: payload,
    });
  },
  updateMacAddress(deviceId: number, macId: number, payload: any): Promise<any> {
    return request<any>(`/devices/${deviceId}/mac/${macId}`, {
      method: 'PUT',
      body: payload,
    });
  },
  deleteMacAddress(deviceId: number, macId: number): Promise<void> {
    return request<void>(`/devices/${deviceId}/mac/${macId}`, {
      method: 'DELETE',
    });
  },
  assignDevice(id: number, userName: string, userEmail: string, userDept?: string, ticketId?: string, reason?: string): Promise<any> {
    return request<any>(`/devices/${id}/assign`, {
      method: 'POST',
      body: { userName, userEmail, userDept, ticketId, reason },
    });
  },
  checkoutDevice(id: number, condition?: string, notes?: string, actionType?: 'return' | 'replace'): Promise<any> {
    return request<any>(`/devices/${id}/checkout`, {
      method: 'POST',
      body: { condition: condition || 'good', notes: notes || '', actionType: actionType || 'return' },
    });
  },

  // Device reports
  getDeviceSummary(): Promise<DeviceSummaryResponse> {
    return request<DeviceSummaryResponse>('/devices/reports/summary');
  },
  getDeviceAssignments(filters: DeviceReportFilters = {}): Promise<DeviceAssignmentsResponse> {
    return request<DeviceAssignmentsResponse>(`/devices/reports/assignments${buildQuery(filters)}`);
  },
  getDeviceAging(filters: DeviceReportFilters = {}): Promise<DeviceAgingResponse> {
    return request<DeviceAgingResponse>(`/devices/reports/aging${buildQuery(filters)}`);
  },
  getDeviceDepartment(): Promise<DeviceDepartmentResponse> {
    return request<DeviceDepartmentResponse>('/devices/reports/department');
  },
  getDeviceAvailability(): Promise<DeviceAvailabilityResponse> {
    return request<DeviceAvailabilityResponse>('/devices/reports/availability');
  },
  getDeviceHistory(): Promise<DeviceHistoryResponse> {
    return request<DeviceHistoryResponse>('/devices/reports/history');
  },
  getStockMovement(): Promise<StockMovementResponse> {
    return request<StockMovementResponse>('/devices/reports/stock-movement');
  },
  getStockByType(): Promise<StockByTypeResponse> {
    return request<StockByTypeResponse>('/devices/reports/stock-by-type');
  },
  getUnassignedDevices(): Promise<UnassignedDevicesResponse> {
    return request<UnassignedDevicesResponse>('/devices/reports/unassigned');
  },
  getDevicesByUser(): Promise<DevicesByUserResponse> {
    return request<DevicesByUserResponse>('/devices/reports/by-user');
  },

  // Device-ticket linking
  createDeviceLink(ticketId: string, deviceId: number, actionType: 'new' | 'related' | 'resolved' | 'affected'): Promise<any> {
    return request<any>(`/tickets/${ticketId}/link-device`, {
      method: 'POST',
      body: { deviceId, actionType },
    });
  },
};
