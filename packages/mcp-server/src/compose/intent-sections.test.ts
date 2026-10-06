import { describe, expect, it } from 'vitest';
import { dashboardTemplate } from './templates/dashboard.js';
import {
  buildDashboardSectionPlan,
  buildSlotContextOverridesFromSections,
  parseIntentSections,
  prefersDashboardLayout,
} from './intent-sections.js';

describe('parseIntentSections', () => {
  it('parses paragraph-separated sections', () => {
    const parsed = parseIntentSections([
      'Operations dashboard',
      '',
      'KPI Section:',
      'Active users, revenue, and churn cards.',
      '',
      'Alerts Panel:',
      'Active incidents sorted by severity.',
    ].join('\n'));

    expect(parsed.sections).toHaveLength(2);
    expect(parsed.sections[0].heading).toBe('KPI Section');
    expect(parsed.sections[1].heading).toBe('Alerts Panel');
  });

  it('parses colon-headed inline sections', () => {
    const parsed = parseIntentSections(
      'Operations dashboard. KPI Section: active users and revenue cards; Alerts Panel: incidents by severity; Team Feed: avatar, action, and timestamp.',
    );

    expect(parsed.sections.map((section) => section.heading)).toEqual([
      'KPI Section',
      'Alerts Panel',
      'Team Feed',
    ]);
  });

  it('parses enumerated sentence sections and builds slot context overrides', () => {
    const parsed = parseIntentSections(
      'An operations dashboard for a multi-region SaaS company. The dashboard should include: 1) A KPI section at the top showing active users, revenue, churn rate, and NPS score as large metric cards; 2) A real-time order feed showing the last 50 orders with status badges; 3) A geographic heat map of user activity by region; 4) A system health panel showing service uptime percentages; 5) An alerts panel listing active incidents sorted by severity; 6) A team activity feed with avatar, action, and timestamp; 7) Revenue projections chart.',
    );

    const template = dashboardTemplate();
    const overrides = buildSlotContextOverridesFromSections(template.slots, parsed);

    expect(parsed.sections).toHaveLength(7);
    expect(prefersDashboardLayout(parsed)).toBe(true);
    expect(overrides.get('metrics')?.[0].toLowerCase()).toContain('kpi section');
    expect(overrides.get('main-content')?.join(' ').toLowerCase()).toContain('order feed');
    expect(overrides.get('sidebar')?.join(' ').toLowerCase()).toMatch(/alerts|health/);
  });

  it('builds an expanded dashboard section plan for section-heavy prompts', () => {
    const parsed = parseIntentSections(
      'An operations dashboard for a multi-region SaaS company. The dashboard should include: 1) A KPI section at the top showing active users, revenue, churn rate, and NPS score as large metric cards; 2) A real-time order feed showing the last 50 orders with status badges; 3) A geographic heat map of user activity by region; 4) A system health panel showing service uptime percentages; 5) An alerts panel listing active incidents sorted by severity; 6) A team activity feed with avatar, action, and timestamp; 7) Revenue projections chart.',
    );

    const plan = buildDashboardSectionPlan(parsed);

    expect(plan.expanded).toBe(true);
    expect(plan.metrics.map((slot) => slot.slotName)).toEqual(['metrics']);
    expect(plan.main.map((slot) => slot.slotName)).toEqual([
      'main-content',
      'main-section-1',
      'main-section-2',
      'main-section-3',
    ]);
    expect(plan.sidebar.map((slot) => slot.slotName)).toEqual([
      'sidebar',
      'sidebar-section-1',
    ]);
    expect(plan.main[0]?.intent).toBe('data-table');
    expect(plan.main[1]?.intent).toBe('data-display');
    expect(plan.sidebar[0]?.intent).toBe('metadata-display');
  });

  it('feeds expanded dashboard plans into the template without changing short dashboards', () => {
    const parsed = parseIntentSections(
      'Dashboard layout. KPI Section: revenue and churn; Orders: latest orders table; Heat Map: user activity by region; Alerts: active incidents.',
    );
    const plan = buildDashboardSectionPlan(parsed);
    const expanded = dashboardTemplate({ sectionPlan: plan });
    const compact = dashboardTemplate({
      sectionPlan: buildDashboardSectionPlan(parseIntentSections('dashboard with metrics and sidebar')),
    });

    expect(expanded.slots.map((slot) => slot.name)).toContain('main-section-1');
    expect(expanded.slots.map((slot) => slot.name)).toContain('sidebar');
    expect(compact.slots.map((slot) => slot.name)).toEqual(['header', 'metrics', 'main-content', 'sidebar']);
  });
});
