import { describe, test, expect, vi } from 'vitest';
import { isUrlReachable } from '../utils/misc'; 

vi.mock('dns', () => {
  return {
    promises: {
      lookup: vi.fn((hostname: string) => {
        if (hostname === 'qas.eu1.qasphere.com') {
          return Promise.resolve();
        }
        return Promise.reject(new Error('DNS lookup failed'));
      }),
    },
  };
});

vi.mock('https', () => {
  return {
    request: vi.fn((url: URL, options: object, callback: (res: { statusCode?: number }) => void) => {
      const res = {
        statusCode: url.hostname === 'qas.eu1.qasphere.com' ? 200 : 400,
      };
      const req = {
        on: vi.fn(),
        end: vi.fn(),
        destroy: vi.fn(),
      };
      callback(res);
      return req;
    }),
  };
});

vi.mock('http', () => {
  return {
    request: vi.fn((url: URL, options: object, callback: (res: { statusCode?: number }) => void) => {
      const res = {
        statusCode: url.hostname === 'qas.eu1.qasphere.com' ? 200 : 400,
      };
      const req = {
        on: vi.fn(),
        end: vi.fn(),
        destroy: vi.fn(),
      };
      callback(res);
      return req;
    }),
  };
});

describe('isUrlReachable', () => {
  test('should return true for reachable URL', async () => {
    const result = await isUrlReachable('https://qas.eu1.qasphere.com');
    expect(result).toBe(true);
  });

  test('should return false for unreachable URL', async () => {
    const result = await isUrlReachable('https://qas_invalid.eu1.qasphere.com');
    expect(result).toBe(false);
  });

  test('should throw an error for invalid URL', async () => {
    await expect(isUrlReachable('invalid-url')).rejects.toThrow('Invalid URL: invalid-url');
  });
});
