import { describe, it, expect, vi } from 'vitest';
import { OodsClient } from './client.js';
import type { Transport } from './transport.js';

function mockTransport(): Transport {
  return {
    call: vi.fn().mockResolvedValue({}),
  };
}

function clientWith(transport: Transport): OodsClient {
  return new OodsClient({ transport: { type: 'stdio' } });
}

// Replace the transport on the client via the low-level call override
function createMockClient(): { client: OodsClient; mockCall: ReturnType<typeof vi.fn> } {
  const client = new OodsClient({ transport: { type: 'stdio' } });
  const mockCall = vi.fn().mockResolvedValue({});
  // Override the call method to use our mock
  client.call = mockCall as typeof client.call;
  return { client, mockCall };
}

describe('OodsClient', () => {
  describe('constructor', () => {
    it('instantiates with default config', () => {
      const client = new OodsClient();
      expect(client).toBeInstanceOf(OodsClient);
    });

    it('instantiates with stdio transport', () => {
      const client = new OodsClient({ transport: { type: 'stdio' } });
      expect(client).toBeInstanceOf(OodsClient);
    });

    it('instantiates with http transport', () => {
      const client = new OodsClient({
        transport: { type: 'http', baseUrl: 'http://localhost:3000' },
      });
      expect(client).toBeInstanceOf(OodsClient);
    });
  });

  describe('namespaces', () => {
    it('exposes schema namespace', () => {
      const client = new OodsClient();
      expect(client.schema).toBeDefined();
      expect(typeof client.schema.save).toBe('function');
      expect(typeof client.schema.load).toBe('function');
      expect(typeof client.schema.list).toBe('function');
      expect(typeof client.schema.delete).toBe('function');
    });

    it('exposes objects namespace', () => {
      const client = new OodsClient();
      expect(client.objects).toBeDefined();
      expect(typeof client.objects.list).toBe('function');
      expect(typeof client.objects.show).toBe('function');
    });

    it('exposes maps namespace', () => {
      const client = new OodsClient();
      expect(client.maps).toBeDefined();
      expect(typeof client.maps.create).toBe('function');
      expect(typeof client.maps.list).toBe('function');
      expect(typeof client.maps.resolve).toBe('function');
      expect(typeof client.maps.update).toBe('function');
      expect(typeof client.maps.delete).toBe('function');
    });
  });

  describe('workflow methods', () => {
    it('compose delegates to design.compose tool', async () => {
      const { client, mockCall } = createMockClient();
      mockCall.mockResolvedValue({ status: 'ok', layout: 'detail' });

      const result = await client.compose({ intent: 'user detail page' });

      expect(mockCall).toHaveBeenCalledWith('design.compose', { intent: 'user detail page' });
      expect(result.status).toBe('ok');
    });


    it('pipeline delegates to pipeline tool', async () => {
      const { client, mockCall } = createMockClient();
      mockCall.mockResolvedValue({ compose: { layout: 'detail' }, pipeline: { steps: [] } });

      const result = await client.pipeline({ object: 'User' });

      expect(mockCall).toHaveBeenCalledWith('pipeline', { object: 'User' });
      expect(result.compose).toBeDefined();
    });

    it('codegen delegates to code.generate tool', async () => {
      const { client, mockCall } = createMockClient();
      mockCall.mockResolvedValue({ status: 'ok', framework: 'react', code: '' });

      const result = await client.codegen({ framework: 'react', schemaRef: 'ref:123' });

      expect(mockCall).toHaveBeenCalledWith('code.generate', {
        framework: 'react',
        schemaRef: 'ref:123',
      });
      expect(result.framework).toBe('react');
    });

    it('health delegates to health tool', async () => {
      const { client, mockCall } = createMockClient();
      mockCall.mockResolvedValue({ status: 'ok' });

      const result = await client.health();

      expect(mockCall).toHaveBeenCalledWith('health', {});
      expect(result.status).toBe('ok');
    });

    it('catalogList delegates to catalog.list tool', async () => {
      const { client, mockCall } = createMockClient();
      mockCall.mockResolvedValue({ components: [], totalCount: 0 });

      await client.catalogList({ category: 'core' });

      expect(mockCall).toHaveBeenCalledWith('catalog.list', { category: 'core' });
    });
  });

  describe('schema namespace methods', () => {
    it('schema.save delegates correctly', async () => {
      const { client, mockCall } = createMockClient();
      mockCall.mockResolvedValue({ name: 'test', version: 1 });

      await client.schema.save({ name: 'test', schemaRef: 'ref:1' });

      expect(mockCall).toHaveBeenCalledWith('schema', { action: 'save', name: 'test', schemaRef: 'ref:1' });
    });

    it('schema.load delegates correctly', async () => {
      const { client, mockCall } = createMockClient();
      mockCall.mockResolvedValue({ schemaRef: 'ref:1', name: 'test' });

      await client.schema.load({ name: 'test' });

      expect(mockCall).toHaveBeenCalledWith('schema', { action: 'load', name: 'test' });
    });

    it('schema.list delegates correctly', async () => {
      const { client, mockCall } = createMockClient();
      mockCall.mockResolvedValue([]);

      await client.schema.list({ tags: ['v1'] });

      expect(mockCall).toHaveBeenCalledWith('schema', { action: 'list', tags: ['v1'] });
    });

    it('schema.delete delegates correctly', async () => {
      const { client, mockCall } = createMockClient();
      mockCall.mockResolvedValue({ status: 'ok' });

      await client.schema.delete({ name: 'test' });

      expect(mockCall).toHaveBeenCalledWith('schema', { action: 'delete', name: 'test' });
    });
  });

  describe('objects namespace methods', () => {
    it('objects.list delegates correctly', async () => {
      const { client, mockCall } = createMockClient();
      mockCall.mockResolvedValue({ objects: [], totalCount: 0 });

      await client.objects.list({ domain: 'core.identity' });

      expect(mockCall).toHaveBeenCalledWith('object', { action: 'list', domain: 'core.identity' });
    });

    it('objects.show delegates correctly', async () => {
      const { client, mockCall } = createMockClient();
      mockCall.mockResolvedValue({ name: 'User' });

      await client.objects.show({ name: 'User' });

      expect(mockCall).toHaveBeenCalledWith('object', { action: 'show', name: 'User' });
    });
  });

  describe('maps namespace methods', () => {
    it('maps.create delegates correctly', async () => {
      const { client, mockCall } = createMockClient();
      mockCall.mockResolvedValue({ status: 'ok' });

      await client.maps.create({
        externalSystem: 'mui',
        externalComponent: 'Button',
        oodsTraits: ['Clickable'],
      });

      expect(mockCall).toHaveBeenCalledWith('map', {
        action: 'create',
        externalSystem: 'mui',
        externalComponent: 'Button',
        oodsTraits: ['Clickable'],
      });
    });
  });
});
