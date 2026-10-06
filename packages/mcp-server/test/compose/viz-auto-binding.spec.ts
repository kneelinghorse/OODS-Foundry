/**
 * Viz object auto-binding tests (s74-m06).
 *
 * Verifies that internal trait inference binds schema fields
 * to chart data encodings based on field types and semantics.
 */
import { describe, it, expect } from 'vitest';
import { inferDataBindings } from '../../src/compose/viz-trait-resolver.js';
import type { FieldDefinition } from '../../src/objects/types.js';

/* ------------------------------------------------------------------ */
/*  inferDataBindings unit tests                                       */
/* ------------------------------------------------------------------ */

describe('inferDataBindings', () => {
  it('maps temporal field to x, numeric to y, enum to color', () => {
    const fields: Record<string, FieldDefinition> = {
      occurred_at: { type: 'datetime', required: true, description: 'When' },
      amount: { type: 'number', required: true, description: 'Amount' },
      status: {
        type: 'string',
        required: true,
        description: 'Status',
        validation: { enum: ['pending', 'settled', 'failed'] },
      },
    };
    const result = inferDataBindings(fields);
    expect(result.dataBindings.x).toBe('occurred_at');
    expect(result.dataBindings.y).toBe('amount');
    expect(result.dataBindings.color).toBe('status');
    expect(result.fieldsMapped).toContain('occurred_at');
    expect(result.fieldsMapped).toContain('amount');
    expect(result.fieldsMapped).toContain('status');
    expect(result.encodings.length).toBeGreaterThanOrEqual(3);
  });

  it('respects existing user bindings', () => {
    const fields: Record<string, FieldDefinition> = {
      occurred_at: { type: 'datetime', required: true, description: 'When' },
      amount: { type: 'number', required: true, description: 'Amount' },
    };
    const result = inferDataBindings(fields, undefined, { x: 'custom_x' });
    expect(result.dataBindings.x).toBe('custom_x');
    expect(result.dataBindings.y).toBe('amount');
  });

  it('binds second numeric field to size', () => {
    const fields: Record<string, FieldDefinition> = {
      date: { type: 'datetime', required: true, description: 'Date' },
      revenue: { type: 'number', required: true, description: 'Revenue' },
      count: { type: 'number', required: true, description: 'Count' },
    };
    const result = inferDataBindings(fields);
    expect(result.dataBindings.y).toBe('revenue');
    expect(result.dataBindings.size).toBe('count');
  });

  it('uses semantic type hints for classification', () => {
    const fields: Record<string, FieldDefinition> = {
      price: { type: 'number', required: true, description: 'Price' },
      name: { type: 'string', required: true, description: 'Name' },
    };
    const semantics = {
      price: { semantic_type: 'currency' },
      name: { semantic_type: 'identifier' },
    };
    const result = inferDataBindings(fields, semantics);
    expect(result.dataBindings.y).toBe('price');
  });

  it('returns empty when no fields match', () => {
    const fields: Record<string, FieldDefinition> = {
      id: { type: 'uuid', required: true, description: 'ID' },
      name: { type: 'string', required: true, description: 'Name' },
    };
    const result = inferDataBindings(fields);
    expect(result.fieldsMapped).toHaveLength(0);
    expect(result.dataBindings.x).toBeUndefined();
    expect(result.dataBindings.y).toBeUndefined();
  });
});

