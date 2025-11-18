import * as React from 'react';
import type { Tag } from '@/schemas/classification/tag.js';
import type { SpamFinding } from '@/traits/classifiable/tag/spam-detector.js';

import './tag-governance-dashboard.css';

export interface SynonymRequest {
  readonly id: string;
  readonly canonicalTagId: string;
  readonly synonym: string;
  readonly submittedBy: string;
  readonly submittedAt: string;
}

export interface MergeSuggestion {
  readonly sourceTagId: string;
  readonly targetTagId: string;
  readonly reason: string;
}

export interface TagGovernanceDashboardProps {
  readonly tags: readonly Tag[];
  readonly className?: string;
  readonly spamFindings?: readonly SpamFinding[];
  readonly pendingSynonyms?: readonly SynonymRequest[];
  readonly mergeSuggestions?: readonly MergeSuggestion[];
  readonly onApproveSynonym?: (request: SynonymRequest) => void;
  readonly onRejectSynonym?: (request: SynonymRequest) => void;
  readonly onMergeSuggestion?: (suggestion: MergeSuggestion) => void;
  readonly onResolveSpam?: (finding: SpamFinding, resolution: 'approve' | 'reject') => void;
}

export function TagGovernanceDashboard({
  tags,
  className,
  spamFindings = [],
  pendingSynonyms = [],
  mergeSuggestions = [],
  onApproveSynonym,
  onRejectSynonym,
  onMergeSuggestion,
  onResolveSpam,
}: TagGovernanceDashboardProps): React.ReactElement {
  const canonicalCount = React.useMemo(() => tags.filter((tag) => tag.isCanonical !== false).length, [tags]);
  const totalSynonyms = React.useMemo(() => tags.reduce((sum, tag) => sum + tag.synonyms.length, 0), [tags]);
  const flaggedCount = spamFindings.length;
  const topTags = React.useMemo(
    () =>
      [...tags]
        .sort((a, b) => (b.usageCount ?? 0) - (a.usageCount ?? 0))
        .slice(0, 5),
    [tags]
  );

  return (
    <section className={['tag-governance-dashboard', className].filter(Boolean).join(' ')} aria-label="Tag governance">
      <header className="tag-governance-dashboard__header">
        <div>
          <p className="tag-governance-dashboard__eyebrow">Folksonomy health</p>
          <h2>Canonical tags & governance</h2>
        </div>
        <p className="tag-governance-dashboard__subtitle">
          Synonym mapping, tag merges, and spam review keep the folksonomy predictable as communities grow.
        </p>
      </header>

      <div className="tag-governance-dashboard__summary" role="list">
        <SummaryCard label="Canonical tags" value={canonicalCount.toLocaleString()} trend="+12 this week" />
        <SummaryCard label="Synonyms tracked" value={totalSynonyms.toLocaleString()} trend="Stack Overflow pattern" />
        <SummaryCard label="Tags flagged" value={flaggedCount.toLocaleString()} trend="Awaiting moderation" />
      </div>

      <div className="tag-governance-dashboard__panel">
        <div className="tag-governance-dashboard__panel-header">
          <h3>High usage tags</h3>
          <p>Monitor root tags that everything maps to.</p>
        </div>
        <div className="tag-governance-dashboard__table" role="table" aria-label="Top tags by usage">
          <div className="tag-governance-dashboard__table-row tag-governance-dashboard__table-row--head" role="row">
            <span role="columnheader">Tag</span>
            <span role="columnheader">Usage</span>
            <span role="columnheader">Synonyms</span>
          </div>
          {topTags.map((tag) => (
            <div key={tag.id} className="tag-governance-dashboard__table-row" role="row">
              <span role="cell">
                <strong>{tag.name}</strong>
                <span className="tag-governance-dashboard__slug">/{tag.slug}</span>
              </span>
              <span role="cell">{(tag.usageCount ?? 0).toLocaleString()}</span>
              <span role="cell">{tag.synonyms.length}</span>
            </div>
          ))}
        </div>
      </div>

      {pendingSynonyms.length > 0 ? (
        <div className="tag-governance-dashboard__panel">
          <div className="tag-governance-dashboard__panel-header">
            <h3>Synonym requests</h3>
            <p>Approve alternates to collapse redundant tags.</p>
          </div>
          <ul className="tag-governance-dashboard__list">
            {pendingSynonyms.map((request) => (
              <li key={request.id} className="tag-governance-dashboard__list-item">
                <div>
                  <p className="tag-governance-dashboard__list-title">{request.synonym}</p>
                  <p className="tag-governance-dashboard__list-meta">
                    → canonical #{request.canonicalTagId} · submitted by {request.submittedBy}
                  </p>
                </div>
                <div className="tag-governance-dashboard__actions">
                  <button type="button" onClick={() => onApproveSynonym?.(request)}>
                    Approve
                  </button>
                  <button type="button" onClick={() => onRejectSynonym?.(request)} aria-label="Reject synonym request">
                    Reject
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {mergeSuggestions.length > 0 ? (
        <div className="tag-governance-dashboard__panel">
          <div className="tag-governance-dashboard__panel-header">
            <h3>Merge candidates</h3>
            <p>Transactional merges update term relationships via ON CONFLICT safeguards.</p>
          </div>
          <ul className="tag-governance-dashboard__list">
            {mergeSuggestions.map((suggestion, index) => (
              <li key={`${suggestion.sourceTagId}-${suggestion.targetTagId}-${index}`} className="tag-governance-dashboard__list-item">
                <div>
                  <p className="tag-governance-dashboard__list-title">
                    {suggestion.sourceTagId} → {suggestion.targetTagId}
                  </p>
                  <p className="tag-governance-dashboard__list-meta">{suggestion.reason}</p>
                </div>
                <div className="tag-governance-dashboard__actions">
                  <button type="button" onClick={() => onMergeSuggestion?.(suggestion)}>
                    Merge
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {spamFindings.length > 0 ? (
        <div className="tag-governance-dashboard__panel">
          <div className="tag-governance-dashboard__panel-header">
            <h3>Spam queue</h3>
            <p>Heuristics flag tags for review before they pollute the folksonomy.</p>
          </div>
          <ul className="tag-governance-dashboard__list">
            {spamFindings.map((finding, index) => (
              <li key={`${finding.rule}-${index}`} className="tag-governance-dashboard__list-item">
                <div>
                  <p className="tag-governance-dashboard__list-title">{finding.message}</p>
                  <p className="tag-governance-dashboard__list-meta">
                    Rule: {finding.rule} · Severity: {finding.severity}
                  </p>
                </div>
                <div className="tag-governance-dashboard__actions">
                  <button type="button" onClick={() => onResolveSpam?.(finding, 'approve')}>
                    Approve
                  </button>
                  <button type="button" onClick={() => onResolveSpam?.(finding, 'reject')}>
                    Reject
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

interface SummaryCardProps {
  readonly label: string;
  readonly value: string;
  readonly trend: string;
}

function SummaryCard({ label, value, trend }: SummaryCardProps): React.ReactElement {
  return (
    <article className="tag-governance-dashboard__summary-card" role="listitem">
      <p className="tag-governance-dashboard__summary-label">{label}</p>
      <p className="tag-governance-dashboard__summary-value">{value}</p>
      <p className="tag-governance-dashboard__summary-trend">{trend}</p>
    </article>
  );
}
