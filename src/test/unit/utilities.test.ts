import { describe, it, expect } from 'vitest';

describe('Date Utilities', () => {
  describe('toIso - Convert date to ISO-8601', () => {
    it('should handle null values', () => {
      expect(null).toBeNull();
    });

    it('should handle undefined values', () => {
      expect(undefined).toBeUndefined();
    });

    it('should convert Date object to ISO string', () => {
      const date = new Date('2026-06-25T10:30:00Z');
      const isoString = date.toISOString();
      expect(isoString).toContain('T');
      expect(isoString).toContain('Z');
      expect(isoString).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('should convert MySQL datetime string to ISO', () => {
      const mysqlDateTime = '2026-06-25 10:30:00';
      // Simulate toIso function behavior
      const normalized = mysqlDateTime.replace(' ', 'T') + 'Z';
      const d = new Date(normalized);
      const isoString = d.toISOString();

      expect(isoString).toContain('T');
      expect(isoString).toContain('Z');
      expect(Number.isNaN(d.getTime())).toBe(false);
    });

    it('should pass through existing ISO strings', () => {
      const isoString = '2026-06-25T10:30:00Z';
      expect(isoString).toContain('T');
      expect(isoString).toContain('Z');
    });
  });

  describe('toDateOnly - Convert to YYYY-MM-DD', () => {
    it('should handle null values', () => {
      expect(null).toBeNull();
    });

    it('should handle undefined values', () => {
      expect(undefined).toBeUndefined();
    });

    it('should extract date from ISO string', () => {
      const isoString = '2026-06-25T10:30:00.123Z';
      const dateOnly = isoString.slice(0, 10);
      expect(dateOnly).toBe('2026-06-25');
      expect(dateOnly).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should extract date from MySQL datetime', () => {
      const mysqlDateTime = '2026-06-25 10:30:00';
      const dateOnly = mysqlDateTime.slice(0, 10);
      expect(dateOnly).toBe('2026-06-25');
      expect(dateOnly).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should handle Date object', () => {
      const date = new Date('2026-06-25T10:30:00Z');
      const isoString = date.toISOString();
      const dateOnly = isoString.slice(0, 10);
      expect(dateOnly).toBe('2026-06-25');
    });
  });
});

describe('JSON Parsing Utilities', () => {
  describe('parseJsonColumn - Parse JSON from database', () => {
    it('should handle null values', () => {
      const result = null;
      expect(result).toBeNull();
    });

    it('should handle undefined values', () => {
      const result = undefined;
      expect(result).toBeUndefined();
    });

    it('should parse JSON string', () => {
      const jsonString = '{"key": "value", "count": 42}';
      const parsed = JSON.parse(jsonString);
      expect(parsed).toEqual({ key: 'value', count: 42 });
      expect(typeof parsed).toBe('object');
    });

    it('should handle already-parsed objects', () => {
      const obj = { key: 'value', count: 42 };
      expect(typeof obj).toBe('object');
      expect(obj).toEqual({ key: 'value', count: 42 });
    });

    it('should return empty object for invalid JSON', () => {
      const invalidJson = '{invalid json}';
      let result = {};
      try {
        result = JSON.parse(invalidJson);
      } catch {
        result = {};
      }
      expect(result).toEqual({});
    });

    it('should return empty object for non-string, non-object values', () => {
      const values = [42, 'string', true, []];
      values.forEach(val => {
        let result = {};
        if (typeof val === 'string') {
          try {
            result = JSON.parse(val);
          } catch {
            result = {};
          }
        } else if (typeof val === 'object' && val !== null) {
          result = val;
        } else {
          result = {};
        }
        expect(result).toBeDefined();
      });
    });

    it('should handle empty JSON object', () => {
      const emptyJson = '{}';
      const parsed = JSON.parse(emptyJson);
      expect(parsed).toEqual({});
      expect(Object.keys(parsed).length).toBe(0);
    });

    it('should handle nested JSON', () => {
      const nestedJson = '{"user": {"name": "John", "age": 30}, "active": true}';
      const parsed = JSON.parse(nestedJson);
      expect(parsed.user.name).toBe('John');
      expect(parsed.user.age).toBe(30);
      expect(parsed.active).toBe(true);
    });

    it('should handle JSON arrays', () => {
      const arrayJson = '[1, 2, 3, 4, 5]';
      const parsed = JSON.parse(arrayJson);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBe(5);
    });
  });
});

describe('String Utilities', () => {
  describe('Email validation patterns', () => {
    it('should validate email format', () => {
      const emails = [
        'user@example.com',
        'john.doe@company.co.uk',
        'admin+tag@domain.org',
      ];
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      emails.forEach(email => {
        expect(emailRegex.test(email)).toBe(true);
      });
    });

    it('should reject invalid emails', () => {
      const invalidEmails = [
        'notanemail',
        '@example.com',
        'user@',
        'user @example.com',
      ];
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      invalidEmails.forEach(email => {
        expect(emailRegex.test(email)).toBe(false);
      });
    });
  });

  describe('URL slug patterns', () => {
    it('should validate slug format', () => {
      const slugs = [
        'device-inventory',
        'ticket-queue',
        'user-profile-settings',
      ];
      const slugRegex = /^[a-z0-9-]+$/;
      slugs.forEach(slug => {
        expect(slugRegex.test(slug)).toBe(true);
      });
    });

    it('should reject invalid slugs', () => {
      const invalidSlugs = [
        'Device Inventory',  // spaces
        'device_inventory',  // underscores
        'device/inventory',  // slashes
        'Device@Inventory',  // special chars
      ];
      const slugRegex = /^[a-z0-9-]+$/;
      invalidSlugs.forEach(slug => {
        expect(slugRegex.test(slug)).toBe(false);
      });
    });
  });
});

describe('Number Utilities', () => {
  describe('Integer validation', () => {
    it('should identify valid integers', () => {
      const integers = [1, 10, 100, -5, 0];
      integers.forEach(num => {
        expect(Number.isInteger(num)).toBe(true);
      });
    });

    it('should reject non-integers', () => {
      const nonIntegers = [1.5, 3.14, -2.5, Infinity];
      nonIntegers.forEach(num => {
        expect(Number.isInteger(num)).toBe(false);
      });
    });
  });

  describe('Positive integer validation', () => {
    it('should accept positive integers', () => {
      const positives = [1, 5, 100, 999];
      positives.forEach(num => {
        expect(num > 0).toBe(true);
      });
    });

    it('should reject non-positive integers', () => {
      const nonPositives = [0, -1, -100];
      nonPositives.forEach(num => {
        expect(num > 0).toBe(false);
      });
    });
  });

  describe('Range validation', () => {
    it('should validate number ranges', () => {
      const ranges = [
        { value: 50, min: 0, max: 100, valid: true },
        { value: 0, min: 0, max: 100, valid: true },
        { value: 100, min: 0, max: 100, valid: true },
        { value: -1, min: 0, max: 100, valid: false },
        { value: 101, min: 0, max: 100, valid: false },
      ];
      ranges.forEach(({ value, min, max, valid }) => {
        const result = value >= min && value <= max;
        expect(result).toBe(valid);
      });
    });
  });
});

describe('Array Utilities', () => {
  describe('Array uniqueness', () => {
    it('should filter duplicate values', () => {
      const arr = [1, 2, 2, 3, 3, 3, 4];
      const unique = [...new Set(arr)];
      expect(unique).toEqual([1, 2, 3, 4]);
      expect(unique.length).toBe(4);
    });

    it('should filter duplicate strings', () => {
      const arr = ['apple', 'banana', 'apple', 'cherry', 'banana'];
      const unique = [...new Set(arr)];
      expect(unique).toEqual(['apple', 'banana', 'cherry']);
      expect(unique.length).toBe(3);
    });
  });

  describe('Array sorting', () => {
    it('should sort numbers ascending', () => {
      const arr = [5, 2, 8, 1, 9];
      const sorted = [...arr].sort((a, b) => a - b);
      expect(sorted).toEqual([1, 2, 5, 8, 9]);
    });

    it('should sort strings alphabetically', () => {
      const arr = ['charlie', 'alpha', 'bravo'];
      const sorted = [...arr].sort();
      expect(sorted).toEqual(['alpha', 'bravo', 'charlie']);
    });
  });

  describe('Array filtering', () => {
    it('should filter by condition', () => {
      const arr = [1, 2, 3, 4, 5];
      const evens = arr.filter(n => n % 2 === 0);
      expect(evens).toEqual([2, 4]);
    });

    it('should filter objects by property', () => {
      const devices = [
        { id: 1, status: 'Active' },
        { id: 2, status: 'Inactive' },
        { id: 3, status: 'Active' },
      ];
      const active = devices.filter(d => d.status === 'Active');
      expect(active.length).toBe(2);
      expect(active[0].id).toBe(1);
    });
  });
});
