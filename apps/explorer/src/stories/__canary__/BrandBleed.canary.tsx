/**
 * Canary artifact to verify brand-bleed lint catches cross-brand token usage.
 * Do not import this file in production code.
 */

const brandBleedExample = `
.canary-badge {
  background: var(--brandB-surface-canvas);
  color: var(--brandB-text-primary);
}
`;

export function brandBleedCanarySnippet(): string {
  return brandBleedExample;
}

export const brandBleedCanaryMarkup = (
  <section data-brand="A" data-theme="light">
    <style>{brandBleedExample}</style>
    <div className="canary-badge">Brand bleed guardrail canary</div>
  </section>
);
