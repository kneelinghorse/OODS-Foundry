import { describe, expect, it } from 'vitest';

import { SpamDetector } from '@/traits/classifiable/tag/spam-detector.js';

describe('SpamDetector heuristics', () => {
  it('flags low reputation single-use tags', () => {
    const detector = new SpamDetector({ reputationThreshold: 50 });
    const findings = detector.evaluate(
      { name: 'obscure-tag', usageCount: 0 },
      {
        userId: 'contributor-1',
        userReputation: 10,
        recentCreations: [],
        tagsOnItem: 1,
      }
    );

    expect(findings.some((finding) => finding.rule === 'low_reputation_single_use')).toBe(true);
  });

  it('blocks velocity spikes within window', () => {
    const detector = new SpamDetector({ velocityLimit: 2, velocityWindowMinutes: 60, now: () => new Date('2025-11-18T00:00:00Z') });
    const findings = detector.evaluate(
      { name: 'new-tag', usageCount: 0 },
      {
        userId: 'speedy',
        userReputation: 70,
        tagsOnItem: 1,
        recentCreations: [
          { actorId: 'speedy', createdAt: '2025-11-17T23:30:00Z' },
          { actorId: 'speedy', createdAt: '2025-11-17T23:40:00Z' },
          { actorId: 'speedy', createdAt: '2025-11-17T23:50:00Z' },
        ],
      }
    );

    expect(findings.some((finding) => finding.rule === 'velocity_exceeded')).toBe(true);
  });

  it('warns when tag counts exceed per-item limit', () => {
    const detector = new SpamDetector({ maxTagsPerItem: 5 });
    const findings = detector.evaluate(
      { name: 'ux', usageCount: 10 },
      {
        userId: 'designer',
        userReputation: 90,
        tagsOnItem: 8,
        recentCreations: [],
      }
    );

    const warning = findings.find((finding) => finding.rule === 'tag_limit_exceeded');
    expect(warning).toBeDefined();
    expect(warning?.severity).toBe('warning');
  });
});
