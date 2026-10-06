import { describe, it, expect } from 'vitest';
import { computeFieldAffinity, scoreFieldAffinity, type FieldHint } from './field-affinity.js';

describe('computeFieldAffinity', () => {
  it('returns boost for boolean fields', () => {
    const result = computeFieldAffinity({ type: 'boolean' });
    expect(result.boost).toBe(0.25);
    expect(result.preferredComponents).toContain('Toggle');
    expect(result.preferredComponents).toContain('Checkbox');
    expect(result.reason).toContain('boolean');
  });

  it('returns boost for date fields', () => {
    const result = computeFieldAffinity({ type: 'date' });
    expect(result.boost).toBe(0.20);
    expect(result.preferredComponents).toContain('DatePicker');
  });

  it('returns boost for datetime fields', () => {
    const result = computeFieldAffinity({ type: 'datetime' });
    expect(result.boost).toBe(0.20);
    expect(result.preferredComponents).toContain('DatePicker');
    expect(result.preferredComponents).toContain('Timeline');
  });

  it('returns boost for email fields', () => {
    const result = computeFieldAffinity({ type: 'email' });
    expect(result.boost).toBe(0.15);
    expect(result.preferredComponents).toContain('Input');
  });

  it('returns boost for url fields', () => {
    const result = computeFieldAffinity({ type: 'url' });
    expect(result.boost).toBe(0.20);
    expect(result.preferredComponents[0]).toBe('Link');
  });

  it('returns boost for array fields', () => {
    const result = computeFieldAffinity({ type: 'array' });
    expect(result.boost).toBe(0.15);
    expect(result.preferredComponents).toContain('TagInput');
    expect(result.preferredComponents).toContain('Stack');
  });

  it('returns enum affinity when enum values are present', () => {
    const result = computeFieldAffinity({ type: 'string', enum: ['active', 'inactive', 'pending'] });
    expect(result.boost).toBe(0.25);
    expect(result.preferredComponents).toContain('Select');
    expect(result.preferredComponents).toContain('StatusBadge');
    expect(result.reason).toContain('enum');
    expect(result.reason).toContain('3 values');
  });

  it('prioritizes semanticType over type', () => {
    const result = computeFieldAffinity({ type: 'number', semanticType: 'currency' });
    expect(result.boost).toBe(0.30);
    expect(result.preferredComponents[0]).toBe('CurrencyDisplay');
    expect(result.reason).toContain('currency');
  });

  it('prioritizes semanticType over enum', () => {
    const result = computeFieldAffinity({ type: 'string', enum: ['a', 'b'], semanticType: 'status' });
    expect(result.boost).toBe(0.30);
    expect(result.preferredComponents).toContain('StatusBadge');
    expect(result.reason).toContain('status');
  });

  it('returns zero boost for unknown types', () => {
    const result = computeFieldAffinity({ type: 'custom-thing' });
    expect(result.boost).toBe(0);
    expect(result.preferredComponents).toEqual([]);
  });

  it('handles percentage semantic type', () => {
    const result = computeFieldAffinity({ type: 'number', semanticType: 'percentage' });
    expect(result.boost).toBe(0.25);
    expect(result.preferredComponents).toContain('ProgressBar');
  });

  it('maps preference toggles to preference-first controls', () => {
    const result = computeFieldAffinity({ type: 'boolean', semanticType: 'preferences.toggle' });
    expect(result.boost).toBe(0.30);
    expect(result.preferredComponents[0]).toBe('PreferenceEditor');
  });

  it('maps priority to Badge/Select', () => {
    const result = computeFieldAffinity({ type: 'string', semanticType: 'priority' });
    expect(result.boost).toBe(0.20);
    expect(result.preferredComponents).toContain('Badge');
    expect(result.preferredComponents).toContain('Select');
  });

  it('maps severity to StatusBadge', () => {
    const result = computeFieldAffinity({ type: 'string', semanticType: 'severity' });
    expect(result.boost).toBe(0.25);
    expect(result.preferredComponents[0]).toBe('StatusBadge');
  });

  it('maps category to Badge', () => {
    const result = computeFieldAffinity({ type: 'string', semanticType: 'category' });
    expect(result.boost).toBe(0.20);
    expect(result.preferredComponents).toContain('Badge');
  });

  it('maps description to Textarea', () => {
    const result = computeFieldAffinity({ type: 'string', semanticType: 'description' });
    expect(result.boost).toBe(0.20);
    expect(result.preferredComponents[0]).toBe('Textarea');
  });

  it('maps score to ProgressBar', () => {
    const result = computeFieldAffinity({ type: 'number', semanticType: 'score' });
    expect(result.boost).toBe(0.25);
    expect(result.preferredComponents[0]).toBe('ProgressBar');
  });

  it('maps duration to Text', () => {
    const result = computeFieldAffinity({ type: 'number', semanticType: 'duration' });
    expect(result.boost).toBe(0.15);
    expect(result.preferredComponents).toContain('Text');
  });

  it('maps address to Text', () => {
    const result = computeFieldAffinity({ type: 'string', semanticType: 'address' });
    expect(result.boost).toBe(0.15);
    expect(result.preferredComponents).toContain('Text');
  });
});

describe('scoreFieldAffinity', () => {
  it('returns full boost for rank-0 component', () => {
    const hint: FieldHint = { type: 'boolean' };
    const result = scoreFieldAffinity('Toggle', hint);
    expect(result.boost).toBe(0.25); // full boost
    expect(result.reason).toContain('field affinity');
    expect(result.reason).toContain('rank 1');
  });

  it('returns diminished boost for rank-1 component', () => {
    const hint: FieldHint = { type: 'boolean' };
    const result = scoreFieldAffinity('Checkbox', hint);
    expect(result.boost).toBeCloseTo(0.18, 1); // 0.25 * 0.7
    expect(result.reason).toContain('rank 2');
  });

  it('returns further diminished boost for rank-2 component', () => {
    const hint: FieldHint = { type: 'boolean' };
    const result = scoreFieldAffinity('Switch', hint);
    expect(result.boost).toBeCloseTo(0.13, 1); // 0.25 * 0.5
    expect(result.reason).toContain('rank 3');
  });

  it('returns zero for non-matching component', () => {
    const hint: FieldHint = { type: 'boolean' };
    const result = scoreFieldAffinity('Table', hint);
    expect(result.boost).toBe(0);
    expect(result.reason).toBe('');
  });

  it('applies currency semantic boost correctly', () => {
    const hint: FieldHint = { type: 'number', semanticType: 'currency' };
    const result = scoreFieldAffinity('CurrencyDisplay', hint);
    expect(result.boost).toBe(0.30);
    expect(result.reason).toContain('currency');
  });

  it('applies enum affinity to Select', () => {
    const hint: FieldHint = { type: 'string', enum: ['a', 'b', 'c'] };
    const result = scoreFieldAffinity('Select', hint);
    expect(result.boost).toBe(0.25);
  });

  it('returns zero when hint has no affinity match', () => {
    const hint: FieldHint = { type: 'custom-unknown' };
    const result = scoreFieldAffinity('Button', hint);
    expect(result.boost).toBe(0);
  });
});
