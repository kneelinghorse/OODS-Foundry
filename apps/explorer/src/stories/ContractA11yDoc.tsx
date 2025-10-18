import type { ReactNode } from 'react';
import reportData from '../../../../tools/a11y/reports/a11y-report.json';
import baselineData from '../../../../tools/a11y/baseline/a11y-baseline.json';

type ContractMetricEntry = {
  ruleId: string;
  checkType?: string;
  target: string;
  summary: string;
  ratio?: number;
  threshold?: number;
  pass: boolean;
  failureSummary?: string;
};

type StoryViolationNode = {
  target?: string;
  failureSummary?: string;
};

type StoryViolation = {
  id: string;
  impact: string | null;
  help: string;
  description?: string;
  helpUrl?: string;
  nodes?: StoryViolationNode[];
};

type StoryContractDetails = {
  storyId: string;
  variant: string | null;
  url?: string;
  tags?: string[];
  failOnImpact?: string[];
  violations: StoryViolation[];
  incomplete: StoryViolation[];
};

type StoryContractEntry = ContractMetricEntry & {
  details?: StoryContractDetails;
};

type ReportSections = {
  contrast?: ContractMetricEntry[];
  guardrails?: ContractMetricEntry[];
  contract?: StoryContractEntry[];
};

type ReportJson = {
  sections?: ReportSections;
  results?: ContractMetricEntry[];
};

type BaselineJson = {
  generatedAt?: string;
  violations?: ContractMetricEntry[];
};

const DOC_TOKENS = {
  borderStrong: 'color-mix(in srgb, var(--cmp-border-default) 45%, transparent)',
  borderSubtle: 'color-mix(in srgb, var(--cmp-border-default) 30%, transparent)',
  surfaceTint: 'color-mix(in srgb, var(--cmp-surface-subtle) 60%, transparent)',
  statusSuccessSurface: 'color-mix(in srgb, var(--sys-status-success-surface) 55%, transparent)',
  statusFailSurface: 'color-mix(in srgb, var(--sys-status-critical-surface) 60%, transparent)',
  statusSuccessText: 'var(--sys-status-success-text)',
  statusFailText: 'var(--sys-status-critical-text)'
} as const;

const HeaderCell = ({ children }: { children: ReactNode }) => (
  <th
    style={{
      textAlign: 'left',
      borderBottom: `1px solid ${DOC_TOKENS.borderStrong}`,
      padding: '0.5rem',
      fontWeight: 600,
      backgroundColor: DOC_TOKENS.surfaceTint
    }}
  >
    {children}
  </th>
);

const BodyCell = ({ children, colSpan }: { children: ReactNode; colSpan?: number }) => (
  <td
    style={{
      padding: '0.6rem 0.5rem',
      borderBottom: `1px solid ${DOC_TOKENS.borderSubtle}`,
      verticalAlign: 'top'
    }}
    colSpan={colSpan}
  >
    {children}
  </td>
);

const StatusCell = ({ pass, message }: { pass: boolean; message?: ReactNode }) => (
  <td
    style={{
      padding: '0.6rem 0.5rem',
      borderBottom: `1px solid ${DOC_TOKENS.borderSubtle}`,
      fontWeight: 600,
      color: pass ? DOC_TOKENS.statusSuccessText : DOC_TOKENS.statusFailText
    }}
  >
    <span>{pass ? 'Pass' : 'Fail'}</span>
    {message ? (
      <div
        style={{
          display: 'block',
          marginTop: '0.35rem',
          fontSize: '0.85rem',
          fontWeight: 400,
          color: pass ? DOC_TOKENS.statusSuccessText : DOC_TOKENS.statusFailText
        }}
      >
        {message}
      </div>
    ) : null}
  </td>
);

const toSortedMetrics = (): ContractMetricEntry[] => {
  const data = reportData as ReportJson;
  const sections = data?.sections ?? {};
  const contrast = Array.isArray(sections.contrast) ? sections.contrast : [];
  const guardrails = Array.isArray(sections.guardrails) ? sections.guardrails : [];

  let rows = [...contrast, ...guardrails];

  if (rows.length === 0 && Array.isArray(data?.results)) {
    rows = data.results.filter((entry) => entry.checkType !== 'contract');
  }

  return rows.sort((a, b) => {
    if (a.ruleId === b.ruleId) {
      return a.target.localeCompare(b.target);
    }
    return a.ruleId.localeCompare(b.ruleId);
  });
};

const toStoryContractRows = (): StoryContractEntry[] => {
  const data = reportData as ReportJson;
  const sections = data?.sections ?? {};
  let rows = Array.isArray(sections.contract) ? sections.contract : [];

  if (rows.length === 0 && Array.isArray(data?.results)) {
    rows = data.results.filter((entry) => entry.checkType === 'contract') as StoryContractEntry[];
  }

  return [...rows].sort((a, b) => a.target.localeCompare(b.target));
};

const getBaseline = (): { generatedAt: string; violations: ContractMetricEntry[] } => {
  const data = baselineData as BaselineJson;
  const generatedAt = data?.generatedAt ?? 'unknown';
  const violations = Array.isArray(data?.violations) ? data.violations : [];
  return { generatedAt, violations };
};

const formatRatio = (value?: number): string => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '—';
  }
  return `${value.toFixed(2)}:1`;
};

const formatThreshold = (value?: number): string => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '—';
  }
  return `${value.toFixed(1)}:1`;
};

