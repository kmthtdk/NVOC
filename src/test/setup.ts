import '@testing-library/jest-dom';
import { afterEach, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Reset and cleanup after each test
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// localStorage mock with proper isolation between tests
let localStorageStore: Record<string, string> = {};

const localStorageMock = {
  getItem: (key: string) => localStorageStore[key] ?? null,
  setItem: (key: string, value: string) => {
    localStorageStore[key] = String(value);
  },
  removeItem: (key: string) => {
    delete localStorageStore[key];
  },
  clear: () => {
    localStorageStore = {};
  },
  key: (index: number) => {
    const keys = Object.keys(localStorageStore);
    return keys[index] ?? null;
  },
  get length() {
    return Object.keys(localStorageStore).length;
  },
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
  configurable: true,
});

// Global fetch mock (can be overridden per-test)
global.fetch = vi.fn() as any;
