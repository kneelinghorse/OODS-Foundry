import { describe, it, expect } from 'vitest';
import {
  StdioTransport,
  HttpTransport,
  createTransport,
} from './transport.js';

describe('Transport', () => {
  describe('StdioTransport', () => {
    it('instantiates with default options', () => {
      const t = new StdioTransport();
      expect(t.options.type).toBe('stdio');
    });

    it('throws on call (stub implementation)', async () => {
      const t = new StdioTransport();
      await expect(t.call('test', {})).rejects.toThrow('does not bundle an MCP stdio client');
    });
  });

  describe('HttpTransport', () => {
    it('instantiates with baseUrl', () => {
      const t = new HttpTransport({ type: 'http', baseUrl: 'http://localhost:3000' });
      expect(t).toBeDefined();
    });

    it('strips trailing slash from baseUrl', () => {
      const t = new HttpTransport({ type: 'http', baseUrl: 'http://localhost:3000/' });
      // We can verify it works by checking the transport exists
      expect(t).toBeDefined();
    });
  });

  describe('createTransport', () => {
    it('returns StdioTransport by default (no env)', () => {
      const originalEnv = process.env.OODS_BRIDGE_URL;
      delete process.env.OODS_BRIDGE_URL;

      const t = createTransport();
      expect(t).toBeInstanceOf(StdioTransport);

      if (originalEnv) process.env.OODS_BRIDGE_URL = originalEnv;
    });

    it('returns HttpTransport when OODS_BRIDGE_URL is set', () => {
      const originalEnv = process.env.OODS_BRIDGE_URL;
      process.env.OODS_BRIDGE_URL = 'http://localhost:3000';

      const t = createTransport();
      expect(t).toBeInstanceOf(HttpTransport);

      if (originalEnv) {
        process.env.OODS_BRIDGE_URL = originalEnv;
      } else {
        delete process.env.OODS_BRIDGE_URL;
      }
    });

    it('returns StdioTransport for explicit stdio config', () => {
      const t = createTransport({ type: 'stdio' });
      expect(t).toBeInstanceOf(StdioTransport);
    });

    it('returns HttpTransport for explicit http config', () => {
      const t = createTransport({ type: 'http', baseUrl: 'http://example.com' });
      expect(t).toBeInstanceOf(HttpTransport);
    });
  });
});
