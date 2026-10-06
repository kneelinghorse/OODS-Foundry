import type { UiSchema } from '../../../packages/mcp-server/src/schemas/generated.js';

export const sampleSchema: UiSchema = {
  version: '2025.11',
  dsVersion: '2025-11-22',
  theme: 'default',
  screens: [
    {
      id: 'audit-screen',
      component: 'AuditTimeline',
      layout: { type: 'stack', gapToken: 'spacing.md' },
      meta: { label: 'Audit timeline' },
      children: [
        {
          id: 'archive-summary',
          component: 'ArchiveSummary',
          meta: { label: 'Archive summary' }
        }
      ]
    }
  ]
};
