import { buildAgentPlan } from '../src/agentWorkflow.js';
import { sampleSchema } from '../src/sampleSchema.js';

describe('agentWorkflow', () => {
  it('creates a base schema when none is provided', () => {
    const plan = buildAgentPlan('Create a timeline view', { registryVersion: '2025-11-22' });
    expect(plan.mode).toBe('full');
    expect(plan.request.schema?.screens?.[0]?.component).toBeDefined();
    expect(plan.description).toMatch(/Generated base schema/);
  });

  it('builds a patch plan when a base tree exists', () => {
    const plan = buildAgentPlan('add status badge', {
      baseTree: sampleSchema,
      componentNames: ['AuditTimeline', 'StatusBadge']
    });
    expect(plan.mode).toBe('patch');
    expect(Array.isArray(plan.request.patch)).toBe(true);
    expect(plan.description).toMatch(/updates/);
  });
});
