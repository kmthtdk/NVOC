import { describe, it, expect, beforeEach } from 'vitest';
import { setAuthToken, getAuthToken } from '../../api/client';

describe('Auth Token Management', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
  });

  it('should set and get auth token', () => {
    const token = 'test-token-12345';
    setAuthToken(token);
    expect(getAuthToken()).toBe(token);
  });

  it('should store token in localStorage', () => {
    const token = 'test-token-456';
    setAuthToken(token);
    expect(localStorage.getItem('nvoc_token')).toBe(token);
  });

  it('should clear token when set to null', () => {
    setAuthToken('test-token');
    setAuthToken(null);
    expect(getAuthToken()).toBeNull();
    expect(localStorage.getItem('nvoc_token')).toBeNull();
  });

  it('should handle empty string token', () => {
    setAuthToken('');
    expect(getAuthToken()).toBe('');
  });
});
