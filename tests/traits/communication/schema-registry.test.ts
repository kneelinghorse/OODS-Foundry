import { describe, expect, it } from 'vitest';

import {
  listCommunicationSchemas,
  validateCommunicationSchema,
  type CommunicationSchemaId,
} from '@/traits/communication/schema-registry.js';

const baseChannel = {
  id: 'primary-email',
  name: 'Primary Email',
  type: 'email',
  enabled: true,
  config: {
    provider: 'smtp',
    host: 'smtp.example.com',
    port: 587,
    secure: true,
    from: { name: 'Notifications', email: 'notifications@example.com' },
  },
};

describe('communication schema registry', () => {
  it('lists all registered schemas', () => {
    const summaries = listCommunicationSchemas();
    const ids = summaries.map((summary) => summary.id).sort();
    expect(ids).toEqual([
      'channel',
      'conversation',
      'delivery-policy',
      'message',
      'message-status',
      'template',
    ] satisfies CommunicationSchemaId[]);
  });

  it('validates a compliant channel payload', () => {
    const result = validateCommunicationSchema(baseChannel, 'channel');
    expect(result.success).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it('returns validation issues for incomplete payloads', () => {
    const invalid = { ...baseChannel };
    delete (invalid as Record<string, unknown>).config;

    const result = validateCommunicationSchema(invalid, 'channel');
    expect(result.success).toBe(false);
    expect(result.issues[0]?.location.file).toContain('data/communication-schemas/registry.json#channel');
  });
});
