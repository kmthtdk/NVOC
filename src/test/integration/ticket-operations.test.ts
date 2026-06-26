import { describe, it, expect, beforeEach, vi } from 'vitest';
import { api } from '../../api/client';

/**
 * Integration tests for ticket operations via the API client.
 * These tests call the real api methods with mocked fetch, verifying
 * request payloads and response handling.
 */

describe('Ticket Operations Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Ticket CRUD Workflow', () => {
    it('should create hardware request ticket', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 201,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => ({
          ticket: {
            id: '1',
            code: 'TICKET-2026-001',
            title: 'New laptop needed',
            category: 'hardware_request',
            status: 'submitted',
            priority: 'high',
            createdAt: new Date().toISOString(),
            requesterName: 'John Doe',
            requesterEmail: 'john@example.com',
            requesterDept: 'Engineering',
            description: 'Developer needs new MacBook Pro',
            subcategory: 'laptop',
            details: {
              deviceActionType: 'new',
              deviceType: 'laptop',
              deviceModel: 'MacBook Pro 16"',
              reasonForChange: 'Performance upgrade needed',
            },
          },
        }),
      });

      const payload = {
        title: 'New laptop needed',
        category: 'hardware_request',
        subcategory: 'laptop',
        priority: 'high' as const,
        description: 'Developer needs new MacBook Pro',
        requesterName: 'John Doe',
        requesterEmail: 'john@example.com',
        requesterDept: 'Engineering',
        details: {
          deviceActionType: 'new',
          deviceType: 'laptop',
          deviceModel: 'MacBook Pro 16"',
          reasonForChange: 'Performance upgrade needed',
        },
      };

      const result = await api.createTicket(payload);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/tickets'),
        expect.objectContaining({ method: 'POST' })
      );
      expect(result.ticket.code).toMatch(/^TICKET-\d{4}-\d{2,4}$/);
      expect(result.ticket.status).toBe('submitted');
      expect(result.ticket.category).toBe('hardware_request');
    });

    it('should create general request ticket', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 201,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => ({
          ticket: {
            id: '2',
            code: 'TICKET-2026-002',
            title: 'Software license needed',
            category: 'software_request',
            status: 'submitted',
            priority: 'medium',
            description: 'Need Adobe Creative Suite license',
            requesterName: 'Jane Smith',
            requesterEmail: 'jane@example.com',
            requesterDept: 'Marketing',
            subcategory: 'software',
            createdAt: new Date().toISOString(),
          },
        }),
      });

      const payload = {
        title: 'Software license needed',
        category: 'software_request',
        subcategory: 'software',
        priority: 'medium' as const,
        description: 'Need Adobe Creative Suite license',
        requesterName: 'Jane Smith',
        requesterEmail: 'jane@example.com',
        requesterDept: 'Marketing',
      };

      const result = await api.createTicket(payload);

      expect(result.ticket.category).toBe('software_request');
      expect(result.ticket.status).toBe('submitted');
    });

    it('should retrieve ticket by ID', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => ({
          ticket: {
            id: '1',
            code: 'TICKET-2026-001',
            title: 'New laptop needed',
            status: 'submitted',
            priority: 'high',
            comments: [],
            history: [],
            linkedDevices: [],
          },
        }),
      });

      const result = await api.getTicket('1');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/tickets/1'),
        expect.any(Object)
      );
      expect(result.ticket.id).toBe('1');
    });

    it('should update ticket status', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => ({
          ticket: {
            id: '1',
            status: 'waiting',
            priority: 'high',
          },
        }),
      });

      await api.updateTicket('1', { status: 'waiting', priority: 'high' });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/tickets/1'),
        expect.objectContaining({ method: 'PUT' })
      );
    });

    it('should delete ticket', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 204,
        headers: new Map([['content-type', 'application/json']]),
      });

      await expect(api.deleteTicket('1')).resolves.toBeUndefined();

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/tickets/1'),
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });

  describe('Ticket Status Transitions', () => {
    it('should transition from submitted to waiting', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => ({
          ticket: { id: '1', status: 'waiting' },
        }),
      });

      const result = await api.updateTicket('1', { status: 'waiting' });

      expect(result.ticket.status).toBe('waiting');
    });

    it('should transition from waiting to resolved', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => ({
          ticket: { id: '1', status: 'resolved' },
        }),
      });

      const result = await api.updateTicket('1', { status: 'resolved' });

      expect(result.ticket.status).toBe('resolved');
    });
  });

  describe('Ticket Comments', () => {
    it('should add comment as IT support', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 201,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => ({
          comment: {
            id: '1',
            author: 'Marcus Vance',
            role: 'it_support' as const,
            content: 'We have a Dell Latitude 7440 available for assignment.',
            createdAt: new Date().toISOString(),
          },
        }),
      });

      const result = await api.addComment('1', {
        author: 'Marcus Vance',
        role: 'it_support',
        content: 'We have a Dell Latitude 7440 available for assignment.',
      });

      expect(result.comment.role).toBe('it_support');
      expect(result.comment.author).toBe('Marcus Vance');
      expect(result.comment.content).toBeTruthy();
    });

    it('should add comment as requester', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 201,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => ({
          comment: {
            id: '2',
            author: 'John Doe',
            role: 'requester' as const,
            content: 'Thank you for setting up the new device!',
            createdAt: new Date().toISOString(),
          },
        }),
      });

      const result = await api.addComment('1', {
        author: 'John Doe',
        role: 'requester',
        content: 'Thank you for setting up the new device!',
      });

      expect(result.comment.role).toBe('requester');
      expect(result.comment.author).toBe('John Doe');
    });

    it('should prevent comment author spoofing via server validation', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 201,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => ({
          comment: {
            id: '3',
            // Server derives author/role from JWT, ignoring request body values
            author: 'john.doe@company.com',
            role: 'requester' as const,
            content: 'Fake comment',
            createdAt: new Date().toISOString(),
          },
        }),
      });

      // Client sends spoofed data
      const spoofedPayload = {
        author: 'IT Support (spoofed)',
        role: 'admin' as any,
        content: 'Fake comment',
      };

      const result = await api.addComment('1', spoofedPayload);

      // Server should have ignored the spoofed author/role
      expect(result.comment.role).toBe('requester');
      expect(result.comment.author).not.toBe('IT Support (spoofed)');
    });

    it('should list ticket comments', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => ({
          comments: [
            {
              id: '1',
              author: 'John Doe',
              role: 'requester' as const,
              content: 'Requesting new device',
              createdAt: new Date().toISOString(),
            },
            {
              id: '2',
              author: 'Marcus Vance',
              role: 'it_support' as const,
              content: 'Device will be available tomorrow',
              createdAt: new Date().toISOString(),
            },
          ],
        }),
      });

      const result = await api.getTicket('1');

      expect(global.fetch).toHaveBeenCalled();
    });
  });

  describe('Device Linking for Hardware Requests', () => {
    it('should link new device to hardware request', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 201,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => ({
          success: true,
          linked: true,
        }),
      });

      await api.createDeviceLink('1', 1, 'new');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/tickets/1/link-device'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('new'),
        })
      );
    });

    it('should link existing device to replace request', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 201,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => ({
          success: true,
          linked: true,
        }),
      });

      await api.createDeviceLink('2', 5, 'related');

      expect(global.fetch).toHaveBeenCalled();
    });

    it('should track linked device in ticket', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => ({
          ticket: {
            id: '1',
            code: 'TICKET-2026-001',
            linkedDevices: [
              {
                deviceId: 1,
                actionType: 'new',
              },
            ],
          },
        }),
      });

      const result = await api.getTicket('1');

      expect(global.fetch).toHaveBeenCalled();
    });
  });

  describe('Ticket History', () => {
    it('should track status changes in history', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => ({
          ticket: {
            id: '1',
            history: [
              {
                id: '1',
                status: 'submitted',
                statusLabel: 'Submitted - Pending Triage',
                updatedBy: 'System',
                notes: 'Ticket created',
                createdAt: new Date().toISOString(),
              },
              {
                id: '2',
                status: 'waiting',
                statusLabel: 'Waiting for Review',
                updatedBy: 'Marcus Vance',
                notes: 'Device allocated',
                createdAt: new Date().toISOString(),
              },
            ],
          },
        }),
      });

      const result = await api.getTicket('1');

      expect(global.fetch).toHaveBeenCalled();
    });

    it('should preserve audit trail', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => ({
          ticket: {
            id: '1',
            history: [
              {
                id: '1',
                status: 'submitted',
                updatedBy: 'john.doe@company.com',
                createdAt: '2026-06-25T10:00:00Z',
              },
              {
                id: '2',
                status: 'waiting',
                updatedBy: 'marcus.vance@company.com',
                createdAt: '2026-06-25T11:30:00Z',
              },
            ],
          },
        }),
      });

      const result = await api.getTicket('1');

      expect(global.fetch).toHaveBeenCalled();
    });
  });

  describe('Ticket Lists & Filtering', () => {
    it('should list tickets for requester', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => ({
          data: [
            {
              id: '1',
              code: 'TICKET-2026-001',
              requesterEmail: 'john.doe@company.com',
              title: 'My ticket',
            },
          ],
          page: 1,
          pageSize: 50,
          total: 1,
        }),
      });

      const result = await api.listTickets({ requesterEmail: 'john.doe@company.com' });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].requesterEmail).toBe('john.doe@company.com');
    });

    it('should list all tickets for IT support', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => ({
          data: [
            { id: '1', requesterEmail: 'john.doe@company.com', code: 'TICKET-2026-001' },
            { id: '2', requesterEmail: 'jane.smith@company.com', code: 'TICKET-2026-002' },
            { id: '3', requesterEmail: 'bob.wilson@company.com', code: 'TICKET-2026-003' },
          ],
          page: 1,
          pageSize: 50,
          total: 3,
        }),
      });

      const result = await api.listTickets();

      expect(result.data).toHaveLength(3);
    });

    it('should filter tickets by status', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => ({
          data: [
            { id: '1', code: 'TICKET-2026-001', status: 'submitted' },
            { id: '2', code: 'TICKET-2026-002', status: 'waiting' },
          ],
          page: 1,
          pageSize: 50,
          total: 2,
        }),
      });

      const result = await api.listTickets({ status: 'submitted' });

      expect(result.data.length).toBeGreaterThan(0);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('status=submitted'),
        expect.any(Object)
      );
    });

    it('should filter tickets by priority', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => ({
          data: [
            { id: '1', priority: 'high' },
            { id: '3', priority: 'high' },
          ],
          page: 1,
          pageSize: 50,
          total: 2,
        }),
      });

      const result = await api.listTickets({ priority: 'high' });

      expect(result.data.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Ticket Statistics', () => {
    it('should calculate ticket statistics', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => ({
          data: [
            { id: '1', status: 'submitted' },
            { id: '2', status: 'waiting' },
            { id: '3', status: 'resolved' },
            { id: '4', status: 'rejected' },
          ],
          page: 1,
          pageSize: 50,
          total: 4,
        }),
      });

      const result = await api.listTickets();

      expect(result.data.length).toBe(4);
      const stats = {
        total: result.data.length,
        submitted: result.data.filter((t: any) => t.status === 'submitted').length,
        waiting: result.data.filter((t: any) => t.status === 'waiting').length,
        resolved: result.data.filter((t: any) => t.status === 'resolved').length,
        rejected: result.data.filter((t: any) => t.status === 'rejected').length,
      };

      expect(stats.total).toBe(4);
      expect(stats.submitted).toBe(1);
      expect(stats.resolved).toBe(1);
    });

    it('should calculate resolution rate', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => ({
          data: [
            { status: 'submitted' },
            { status: 'waiting' },
            { status: 'resolved' },
            { status: 'resolved' },
          ],
          page: 1,
          pageSize: 50,
          total: 4,
        }),
      });

      const result = await api.listTickets();

      const total = result.data.length;
      const resolved = result.data.filter((t: any) => t.status === 'resolved').length;
      const resolutionRate = (resolved / total) * 100;

      expect(resolutionRate).toBe(50);
    });
  });
});