const renderStoryMessage = (entry: StoryContractEntry): ReactNode => {
  if (entry.pass) {
    const url = entry.details?.url;
    return url ? (
      <code>{url}</code>
    ) : null;
  }

  const details = entry.details;
  if (!details) {
    return entry.failureSummary ?? 'See CI artifact for details.';
  }

  const violations = details.violations ?? [];
  if (violations.length === 0) {
    return (
      <>
        {entry.failureSummary ?? 'Contract failed.'}
        {details.url ? (
          <div>
            Story URL: <code>{details.url}</code>
          </div>
        ) : null}
      </>
    );
  }

  const rendered = violations.slice(0, 3).map((violation, index) => {
    const nodes =
      Array.isArray(violation.nodes) && violation.nodes.length > 0
        ? violation.nodes
            .map((node) => node?.target ?? '')
            .filter(Boolean)
            .join(', ')
        : '';

    return (
      <li key={`${violation.id}-${index}`}>
        <strong>{violation.id}</strong>
        {violation.impact ? ` (${violation.impact})` : ''}: {violation.help}
        {nodes ? ` → ${nodes}` : ''}
      </li>
    );
  });

  const remaining = violations.length > 3 ? (
    <li key="more">… {violations.length - 3} more</li>
  ) : null;

  return (
    <div>
      {entry.failureSummary ? <div>{entry.failureSummary}</div> : null}
      <ul>{rendered}{remaining}</ul>
      {details.url ? (
        <div>
          Story URL: <code>{details.url}</code>
        </div>
      ) : null}
    </div>
  );
};

export const ContractA11yDoc = () => {
  const metricRows = toSortedMetrics();
  const storyRows = toStoryContractRows();
  const baseline = getBaseline();

  return (
    <>
      <h1>Accessibility Contract Report</h1>
      <p>
        This report captures the WCAG 2.1 AA contrast and guardrail checks enforced on design tokens as well as the
        Storybook accessibility contract that runs axe against curated scenarios in CI.
      </p>

      <h2>Token Contrast &amp; Guardrail Matrix</h2>
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          marginTop: '1rem',
          fontSize: '0.95rem'
        }}
      >
        <thead>
          <tr>
            <HeaderCell>Rule</HeaderCell>
            <HeaderCell>Target</HeaderCell>
            <HeaderCell>Summary</HeaderCell>
            <HeaderCell>Threshold</HeaderCell>
            <HeaderCell>Ratio</HeaderCell>
            <HeaderCell>Status</HeaderCell>
          </tr>
        </thead>
        <tbody>
          {metricRows.map((entry) => (
            <tr key={`${entry.ruleId}-${entry.target}`}>
              <BodyCell>{entry.ruleId}</BodyCell>
              <BodyCell>{entry.target}</BodyCell>
              <BodyCell>{entry.summary}</BodyCell>
              <BodyCell>{formatThreshold(entry.threshold)}</BodyCell>
              <BodyCell>{formatRatio(entry.ratio)}</BodyCell>
              <StatusCell pass={entry.pass} message={entry.failureSummary} />
            </tr>
          ))}
          {metricRows.length === 0 ? (
            <tr>
              <BodyCell colSpan={6}>No contrast or guardrail checks recorded in the current report.</BodyCell>
            </tr>
          ) : null}
        </tbody>
      </table>

      <h2 style={{ marginTop: '2rem' }}>Storybook Accessibility Contract</h2>
      <p style={{ marginTop: '0.5rem' }}>
        The `a11y-contract` workflow builds Storybook, runs <code>pnpm run a11y:diff</code>, and blocks merges on new
        serious/critical axe violations for the curated stories declared in <code>testing/a11y/aria-contract.json</code>.
      </p>

      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          marginTop: '1rem',
          fontSize: '0.95rem'
        }}
      >
        <thead>
          <tr>
            <HeaderCell>Story</HeaderCell>
            <HeaderCell>Expectation</HeaderCell>
            <HeaderCell>Status</HeaderCell>
          </tr>
        </thead>
        <tbody>
          {storyRows.map((entry) => (
            <tr key={entry.ruleId}>
              <BodyCell>{entry.target}</BodyCell>
              <BodyCell>{entry.summary}</BodyCell>
              <StatusCell pass={entry.pass} message={renderStoryMessage(entry)} />
            </tr>
          ))}
          {storyRows.length === 0 ? (
            <tr>
              <BodyCell colSpan={3}>No Storybook contract entries recorded yet.</BodyCell>
            </tr>
          ) : null}
        </tbody>
      </table>

      <section
        style={{
          marginTop: '2rem',
          padding: '1rem',
          borderRadius: '0.75rem',
          border: `1px solid ${DOC_TOKENS.borderStrong}`,
          backgroundColor:
            baseline.violations.length === 0
              ? DOC_TOKENS.statusSuccessSurface
              : DOC_TOKENS.statusFailSurface
        }}
      >
        <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1.1rem' }}>CI Baseline</h3>
        <p style={{ margin: '0 0 0.5rem 0' }}>
          The accessibility gate compares the current report with <code>tools/a11y/baseline/a11y-baseline.json</code> to
          ensure no new violations are introduced.
        </p>
        <p style={{ margin: 0 }}>
          Baseline generated at <strong>{baseline.generatedAt}</strong> —{' '}
          {baseline.violations.length === 0
            ? 'no known violations are baselined.'
            : `${baseline.violations.length} known violation${baseline.violations.length === 1 ? '' : 's'} tracked.`}
        </p>
      </section>
    </>
  );
};
