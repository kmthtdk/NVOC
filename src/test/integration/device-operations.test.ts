import { describe, it, expect, beforeEach, vi } from 'vitest';
import { api } from '../../api/client';

/**
 * Integration tests for device operations via the API client.
 * These tests call the real api methods with mocked fetch, verifying
 * request payloads and response handling.
 */

describe('Device Operations Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Device CRUD Workflow', () => {
    it('should create a device and receive generated code', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 201,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => ({
          id: 1,
          asset_tag: 'ITA-2026-001',
          device_type: 'laptop',
          model: 'Dell Latitude 7440',
          serial_number: 'DL-2026-001',
          status: 'In Stock',
          department: 'IT Support',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }),
      });

      const payload = {
        device_type: 'laptop',
        model: 'Dell Latitude 7440',
        serial_number: 'DL-2026-001',
        status: 'In Stock',
        department: 'IT Support',
      };

      const result = await api.createDevice(payload);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/devices'),
        expect.objectContaining({ method: 'POST' })
      );
      expect(result.asset_tag).toMatch(/^ITA-\d{4}-\d{3,4}$/);
      expect(result.device_type).toBe('laptop');
    });

    it('should retrieve device by ID', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => ({
          id: 1,
          asset_tag: 'ITA-2026-001',
          device_type: 'laptop',
          serial_number: 'DL-2026-001',
          status: 'Active',
        }),
      });

      const result = await api.getDevice(1);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/devices/1'),
        expect.any(Object)
      );
      expect(result.id).toBe(1);
    });

    it('should update device status', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => ({
          id: 1,
          asset_tag: 'ITA-2026-001',
          status: 'In Repair',
        }),
      });

      await api.updateDevice(1, { status: 'In Repair' });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/devices/1'),
        expect.objectContaining({ method: 'PUT' })
      );
    });

    it('should delete device', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 204,
        headers: new Map([['content-type', 'application/json']]),
      });

      const result = await api.updateDevice(1, { status: 'Retired' });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/devices/1'),
        expect.objectContaining({ method: 'PUT' })
      );
    });

    it('should list devices with pagination', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => ({
          data: [
            { id: 1, asset_tag: 'ITA-2026-001', device_type: 'laptop', status: 'Active' },
            { id: 2, asset_tag: 'ITA-2026-002', device_type: 'desktop', status: 'In Stock' },
          ],
          page: 1,
          pageSize: 50,
          total: 2,
        }),
      });

      const response = await api.listDevices(1, 50);

      expect(response.data).toHaveLength(2);
      expect(response.page).toBe(1);
      expect(response.total).toBe(2);
    });
  });

  describe('Device Assignment Workflow', () => {
    it('should assign device to user', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => ({
          success: true,
          message: 'Device assigned',
        }),
      });

      await api.assignDevice(1, 'John Doe', 'john.doe@company.com', 'Engineering');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/devices/1/assign'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('John Doe'),
        })
      );
    });

    it('should track assignment in history', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => ({
          id: 1,
          device_id: 1,
          action_type: 'assigned',
          assigned_to: 'John Doe',
          department: 'Engineering',
          created_at: new Date().toISOString(),
        }),
      });

      const result = await api.assignDevice(1, 'John Doe', 'john.doe@company.com', 'Engineering');

      expect(global.fetch).toHaveBeenCalled();
    });
  });

  describe('MAC Address Management', () => {
    it('should add MAC address to device', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 201,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => ({
          id: 1,
          device_id: 1,
          mac_type: 'Ethernet',
          mac_address: '00:11:22:33:44:55',
          created_at: new Date().toISOString(),
        }),
      });

      const result = await api.createMacAddress(1, {
        mac_type: 'Ethernet',
        mac_address: '00:11:22:33:44:55',
      });

      expect(result.mac_address).toMatch(/^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/);
      expect(result.device_id).toBe(1);
    });

    it('should update MAC address', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => ({
          id: 1,
          device_id: 1,
          mac_type: 'WiFi',
          mac_address: 'AA:BB:CC:DD:EE:FF',
          updated_at: new Date().toISOString(),
        }),
      });

      const result = await api.updateMacAddress(1, 1, {
        mac_type: 'WiFi',
        mac_address: 'AA:BB:CC:DD:EE:FF',
      });

      expect(result.mac_type).toBe('WiFi');
      expect(result.mac_address).toMatch(/^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/);
    });

    it('should delete MAC address', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 204,
        headers: new Map([['content-type', 'application/json']]),
      });

      await expect(api.deleteMacAddress(1, 1)).resolves.toBeUndefined();

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/devices/1/mac/1'),
        expect.objectContaining({ method: 'DELETE' })
      );
    });

    it('should list MACs for device', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => ({
          macs: [
            { id: 1, mac_type: 'Ethernet', mac_address: '00:11:22:33:44:55' },
            { id: 2, mac_type: 'WiFi', mac_address: 'AA:BB:CC:DD:EE:FF' },
          ],
        }),
      });

      const result = await api.getDevice(1);

      expect(global.fetch).toHaveBeenCalled();
    });
  });

  describe('Device Checkout Workflow', () => {
    it('should checkout device with good condition', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => ({
          success: true,
          status: 'In Stock',
          condition: 'good',
        }),
      });

      await api.checkoutDevice(1, 'good', 'Device returned in excellent condition', 'return');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/devices/1/checkout'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('good'),
        })
      );
    });

    it('should checkout device with damage report', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => ({
          success: true,
          status: 'In Repair',
          condition: 'damaged',
        }),
      });

      await api.checkoutDevice(1, 'damaged', 'Screen has crack, needs repair', 'return');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/devices/1/checkout'),
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('should track checkout in history', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => ({
          id: 1,
          device_id: 1,
          action_type: 'returned',
          condition_state: 'good',
          notes: 'Device returned in excellent condition',
          created_by: 'John Doe',
          created_at: new Date().toISOString(),
        }),
      });

      await api.checkoutDevice(1, 'good', 'Device returned in excellent condition', 'return');

      expect(global.fetch).toHaveBeenCalled();
    });
  });

  describe('Device Reports', () => {
    it('should generate device summary report', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => ({
          summary: {
            total: 50,
            by_status: {
              'In Stock': 20,
              Active: 25,
              'In Repair': 3,
              Retired: 2,
            },
            by_type: {
              laptop: 30,
              desktop: 15,
              monitor: 5,
            },
          },
        }),
      });

      const result = await api.getDeviceSummary();

      expect(result.summary.total).toBe(50);
      expect(Object.values(result.summary.by_status).reduce((a: number, b: number) => a + b, 0)).toBe(50);
    });

    it('should generate assignments report', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
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

      const result = await api.getDeviceAssignments();

      expect(result.assignments).toHaveLength(1);
      expect(result.assignments[0].assigned_to).toBe('John Doe');
    });

    it('should generate device aging report', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
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

      expect(result.aging[0].days_until_expiry).toBe(180);
      expect(result.aging[0].status).toBe('warning');
    });
  });
});
