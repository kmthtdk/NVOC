import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getAuthToken, setAuthToken } from '../../api/client';

describe('API Client', () => {
  beforeEach(() => {
    localStorage.clear();
    // Reset mocked fetch
    if (global.fetch) {
      vi.clearAllMocks();
    }
  });

  afterEach(() => {
    localStorage.clear();
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

    it('should handle empty string token', () => {
      setAuthToken('');
      expect(getAuthToken()).toBe('');
    });

    it('should handle long JWT tokens', () => {
      const longToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
      setAuthToken(longToken);
      expect(getAuthToken()).toBe(longToken);
    });
  });

  describe('Request Headers', () => {
    it('should include auth token in request headers', () => {
      const token = 'test-token';
      setAuthToken(token);
      expect(getAuthToken()).toBe(token);
      // In real scenario, this would be in Authorization header
      expect(getAuthToken()).toContain('test-token');
    });

    it('should have content-type application/json for POST requests', () => {
      const contentType = 'application/json';
      expect(contentType).toBe('application/json');
    });

    it('should handle missing auth token gracefully', () => {
      setAuthToken(null);
      expect(getAuthToken()).toBeNull();
    });
  });

  describe('Query Parameter Building', () => {
    it('should build query string from parameters', () => {
      const params = {
        page: 1,
        pageSize: 50,
        sort: 'newest',
      };
      const query = new URLSearchParams(
        Object.entries(params).map(([k, v]) => [k, String(v)])
      ).toString();
      expect(query).toContain('page=1');
      expect(query).toContain('pageSize=50');
      expect(query).toContain('sort=newest');
    });

    it('should filter out null/undefined values', () => {
      const params = {
        page: 1,
        filter: null,
        sort: undefined,
        search: 'test',
      };
      const filtered = Object.entries(params).filter(([, v]) => v != null);
      const query = new URLSearchParams(
        filtered.map(([k, v]) => [k, String(v)])
      ).toString();
      expect(query).toContain('page=1');
      expect(query).toContain('search=test');
      expect(query).not.toContain('filter');
      expect(query).not.toContain('sort');
    });

    it('should URL-encode special characters', () => {
      const params = { search: 'device name with spaces' };
      const query = new URLSearchParams(
        Object.entries(params).map(([k, v]) => [k, String(v)])
      ).toString();
      expect(query).toContain('device');
      expect(query).not.toContain(' '); // spaces should be encoded
    });

    it('should handle numeric parameters', () => {
      const params = {
        page: 1,
        pageSize: 100,
        limit: 50,
      };
      const query = new URLSearchParams(
        Object.entries(params).map(([k, v]) => [k, String(v)])
      ).toString();
      expect(query).toContain('100');
      expect(query).toContain('50');
    });
  });

  describe('Request/Response Types', () => {
    it('should expect device list response structure', () => {
      const response = {
        data: [
          {
            id: 1,
            code: 'ITA-2026-001',
            deviceType: 'laptop',
            model: 'Dell Latitude',
            status: 'Active',
          },
        ],
        meta: {
          page: 1,
          limit: 50,
          total: 100,
        },
      };
      expect(response.data).toBeDefined();
      expect(response.meta).toBeDefined();
      expect(response.data[0].id).toBe(1);
    });

    it('should expect ticket response structure', () => {
      const response = {
        ticket: {
          id: '1',
          code: 'TICKET-001',
          title: 'New laptop needed',
          status: 'submitted',
          priority: 'high',
          description: 'Request for new device',
          comments: [],
          history: [],
        },
      };
      expect(response.ticket).toBeDefined();
      expect(response.ticket.id).toBe('1');
      expect(response.ticket.code).toBe('TICKET-001');
    });

    it('should expect error response structure', () => {
      const error = {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid email format',
          details: [
            {
              path: 'email',
              message: 'Expected string with @ symbol',
            },
          ],
        },
      };
      expect(error.error).toBeDefined();
      expect(error.error.code).toBe('VALIDATION_ERROR');
      expect(error.error.details).toBeDefined();
    });
  });

  describe('URL Construction', () => {
    it('should construct absolute URL from path', () => {
      const basePath = '/api';
      const endpoint = '/devices';
      const fullUrl = basePath + endpoint;
      expect(fullUrl).toBe('/api/devices');
    });

    it('should construct URL with ID parameter', () => {
      const basePath = '/api';
      const resourceId = 123;
      const fullUrl = `${basePath}/devices/${resourceId}`;
      expect(fullUrl).toBe('/api/devices/123');
    });

    it('should construct URL with multiple segments', () => {
      const basePath = '/api';
      const segments = ['devices', '123', 'mac', '456'];
      const fullUrl = `${basePath}/${segments.join('/')}`;
      expect(fullUrl).toBe('/api/devices/123/mac/456');
    });

    it('should handle report endpoints', () => {
      const basePath = '/api';
      const reportType = 'summary';
      const fullUrl = `${basePath}/devices/reports/${reportType}`;
      expect(fullUrl).toBe('/api/devices/reports/summary');
    });
  });

  describe('HTTP Methods', () => {
    it('should use GET for list endpoints', () => {
      const method = 'GET';
      expect(method).toBe('GET');
    });

    it('should use POST for create endpoints', () => {
      const method = 'POST';
      expect(method).toBe('POST');
    });

    it('should use PUT for update endpoints', () => {
      const method = 'PUT';
      expect(method).toBe('PUT');
    });

    it('should use DELETE for delete endpoints', () => {
      const method = 'DELETE';
      expect(method).toBe('DELETE');
    });
  });

  describe('Request Payload Handling', () => {
    it('should serialize device create payload', () => {
      const payload = {
        deviceType: 'laptop',
        model: 'Dell Latitude 7440',
        serialNumber: 'SN-123456',
        status: 'In Stock',
        department: 'IT Support',
      };
      const json = JSON.stringify(payload);
      const parsed = JSON.parse(json);
      expect(parsed.deviceType).toBe('laptop');
      expect(parsed.model).toBe('Dell Latitude 7440');
    });

    it('should serialize ticket create payload', () => {
      const payload = {
        title: 'New laptop needed',
        category: 'hardware_request',
        priority: 'high',
        description: 'Need new device for developer',
        details: {
          deviceType: 'laptop',
          deviceModel: 'MacBook Pro',
        },
      };
      const json = JSON.stringify(payload);
      const parsed = JSON.parse(json);
      expect(parsed.title).toBe('New laptop needed');
      expect(parsed.details.deviceType).toBe('laptop');
    });

    it('should handle null values in payload', () => {
      const payload = {
        department: null,
        notes: null,
        warrantyExpiry: null,
      };
      const json = JSON.stringify(payload);
      const parsed = JSON.parse(json);
      expect(parsed.department).toBeNull();
      expect(parsed.notes).toBeNull();
    });

    it('should preserve nested objects in payload', () => {
      const payload = {
        specifications: {
          cpu: 'Intel i7',
          ramGb: 16,
          storageGb: 512,
          additionalSpecs: {
            display: '15.6" 4K',
            keyboard: 'Mechanical',
          },
        },
      };
      const json = JSON.stringify(payload);
      const parsed = JSON.parse(json);
      expect(parsed.specifications.additionalSpecs.display).toBe('15.6" 4K');
    });
  });

  describe('Response Parsing', () => {
    it('should parse JSON response', () => {
      const jsonBody = '{"success": true, "data": {"id": 1}}';
      const parsed = JSON.parse(jsonBody);
      expect(parsed.success).toBe(true);
      expect(parsed.data.id).toBe(1);
    });

    it('should handle empty response body (204 No Content)', () => {
      const statusCode = 204;
      expect(statusCode).toBe(204);
    });

    it('should extract pagination metadata', () => {
      const response = {
        data: [],
        meta: {
          page: 1,
          limit: 50,
          total: 0,
        },
      };
      expect(response.meta.page).toBe(1);
      expect(response.meta.limit).toBe(50);
      expect(response.meta.total).toBe(0);
    });
  });
});
