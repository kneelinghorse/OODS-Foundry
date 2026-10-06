import { describe, it, expect, beforeEach } from 'vitest';
import {
  fieldPairPattern,
  metricCardPattern,
  fieldGroupPattern,
  selectPattern,
} from './slot-patterns.js';
import { resetIdCounter } from './templates/types.js';
import type { FieldDefinition } from '../objects/types.js';

const stringField: FieldDefinition = { type: 'string', required: true, description: 'A string' };
const boolField: FieldDefinition = { type: 'boolean', required: false, description: 'A boolean' };
const numberField: FieldDefinition = { type: 'number', required: true, description: 'A number' };
const dateField: FieldDefinition = { type: 'date', required: false, description: 'A date' };
const enumField: FieldDefinition = {
  type: 'string', required: true, description: 'An enum',
  validation: { enum: ['active', 'inactive', 'pending'] },
};
const arrayField: FieldDefinition = { type: 'array', required: false, description: 'An array' };

describe('fieldPairPattern', () => {
  beforeEach(() => resetIdCounter());

  it('creates Label + Input for a string field', () => {
    const result = fieldPairPattern('userName', stringField);
    expect(result.pattern).toBe('field-pair');
    expect(result.fieldsUsed).toEqual(['userName']);
    expect(result.element.component).toBe('Stack');
    expect(result.element.children).toHaveLength(2);
    expect(result.element.children![0].component).toBe('Text');
    expect(result.element.children![1].component).toBe('Input');
    expect(result.element.children![1].props?.field).toBe('userName');
  });

  it('uses Toggle for boolean fields', () => {
    const result = fieldPairPattern('isActive', boolField);
    expect(result.element.children![1].component).toBe('Toggle');
  });

  it('uses Select for enum fields', () => {
    const result = fieldPairPattern('status', enumField);
    expect(result.element.children![1].component).toBe('Select');
  });

  it('uses DatePicker for date fields', () => {
    const result = fieldPairPattern('createdAt', dateField);
    expect(result.element.children![1].component).toBe('DatePicker');
  });

  it('uses TagInput for array fields', () => {
    const result = fieldPairPattern('tags', arrayField);
    expect(result.element.children![1].component).toBe('TagInput');
  });

  it('humanizes field names with camelCase', () => {
    const result = fieldPairPattern('firstName', stringField);
    expect(result.element.children![0].meta?.label).toBe('First Name label');
  });

  it('humanizes field names with snake_case', () => {
    const result = fieldPairPattern('first_name', stringField);
    expect(result.element.children![0].meta?.label).toBe('First Name label');
  });
});

describe('metricCardPattern', () => {
  beforeEach(() => resetIdCounter());

  it('creates Card with Label + Value for number field', () => {
    const result = metricCardPattern('revenue', numberField);
    expect(result.pattern).toBe('metric-card');
    expect(result.fieldsUsed).toEqual(['revenue']);
    expect(result.element.component).toBe('Card');
    // Label + Value + Badge (trend)
    expect(result.element.children).toHaveLength(3);
    expect(result.element.children![0].component).toBe('Text'); // label
    expect(result.element.children![1].component).toBe('Text'); // value
    expect(result.element.children![2].component).toBe('Badge'); // trend
  });

  it('uses StatusBadge for status semantic type', () => {
    const result = metricCardPattern('health', stringField, 'status');
    // No trend badge for non-numeric
    expect(result.element.children).toHaveLength(2);
    expect(result.element.children![1].component).toBe('StatusBadge');
  });

  it('skips trend badge for non-numeric fields', () => {
    const result = metricCardPattern('name', stringField);
    expect(result.element.children).toHaveLength(2);
  });
});

describe('fieldGroupPattern', () => {
  beforeEach(() => resetIdCounter());

  it('creates Heading + field pairs', () => {
    const fields: Array<[string, FieldDefinition]> = [
      ['email', stringField],
      ['isActive', boolField],
    ];
    const result = fieldGroupPattern('Account Info', fields);
    expect(result.pattern).toBe('field-group');
    expect(result.fieldsUsed).toEqual(['email', 'isActive']);
    expect(result.element.component).toBe('Stack');
    // Heading + 2 field-pairs
    expect(result.element.children).toHaveLength(3);
    expect(result.element.children![0].component).toBe('Text');
    expect(result.element.children![0].meta?.label).toBe('Account Info');
  });
});

describe('selectPattern', () => {
  beforeEach(() => resetIdCounter());

  it('returns field-pair for form context', () => {
    const result = selectPattern('name', stringField, 'form');
    expect(result).toBeDefined();
    expect(result!.pattern).toBe('field-pair');
  });

  it('returns metric-card for dashboard KPI field', () => {
    const result = selectPattern('revenue', numberField, 'dashboard', 'currency');
    expect(result).toBeDefined();
    expect(result!.pattern).toBe('metric-card');
  });

  it('returns undefined for dashboard non-KPI field', () => {
    const result = selectPattern('name', stringField, 'dashboard');
    expect(result).toBeUndefined();
  });

  it('returns undefined for detail context', () => {
    const result = selectPattern('name', stringField, 'detail');
    expect(result).toBeUndefined();
  });

  it('returns undefined for list context', () => {
    const result = selectPattern('name', stringField, 'list');
    expect(result).toBeUndefined();
  });

  it('detects KPI via semantic type', () => {
    const result = selectPattern('margin', stringField, 'dashboard', 'percentage');
    expect(result).toBeDefined();
    expect(result!.pattern).toBe('metric-card');
  });

  it('detects KPI via numeric type', () => {
    const result = selectPattern('count', numberField, 'dashboard');
    expect(result).toBeDefined();
    expect(result!.pattern).toBe('metric-card');
  });
});
