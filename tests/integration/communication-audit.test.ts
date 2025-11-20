import { describe, expect, it } from 'vitest';

import { cloneDataset, SAMPLE_COMMUNICATION_DATASET } from '../../src/cli/communication-shared';
import { buildAuditReport, renderAuditReport } from '../../src/cli/communication-audit';

describe('communication-audit CLI helpers', () => {
  it('computes delivery metrics and SLA values', async () => {
    const dataset = cloneDataset(SAMPLE_COMMUNICATION_DATASET);
    const report = await buildAuditReport('org-comm-001', dataset, {
      start: '2025-11-18T00:00:00Z',
      end: '2025-11-20T23:59:59Z',
    });

    expect(report.totals.messages).toBeGreaterThan(0);
    expect(report.successRate).toBeGreaterThanOrEqual(0);
    expect(report.sla.timeToSendMs).toBeGreaterThanOrEqual(0);
    expect(report.sla.retryExhaustionRate).toBeGreaterThanOrEqual(0);
  });

  it('renders text output', async () => {
    const dataset = cloneDataset(SAMPLE_COMMUNICATION_DATASET);
    const report = await buildAuditReport('org-comm-001', dataset);
    const output = renderAuditReport(report, 'text');

    expect(output).toContain('Organization: org-comm-001');
    expect(output).toContain('Success rate:');
  });
});
