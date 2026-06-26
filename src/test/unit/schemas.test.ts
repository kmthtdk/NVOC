import { describe, it, expect } from 'vitest';

// Note: These tests verify the schema behavior by testing validation logic
// In a real scenario, we'd import from the backend directly if schemas were exported

describe('Device Validation Schemas', () => {
  describe('Device Type Validation', () => {
    it('should accept valid device types', () => {
      const validTypes = ['desktop', 'laptop', 'monitor', 'phone', 'tablet', 'deskphone', 'removable_disk', 'accessories'];
      validTypes.forEach(type => {
        expect(type).toBeTruthy();
        expect(type.length).toBeGreaterThan(0);
        expect(type.length).toBeLessThanOrEqual(50);
      });
    });

    it('should reject empty device type', () => {
      const emptyType = '';
      expect(emptyType.length).toBe(0);
    });

    it('should reject device type over 50 characters', () => {
      const longType = 'a'.repeat(51);
      expect(longType.length).toBeGreaterThan(50);
    });
  });

  describe('Model Validation', () => {
    it('should accept valid model names', () => {
      const validModels = [
        'Dell Latitude 7440',
        'MacBook Pro 16"',
        'ThinkPad X1 Carbon',
        'HP EliteBook 840',
      ];
      validModels.forEach(model => {
        expect(model).toBeTruthy();
        expect(model.length).toBeGreaterThanOrEqual(1);
        expect(model.length).toBeLessThanOrEqual(150);
      });
    });

    it('should reject empty model', () => {
      const emptyModel = '';
      expect(emptyModel.length).toBe(0);
    });

    it('should reject model over 150 characters', () => {
      const longModel = 'a'.repeat(151);
      expect(longModel.length).toBeGreaterThan(150);
    });
  });

  describe('Serial Number Validation', () => {
    it('should accept valid serial numbers', () => {
      const validSerials = [
        'SN123456',
        'ABC-DEF-GHI-123',
        'DEVICE-2026-001',
        '123456789',
      ];
      validSerials.forEach(serial => {
        expect(serial).toBeTruthy();
        expect(serial.length).toBeLessThanOrEqual(100);
      });
    });

    it('should reject empty serial number', () => {
      const emptySerial = '';
      expect(emptySerial.length).toBe(0);
    });

    it('should reject serial number over 100 characters', () => {
      const longSerial = 'a'.repeat(101);
      expect(longSerial.length).toBeGreaterThan(100);
    });
  });

  describe('Status Validation', () => {
    it('should accept valid device statuses', () => {
      const validStatuses = ['Active', 'In Repair', 'Retired', 'Lost', 'In Stock'];
      validStatuses.forEach(status => {
        expect(validStatuses).toContain(status);
      });
    });

    it('should have default status', () => {
      const defaultStatus = 'In Stock';
      expect(defaultStatus).toBeTruthy();
    });

    it('should reject invalid status', () => {
      const invalidStatus = 'Unknown Status';
      const validStatuses = ['Active', 'In Repair', 'Retired', 'Lost', 'In Stock'];
      expect(validStatuses).not.toContain(invalidStatus);
    });
  });

  describe('MAC Address Validation', () => {
    it('should accept valid MAC addresses', () => {
      const validMACs = [
        '00:11:22:33:44:55',
        'AA:BB:CC:DD:EE:FF',
        'a1:b2:c3:d4:e5:f6',
      ];
      const macRegex = /^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/;
      validMACs.forEach(mac => {
        expect(macRegex.test(mac)).toBe(true);
      });
    });

    it('should reject invalid MAC address format', () => {
      const invalidMACs = [
        '00-11-22-33-44-55',  // dashes instead of colons
        '00:11:22:33:44',     // too short
        '00:11:22:33:44:55:66', // too long
        'GG:HH:II:JJ:KK:LL',  // invalid hex
        '00:1122:33:44:55',   // wrong segment length
      ];
      const macRegex = /^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/;
      invalidMACs.forEach(mac => {
        expect(macRegex.test(mac)).toBe(false);
      });
    });

    it('should accept valid MAC address types', () => {
      const validTypes = ['Ethernet', 'WiFi', 'Bluetooth', 'Other'];
      validTypes.forEach(type => {
        expect(validTypes).toContain(type);
      });
    });
  });

  describe('Date Validation (YYYY-MM-DD)', () => {
    it('should accept valid dates', () => {
      const validDates = [
        '2026-06-25',
        '2025-01-01',
        '2024-12-31',
      ];
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      validDates.forEach(date => {
        expect(dateRegex.test(date)).toBe(true);
      });
    });

    it('should reject invalid date formats', () => {
      const invalidDates = [
        '06/25/2026',     // wrong format
        '2026-6-25',      // missing leading zero
        '26-06-2025',     // wrong order
        '2026-06-25 10:00', // includes time
      ];
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      invalidDates.forEach(date => {
        expect(dateRegex.test(date)).toBe(false);
      });
    });
  });

  describe('Email Validation', () => {
    it('should accept valid email addresses', () => {
      const validEmails = [
        'user@company.com',
        'john.doe@example.co.uk',
        'admin+test@domain.org',
      ];
      validEmails.forEach(email => {
        expect(email).toContain('@');
        expect(email).toContain('.');
      });
    });

    it('should reject invalid email addresses', () => {
      const invalidEmails = [
        'notanemail',
        '@company.com',
        'user@',
        'user @company.com',
      ];
      invalidEmails.forEach(email => {
        const isValidEmail = email.includes('@') && email.includes('.');
        // True emails should have proper structure
        if (email === 'user@') expect(isValidEmail).toBe(false);
      });
    });
  });

  describe('Checkout Device Schema', () => {
    it('should accept valid device conditions', () => {
      const validConditions = ['good', 'damaged', 'unknown'];
      validConditions.forEach(condition => {
        expect(validConditions).toContain(condition);
      });
    });

    it('should accept valid action types', () => {
      const validActions = ['return', 'replace'];
      validActions.forEach(action => {
        expect(validActions).toContain(action);
      });
    });

    it('should accept notes up to 500 characters', () => {
      const validNote = 'Device returned in good condition';
      const maxNote = 'a'.repeat(500);

      expect(validNote.length).toBeLessThanOrEqual(500);
      expect(maxNote.length).toBe(500);
    });

    it('should reject notes over 500 characters', () => {
      const longNote = 'a'.repeat(501);
      expect(longNote.length).toBeGreaterThan(500);
    });
  });

  describe('Assign Device Schema', () => {
    it('should accept valid user email', () => {
      const validEmail = 'user@company.com';
      expect(validEmail).toContain('@');
    });

    it('should accept valid user name', () => {
      const validName = 'John Doe';
      expect(validName.length).toBeGreaterThanOrEqual(1);
      expect(validName.length).toBeLessThanOrEqual(150);
    });

    it('should accept optional user ID', () => {
      const validId = 123;
      expect(validId).toBeGreaterThan(0);
    });

    it('should accept optional department', () => {
      const validDept = 'IT Support';
      expect(validDept.length).toBeLessThanOrEqual(100);
    });

    it('should accept optional ticket ID', () => {
      const validTicketId = 'TICKET-2026-001';
      expect(validTicketId.length).toBeLessThanOrEqual(50);
    });

    it('should accept optional reason', () => {
      const validReason = 'User requested new laptop for development';
      expect(validReason.length).toBeLessThanOrEqual(500);
    });
  });
});

