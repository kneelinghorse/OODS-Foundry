import { describe, expect, it } from 'vitest';
import { handle as composeHandle } from '../../packages/mcp-server/src/tools/design.compose.js';

describe('design.compose long-intent sections', () => {
  it('surfaces parsed section signals for long dashboard intents', async () => {
    const result = await composeHandle({
      intent: 'An operations dashboard for a multi-region SaaS company. The dashboard should include: 1) A KPI section at the top showing active users, revenue, churn rate, and NPS score as large metric cards; 2) A real-time order feed showing the last 50 orders with status badges; 3) A geographic heat map of user activity by region; 4) A system health panel showing service uptime percentages; 5) An alerts panel listing active incidents sorted by severity; 6) A team activity feed with avatar, action, and timestamp; 7) Revenue projections chart. This is used by the VP of Operations to monitor the business at a glance, color-coded by health status with a dark theme.',
      options: { validate: false },
    });

    expect(result.status).toBe('ok');
    expect(result.layout).toBe('dashboard');
    expect(result.meta?.intelligence?.intentSectionsParsed).toBeGreaterThanOrEqual(3);
    expect(result.meta?.intelligence?.sectionContextUsed).toBe(true);
  });

  it('does not introduce section metadata for short prompts', async () => {
    const result = await composeHandle({
      intent: 'dashboard with metrics and sidebar',
      options: { validate: false },
    });

    expect(result.status).toBe('ok');
    expect(result.meta?.intelligence?.intentSectionsParsed).toBeUndefined();
    expect(result.meta?.intelligence?.sectionContextUsed).toBeUndefined();
  });
});
