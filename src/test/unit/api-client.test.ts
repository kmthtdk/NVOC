import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getAuthToken,
  setAuthToken,
  api,
  ApiError,
  setUnauthorizedHandler,
} from '../../api/client';

describe('API Client', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    setAuthToken(null);
    (global.fetch as any).mockClear();
  });

  describe('Authentication Token Management', () => {
    it('should set and retrieve auth token', () => {
      const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9';
      setAuthToken(token);
      expect(getAuthToken()).toBe(token);
    });

    it('should persist token in localStorage', () => {
      const token = 'test-token-12345';
      setAuthToken(token);
      expect(localStorage.getItem('nvoc_token')).toBe(token);
    });

    it('should clear token when set to null', () => {
      setAuthToken('token');
      setAuthToken(null);
      expect(getAuthToken()).toBeNull();
      expect(localStorage.getItem('nvoc_token')).toBeNull();
    });

    it('should handle long JWT tokens', () => {
      const longToken =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
      setAuthToken(longToken);
      expect(getAuthToken()).toBe(longToken);
    });
  });

  describe('API Error Handling', () => {
    it('should create ApiError with proper fields', () => {
      const error = new ApiError(401, 'UNAUTHORIZED', 'Invalid token', [
        { path: 'token', message: 'Expired' },
      ]);
      expect(error.status).toBe(401);
      expect(error.code).toBe('UNAUTHORIZED');
      expect(error.message).toBe('Invalid token');
      expect(error.details).toHaveLength(1);
    });

    it('should identify auth errors via isAuthError', () => {
      const authError = new ApiError(401, 'UNAUTHORIZED', 'Not authenticated');
      expect(authError.isAuthError).toBe(true);

      const otherError = new ApiError(500, 'SERVER_ERROR', 'Internal server error');
      expect(otherError.isAuthError).toBe(false);
    });

    it('should support unauthorized handler callback', () => {
      const handler = vi.fn();
      setUnauthorizedHandler(handler);

      const authError = new ApiError(401, 'UNAUTHORIZED', 'Session expired');
      expect(authError.isAuthError).toBe(true);

      setUnauthorizedHandler(null);
    });
  });

  describe('Ticket CRUD via API', () => {
    beforeEach(() => {
      (global.fetch as any).mockClear();
    });

    it('should call listTickets with correct endpoint', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        headers: { get: (k: string) => (k === 'content-type' ? 'application/json' : null) },
        json: async () => ({
          data: [{ id: '1', code: 'TICKET-001' }],
          page: 1,
          pageSize: 50,
          total: 1,
        }),
      };
      (global.fetch as any).mockResolvedValueOnce(mockResponse);

      const result = await api.listTickets({ page: 1, pageSize: 50 });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/tickets'),
        expect.any(Object)
      );
      expect(result.data).toHaveLength(1);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(50);
    });

    it('should attach Bearer token to authenticated requests', async () => {
      setAuthToken('test-token');

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: (k: string) => (k === 'content-type' ? 'application/json' : null) },
        json: async () => ({
          ticket: {
            id: '1',
            code: 'TICKET-001',
            title: 'Test',
            status: 'submitted',
            requesterName: 'John',
            requesterEmail: 'john@test.com',
            requesterDept: 'Eng',
            category: 'hw',
            subcategory: 'laptop',
            priority: 'high' as const,
            description: 'Test',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            assignedTo: '',
            periodFrom: null,
            periodTo: null,
            comments: [],
            history: [],
            details: {},
          },
        }),
      });

      const result = await api.getTicket('1');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
          }),
        })
      );
      expect(result.ticket.id).toBe('1');
    });

    it('should create ticket with payload', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 201,
        headers: { get: (k: string) => (k === 'content-type' ? 'application/json' : null) },
        json: async () => ({
          ticket: {
            id: '1',
            code: 'TICKET-2026-001',
            title: 'Test ticket',
            status: 'submitted',
            priority: 'high',
            requesterName: 'John Doe',
            requesterEmail: 'john@example.com',
            requesterDept: 'Engineering',
            category: 'hardware_request',
            subcategory: 'laptop',
            description: 'A test',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            assignedTo: '',
            periodFrom: null,
            periodTo: null,
            comments: [],
            history: [],
            details: {},
          },
        }),
      });

      const payload = {
        title: 'Test ticket',
        description: 'A test',
        requesterName: 'John Doe',
        requesterEmail: 'john@example.com',
        requesterDept: 'Engineering',
        category: 'hardware_request',
        subcategory: 'laptop',
      };

      const result = await api.createTicket(payload);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/tickets'),
        expect.objectContaining({
          method: 'POST',
        })
      );
      expect(result.ticket.id).toBe('1');
      expect(result.ticket.code).toMatch(/^TICKET-\d{4}-\d{3,4}$/);
      expect(result.ticket.title).toBe('Test ticket');
    });
  });

  describe('Device CRUD via API', () => {
    beforeEach(() => {
      (global.fetch as any).mockClear();
    });

    it('should list devices with pagination', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: (k: string) => (k === 'content-type' ? 'application/json' : null) },
        json: async () => ({
          data: [
            {
              id: 1,
              asset_tag: 'ITA-2026-001',
              device_type: 'laptop',
              status: 'Active',
            },
          ],
          page: 1,
          pageSize: 100,
          total: 1,
        }),
      });

      const result = await api.listDevices(1, 100);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/devices'),
        expect.any(Object)
      );
      expect(result.data).toHaveLength(1);
    });

    it('should assign device to user', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: (k: string) => (k === 'content-type' ? 'application/json' : null) },
        json: async () => ({
          success: true,
          message: 'Device assigned',
        }),
      });

      await api.assignDevice(1, 'John Doe', 'john@example.com', 'Engineering');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/devices/1/assign'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('John Doe'),
        })
      );
    });

    it('should checkout device', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: (k: string) => (k === 'content-type' ? 'application/json' : null) },
        json: async () => ({
          success: true,
          message: 'Device checked out',
        }),
      });

      await api.checkoutDevice(1, 'good', 'Device returned in good condition', 'return');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/devices/1/checkout'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('good'),
        })
      );
    });
  });

  describe('Device Reports via API', () => {
    beforeEach(() => {
      (global.fetch as any).mockClear();
    });

    it('should fetch device summary report', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: (k: string) => (k === 'content-type' ? 'application/json' : null) },
        json: async () => ({
          summary: {
            total: 50,
            by_status: { Active: 30, 'In Stock': 20 },
            by_type: { laptop: 25, desktop: 25 },
            by_department: { Engineering: 30, Sales: 20 },
          },
        }),
      });

      const result = await api.getDeviceSummary();

      expect(result.summary).toBeDefined();
      expect(result.summary.total).toBe(50);
    });

    it('should fetch device assignments with filters', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: (k: string) => (k === 'content-type' ? 'application/json' : null) },
        json: async () => ({
          assignments: [
            {
              device_code: 'ITA-2026-001',
              model: 'Dell Latitude',
              assigned_to: 'John Doe',
              status: 'Active',
            },
          ],
        }),
      });

      const result = await api.getDeviceAssignments({ department: 'Engineering' });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/devices/reports/assignments'),
        expect.any(Object)
      );
      expect(result.assignments).toHaveLength(1);
    });

    it('should fetch device aging report', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: (k: string) => (k === 'content-type' ? 'application/json' : null) },
        json: async () => ({
          aging: [
            {
              device_code: 'ITA-2026-001',
              warranty_expiry: '2026-12-31',
              days_until_expiry: 180,
              status: 'warning',
            },
          ],
        }),
      });

      const result = await api.getDeviceAging();

      expect(result.aging).toBeDefined();
      expect(result.aging).toHaveLength(1);
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      (global.fetch as any).mockClear();
    });

    it('should throw ApiError on 401 response', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 401,
        headers: { get: (k: string) => (k === 'content-type' ? 'application/json' : null) },
        json: async () => ({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Invalid token',
          },
        }),
      });

      await expect(api.listTickets()).rejects.toThrow(ApiError);
    });

    it('should throw ApiError on network failure', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      await expect(api.listTickets()).rejects.toThrow(ApiError);
    });

    it('should handle 204 No Content response', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 204,
        headers: { get: (k: string) => (k === 'content-type' ? 'application/json' : null) },
      });

      const result = await api.deleteTicket('1');

      expect(result).toBeUndefined();
    });
  });
});