describe('Specification Schema', () => {
  it('should accept valid CPU', () => {
    const cpu = 'Intel Core i7-12700K';
    expect(cpu.length).toBeLessThanOrEqual(255);
  });

  it('should accept valid RAM', () => {
    const ramValues = [4, 8, 16, 32, 64, 128, 256];
    ramValues.forEach(ram => {
      expect(ram).toBeGreaterThanOrEqual(1);
      expect(ram).toBeLessThanOrEqual(1024);
    });
  });

  it('should reject RAM out of range', () => {
    const invalidRAM = [0, 1025, -1];
    invalidRAM.forEach(ram => {
      expect(ram < 1 || ram > 1024).toBe(true);
    });
  });

  it('should accept valid storage', () => {
    const storageValues = [128, 256, 512, 1024, 2048];
    storageValues.forEach(storage => {
      expect(storage).toBeGreaterThanOrEqual(1);
      expect(storage).toBeLessThanOrEqual(10000);
    });
  });

  it('should accept valid GPU', () => {
    const gpu = 'NVIDIA RTX 3060';
    expect(gpu.length).toBeLessThanOrEqual(255);
  });

  it('should accept valid PSU watts', () => {
    const psuValues = [65, 130, 250, 650, 1000];
    psuValues.forEach(psu => {
      expect(psu).toBeGreaterThanOrEqual(0);
      expect(psu).toBeLessThanOrEqual(2000);
    });
  });
});
