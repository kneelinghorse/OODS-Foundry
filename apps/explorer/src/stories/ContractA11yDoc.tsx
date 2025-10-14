import type { ReactNode } from 'react';
import reportData from '../../../../tools/a11y/reports/a11y-report.json';
import baselineData from '../../../../tools/a11y/baseline/a11y-baseline.json';

type ReportEntry = {
  ruleId: string;
  target: string;
  summary: string;
  ratio: number;
  threshold: number;
  pass: boolean;
  failureSummary: string;
};

type ReportJson = {
  results?: ReportEntry[];
};

type BaselineJson = {
  generatedAt?: string;
  violations?: ReportEntry[];
};

const HeaderCell = ({ children }: { children: ReactNode }) => (
  <th
    style={{
      textAlign: 'left',
      borderBottom: '1px solid rgba(148, 163, 184, 0.4)',
      padding: '0.5rem',
      fontWeight: 600,
      backgroundColor: 'rgba(241, 245, 249, 0.5)'
    }}
  >
    {children}
  </th>
);

const BodyCell = ({ children }: { children: ReactNode }) => (
  <td
    style={{
      padding: '0.6rem 0.5rem',
      borderBottom: '1px solid rgba(226, 232, 240, 0.5)',
      verticalAlign: 'top'
    }}
  >
    {children}
  </td>
);

const StatusCell = ({ pass, message }: { pass: boolean; message?: string }) => (
  <td
    style={{
      padding: '0.6rem 0.5rem',
      borderBottom: '1px solid rgba(226, 232, 240, 0.5)',
      fontWeight: 600,
      color: pass ? '#047857' : '#b91c1c'
    }}
  >
    {pass ? (
      'Pass'
    ) : (
      <span>
        Fail
        {message ? (
          <span
            style={{
              display: 'block',
              fontSize: '0.85rem',
              fontWeight: 400,
              color: '#b91c1c',
              marginTop: '0.25rem'
            }}
          >
            {message}
          </span>
        ) : null}
      </span>
    )}
  </td>
);

const getReportRows = (): ReportEntry[] => {
  const data = reportData as ReportJson;
  if (!data || !Array.isArray(data.results)) {
    return [];
  }
  return [...data.results].sort((a, b) => {
    if (a.ruleId === b.ruleId) {
      return a.target.localeCompare(b.target);
    }
    return a.ruleId.localeCompare(b.ruleId);
  });
};

const getBaseline = (): { generatedAt: string; violations: ReportEntry[] } => {
  const data = baselineData as BaselineJson;
  const generatedAt = data?.generatedAt ?? 'unknown';
  const violations = Array.isArray(data?.violations) ? data.violations : [];
  return { generatedAt, violations };
};

export const ContractA11yDoc = () => {
  const rows = getReportRows();
  const baseline = getBaseline();

  return (
    <>
      <h1>Accessibility Contrast Contract</h1>
      <p>
        This contract documents the WCAG 2.2 AA contrast checks enforced by the automated tooling.
      </p>

      <h2>Verification Matrix</h2>
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
          {rows.map((entry) => (
            <tr key={`${entry.ruleId}-${entry.target}`}>
              <BodyCell>{entry.ruleId}</BodyCell>
              <BodyCell>{entry.target}</BodyCell>
              <BodyCell>{entry.summary}</BodyCell>
              <BodyCell>{`${entry.threshold.toFixed(1)}:1`}</BodyCell>
              <BodyCell>{`${entry.ratio.toFixed(2)}:1`}</BodyCell>
              <StatusCell pass={entry.pass} message={entry.failureSummary} />
            </tr>
          ))}
        </tbody>
      </table>

      <section
        style={{
          marginTop: '2rem',
          padding: '1rem',
          borderRadius: '0.75rem',
          border: '1px solid rgba(148, 163, 184, 0.4)',
          backgroundColor: baseline.violations.length === 0 ? 'rgba(220, 252, 231, 0.6)' : 'rgba(254, 226, 226, 0.6)'
        }}
      >
        <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1.1rem' }}>CI Baseline</h3>
        <p style={{ margin: '0 0 0.5rem 0' }}>
          The CI gate compares the current report with <code>tools/a11y/baseline/a11y-baseline.json</code> to ensure no
          new violations are introduced.
        </p>
        <p style={{ margin: 0 }}>
          Baseline generated at <strong>{baseline.generatedAt}</strong> —{' '}
          {baseline.violations.length === 0
            ? 'no known contrast violations are baselined.'
            : `${baseline.violations.length} known violation${baseline.violations.length === 1 ? '' : 's'} tracked.`}
        </p>
      </section>
    </>
  );
};
