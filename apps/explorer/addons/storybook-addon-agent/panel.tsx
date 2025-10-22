import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from 'react';
import { styled } from 'storybook/theming';
import genericInputSchema from '../../../../packages/mcp-server/src/schemas/generic.input.json' assert { type: 'json' };
import brandApplyInputSchema from '../../../../packages/mcp-server/src/schemas/brand.apply.input.json' assert { type: 'json' };
import billingReviewKitInputSchema from '../../../../packages/mcp-server/src/schemas/billing.reviewKit.input.json' assert { type: 'json' };
import billingSwitchFixturesInputSchema from '../../../../packages/mcp-server/src/schemas/billing.switchFixtures.input.json' assert { type: 'json' };
import { artifactHref, bridgeOrigin, fetchToolNames, runTool } from './bridge.js';
import { ApproveDialog } from './components/ApproveDialog.js';
import { ArtifactList } from './components/ArtifactList.js';
import { ArtifactViewer } from './components/ArtifactViewer.js';
import { DiffViewer } from './components/DiffViewer.js';
import type { JsonSchema, ToolDescriptor, ToolName, ToolRunSuccess } from './types.js';
import { BridgeError } from './types.js';
import errorCatalog from './i18n/errors.json' assert { type: 'json' };
import './styles/panel.css';

type PanelPhase = 'idle' | 'planning' | 'review' | 'awaiting-approval' | 'executing' | 'summary' | 'error';

type ErrorState = {
  phase: 'planning' | 'executing';
  message: string;
  code?: string | null;
  status?: number | null;
  incidentId?: string | null;
  details?: unknown;
};

type ErrorSeverity = 'error' | 'warning';

type ErrorCopyEntry = {
  title: string;
  description: string;
  guidance: string;
  severity?: ErrorSeverity;
};

type ErrorCatalog = {
  codes: Record<string, ErrorCopyEntry>;
  http: Record<string, ErrorCopyEntry>;
  fallback: ErrorCopyEntry;
};

type ResolvedErrorDescriptor = {
  taxonomyCode: string | null;
  title: string;
  description: string;
  guidance: string;
  severity: ErrorSeverity;
};

const ERROR_COPY = errorCatalog as ErrorCatalog;

type TaskQueueStatus = 'Queued' | 'WaitingApproval' | 'Running' | 'Done' | 'Denied';

type TaskRecord = {
  id: string;
  tool: ToolName;
  label: string;
  createdAt: string;
  status: TaskQueueStatus;
  inputs: Record<string, unknown>;
  planInput: Record<string, unknown> | null;
  planResult: ToolRunSuccess | null;
  applyResult: ToolRunSuccess | null;
  planError: ErrorState | null;
  applyError: ErrorState | null;
  planInFlight: boolean;
  applyInFlight: boolean;
  incidentId: string | null;
  telemetryHref: string | null;
  deniedReason: string | null;
  applySupported: boolean;
};

const CODE_ALIASES: Record<string, string> = {
  RATE_LIMIT: 'RATE_LIMITED',
  CONCURRENCY: 'RATE_LIMITED',
  SCHEMA_INPUT: 'VALIDATION_ERROR',
  SCHEMA_OUTPUT: 'VALIDATION_ERROR',
  BAD_REQUEST: 'VALIDATION_ERROR',
  UNKNOWN_TOOL: 'VALIDATION_ERROR',
  FORBIDDEN_TOOL: 'POLICY_DENIED',
  READ_ONLY_TOOL: 'POLICY_DENIED',
  READ_ONLY_ENFORCED: 'POLICY_DENIED',
  MISSING_TOKEN: 'POLICY_DENIED',
  INVALID_TOKEN: 'POLICY_DENIED',
};

const APPLY_CAPABLE_TOOLS: ReadonlySet<ToolName> = new Set<ToolName>([
  'reviewKit.create',
  'brand.apply',
  'billing.reviewKit',
  'billing.switchFixtures',
]);

type ProvenanceInfo = {
  generated_at: string;
  sb_build_hash: string;
  vr_baseline_id: string;
};

const PROVENANCE_DEFAULT: ProvenanceInfo = {
  generated_at: 'unavailable',
  sb_build_hash: 'unavailable',
  vr_baseline_id: 'unavailable',
};

const PROVENANCE_KEYS: ReadonlyArray<keyof ProvenanceInfo> = [
  'generated_at',
  'sb_build_hash',
  'vr_baseline_id',
];

function readGlobalProvenance(): ProvenanceInfo {
  const globalValue = (globalThis as { __OODS_PROVENANCE__?: unknown }).__OODS_PROVENANCE__;
  if (!globalValue || typeof globalValue !== 'object') {
    return PROVENANCE_DEFAULT;
  }

  const record = globalValue as Record<string, unknown>;
  const result: ProvenanceInfo = { ...PROVENANCE_DEFAULT };

  for (const key of PROVENANCE_KEYS) {
    const value = record[key];
    if (typeof value === 'string' && value.length > 0) {
      result[key] = value;
    }
  }

  return result;
}

function createTaskId(): string {
  const cryptoObj = globalThis.crypto as { randomUUID?: () => string } | undefined;
  if (cryptoObj && typeof cryptoObj.randomUUID === 'function') {
    return cryptoObj.randomUUID();
  }
  return `task-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeTaxonomyCode(code?: string | null): string | null {
  if (!code) return null;
  const normalized = code.toUpperCase();
  return CODE_ALIASES[normalized] ?? normalized;
}

function resolveErrorDescriptor(code?: string | null, status?: number | null): ResolvedErrorDescriptor {
  const taxonomyCode = normalizeTaxonomyCode(code);
  if (taxonomyCode && taxonomyCode in ERROR_COPY.codes) {
    const entry = ERROR_COPY.codes[taxonomyCode];
    return {
      taxonomyCode,
      title: entry.title,
      description: entry.description,
      guidance: entry.guidance,
      severity: entry.severity ?? 'error',
    };
  }
  const statusKey = typeof status === 'number' ? String(status) : null;
  if (statusKey && statusKey in ERROR_COPY.http) {
    const entry = ERROR_COPY.http[statusKey];
    return {
      taxonomyCode,
      title: entry.title,
      description: entry.description,
      guidance: entry.guidance,
      severity: entry.severity ?? 'error',
    };
  }
  const fallback = ERROR_COPY.fallback;
  return {
    taxonomyCode,
    title: fallback.title,
    description: fallback.description,
    guidance: fallback.guidance,
    severity: fallback.severity ?? 'error',
  };
}

const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 18px;
  font-size: 13px;
  line-height: 1.4;
`;

const Section = styled.section`
  border: 1px solid rgba(0, 0, 0, 0.07);
  border-radius: 8px;
  padding: 14px 18px;
  background: rgba(255, 255, 255, 0.92);
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const SectionTitle = styled.h3`
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #333;
`;

const ProvenanceList = styled.dl`
  margin: 0;
  display: grid;
  grid-template-columns: minmax(100px, 140px) 1fr;
  gap: 6px 12px;
  font-size: 12px;
  color: #333;
`;

const ProvenanceTerm = styled.dt`
  margin: 0;
  font-weight: 600;
  text-transform: none;
`;

const ProvenanceValue = styled.dd`
  margin: 0;
  font-family: 'IBM Plex Mono', 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
  word-break: break-all;
`;

const ProvenanceStatus = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
  color: #1f6feb;
`;

const Label = styled.label`
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: #444;
`;

const Select = styled.select`
  width: 100%;
  padding: 6px 10px;
  border-radius: 6px;
  border: 1px solid rgba(0, 0, 0, 0.15);
  background: white;
`;

const TextInput = styled.input`
  width: 100%;
  padding: 6px 10px;
  border-radius: 6px;
  border: 1px solid rgba(0, 0, 0, 0.15);
  background: white;
`;

const FieldHint = styled.span`
  font-size: 11px;
  color: #666;
`;

const CheckboxWrap = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const Muted = styled.span`
  color: #666;
`;

const StatusList = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
`;

const TASK_STATUS_THEME: Record<TaskQueueStatus, { bg: string; fg: string; border: string }> = {
  Queued: { bg: 'rgba(22, 99, 255, 0.12)', fg: '#1d4ed8', border: 'rgba(22, 99, 255, 0.32)' },
  WaitingApproval: { bg: 'rgba(217, 119, 6, 0.14)', fg: '#92400e', border: 'rgba(217, 119, 6, 0.32)' },
  Running: { bg: 'rgba(124, 58, 237, 0.14)', fg: '#5b21b6', border: 'rgba(124, 58, 237, 0.32)' },
  Done: { bg: 'rgba(22, 163, 74, 0.14)', fg: '#166534', border: 'rgba(22, 163, 74, 0.32)' },
  Denied: { bg: 'rgba(220, 38, 38, 0.14)', fg: '#991b1b', border: 'rgba(220, 38, 38, 0.32)' },
};

const TaskQueueList = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const TaskQueueItemButton = styled.button<{ $active: boolean }>`
  width: 100%;
  border: 1px solid ${({ $active }) => ($active ? 'rgba(22, 99, 255, 0.45)' : 'rgba(0, 0, 0, 0.12)')};
  border-radius: 8px;
  padding: 10px 12px;
  background: ${({ $active }) => ($active ? 'rgba(22, 99, 255, 0.05)' : '#fff')};
  display: flex;
  flex-direction: column;
  gap: 6px;
  text-align: left;
  cursor: pointer;

  &:hover {
    border-color: rgba(22, 99, 255, 0.35);
  }

  &:focus-visible {
    outline: 2px solid #1663ff;
    outline-offset: 2px;
  }
`;

const TaskTitleRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
`;

const TaskLabel = styled.span`
  font-size: 12px;
  font-weight: 600;
  color: #1f2937;
`;

const TaskRemoveButton = styled.button`
  appearance: none;
  border: none;
  background: none;
  padding: 2px;
  margin-left: auto;
  border-radius: 4px;
  font-size: 11px;
  color: #6b7280;
  cursor: pointer;

  &:hover {
    color: #b91c1c;
  }

  &:focus-visible {
    outline: 2px solid #1663ff;
    outline-offset: 2px;
  }
`;

const TaskStatusBadge = styled.span<{ $status: TaskQueueStatus }>`
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 999px;
  background: ${({ $status }) => TASK_STATUS_THEME[$status].bg};
  color: ${({ $status }) => TASK_STATUS_THEME[$status].fg};
  border: 1px solid ${({ $status }) => TASK_STATUS_THEME[$status].border};
`;

const TaskMetaRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  font-size: 11px;
  color: #4b5563;
`;

const TaskIncidentLink = styled.a`
  color: #0f4cd2;
  font-weight: 500;
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
`;

const TaskEmptyNotice = styled.p`
  margin: 0;
  font-size: 12px;
  color: #6b7280;
`;

const ActionsRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
`;

const PrimaryButton = styled.button<{ $variant?: 'primary' | 'secondary'; $busy?: boolean }>`
  padding: 6px 16px;
  border-radius: 6px;
  border: ${({ $variant }) => ($variant === 'secondary' ? '1px solid rgba(0, 0, 0, 0.18)' : 'none')};
  background: ${({ $variant, $busy }) =>
    $variant === 'secondary'
      ? '#fff'
      : $busy
      ? 'rgba(22, 99, 255, 0.6)'
      : '#1663ff'};
  color: ${({ $variant }) => ($variant === 'secondary' ? '#111' : '#fff')};
  font-weight: 600;
  cursor: ${({ $busy }) => ($busy ? 'wait' : 'pointer')};

  &:disabled {
    cursor: not-allowed;
    background: ${({ $variant }) => ($variant === 'secondary' ? '#f3f3f3' : 'rgba(22, 99, 255, 0.45)')};
    color: ${({ $variant }) => ($variant === 'secondary' ? '#999' : '#fff')};
  }

  &:focus-visible {
    outline: 2px solid #0f4cd2;
    outline-offset: 2px;
  }
`;

const PlanNotice = styled.div`
  border-left: 3px solid #1663ff;
  background: rgba(22, 99, 255, 0.08);
  padding: 10px 12px;
  font-size: 12px;
  color: #1a3c87;
`;

const SummaryCard = styled.div`
  border-left: 4px solid #16a34a;
  background: rgba(22, 163, 74, 0.08);
  padding: 12px 14px;
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const SummaryTitle = styled.h4`
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: #0f5132;
`;

const ErrorCard = styled.div<{ $severity: ErrorSeverity }>`
  border-left: 4px solid ${({ $severity }) => ($severity === 'warning' ? '#b45309' : '#d92d20')};
  background: ${({ $severity }) => ($severity === 'warning' ? 'rgba(245, 158, 11, 0.12)' : 'rgba(217, 45, 32, 0.08)')};
  padding: 12px 14px;
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const ErrorTitle = styled.h4<{ $severity: ErrorSeverity }>`
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: ${({ $severity }) => ($severity === 'warning' ? '#92400e' : '#7f1d1d')};
`;

const ErrorDetails = styled.div`
  font-size: 12px;
  color: #5c1b1b;
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const ErrorGuidance = styled.span`
  font-size: 12px;
  color: #374151;
`;

const ErrorMetaList = styled.ul`
  list-style: none;
  margin: 4px 0 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 11px;
  color: #4b5563;
`;

const ErrorMetaItem = styled.li`
  display: inline;
`;

const ErrorMessage = styled.span`
  font-size: 11px;
  color: #6b7280;
`;

const Divider = styled.hr`
  border: none;
  border-top: 1px solid rgba(0, 0, 0, 0.08);
  margin: 12px 0;
`;

const SRStatus = styled.div`
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
`;

const TOOL_DESCRIPTIONS: Record<ToolName, string> = {
  'a11y.scan': 'Run accessibility scan diagnostics (read-only).',
  'purity.audit': 'Run purity guard audit against tokens usage.',
  'vrt.run': 'Trigger visual regression summary capture.',
  'diag.snapshot': 'Collect project diagnostics snapshot.',
  'reviewKit.create': 'Generate review kit artifacts (write-capable).',
  'brand.apply': 'Preview and apply Brand A palette updates via alias or patch strategies.',
  'billing.reviewKit': 'Generate billing review kit bundles across provider fixtures.',
  'billing.switchFixtures': 'Preview and apply billing fixture switches for Storybook contexts.',
};

function schemaDefaults(schema: JsonSchema): Record<string, unknown> {
  if (schema?.type !== 'object' || !schema.properties) return {};
  const defaults: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(schema.properties)) {
    if (value?.default !== undefined) {
      defaults[key] = value.default;
    } else if (value?.type === 'boolean') {
      defaults[key] = false;
    } else if (value?.type === 'string') {
      if (Array.isArray(value.enum) && value.enum.length) {
        defaults[key] = typeof value.enum[0] === 'string' ? value.enum[0] : String(value.enum[0]);
      } else {
        defaults[key] = '';
      }
    } else if (value?.type === 'number' || value?.type === 'integer') {
      defaults[key] = 0;
    } else if (value?.type === 'array') {
      if (Array.isArray(value.default)) {
        defaults[key] = value.default;
      } else if (value.items && Array.isArray(value.items.enum) && value.items.enum.length) {
        defaults[key] = [value.items.enum[0]];
      } else {
        defaults[key] = [];
      }
    } else {
      defaults[key] = null;
    }
  }
  return defaults;
}

function buildDescriptor(tool: ToolName): ToolDescriptor {
  let label: string;
  switch (tool) {
    case 'a11y.scan':
      label = 'Accessibility Scan';
      break;
    case 'purity.audit':
      label = 'Purity Audit';
      break;
    case 'vrt.run':
      label = 'Visual Regression';
      break;
    case 'diag.snapshot':
      label = 'Diagnostics Snapshot';
      break;
    case 'reviewKit.create':
      label = 'Review Kit';
      break;
    case 'billing.reviewKit':
      label = 'Billing Review Kit';
      break;
    case 'billing.switchFixtures':
      label = 'Billing Fixture Switch';
      break;
    default:
      label = 'Brand Apply';
      break;
  }

  let inputSchema: JsonSchema;
  if (tool === 'brand.apply') {
    inputSchema = brandApplyInputSchema as JsonSchema;
  } else if (tool === 'billing.reviewKit') {
    inputSchema = billingReviewKitInputSchema as JsonSchema;
  } else if (tool === 'billing.switchFixtures') {
    inputSchema = billingSwitchFixturesInputSchema as JsonSchema;
  } else {
    inputSchema = genericInputSchema as JsonSchema;
  }

  return {
    name: tool,
    label,
    description: TOOL_DESCRIPTIONS[tool],
    inputSchema,
  };
}

function enforceApplyValue(values: Record<string, unknown>, schema: JsonSchema, apply: boolean): Record<string, unknown> {
  const next = { ...values };
  if (schema?.properties?.apply) {
    next.apply = apply;
  } else {
    next.apply = apply;
  }
  return next;
}

function formattedPhase(phase: PanelPhase): string {
  switch (phase) {
    case 'idle':
      return 'Idle';
    case 'planning':
      return 'Planning (dry run)';
    case 'review':
      return 'Reviewing plan';
    case 'awaiting-approval':
      return 'Awaiting approval';
    case 'executing':
      return 'Applying changes';
    case 'summary':
      return 'Summary';
    case 'error':
      return 'Error';
    default:
      return phase;
  }
}

function isPlanningPhase(phase: PanelPhase) {
  return phase === 'planning';
}

function isExecutingPhase(phase: PanelPhase) {
  return phase === 'executing';
}

export function AgentPanel() {
  const [toolNames, setToolNames] = useState<ToolName[]>([]);
  const [toolError, setToolError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ToolName | ''>('');
  const [inputs, setInputs] = useState<Record<string, unknown>>({});
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [phase, setPhase] = useState<PanelPhase>('idle');
  const [loadingTools, setLoadingTools] = useState(false);
  const [planResult, setPlanResult] = useState<ToolRunSuccess | null>(null);
  const [applyResult, setApplyResult] = useState<ToolRunSuccess | null>(null);
  const [errorState, setErrorState] = useState<ErrorState | null>(null);
  const [srAnnouncement, setSrAnnouncement] = useState('');
  const [approvalTaskId, setApprovalTaskId] = useState<string | null>(null);
  const errorHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const summaryHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const planInputRef = useRef<Record<string, unknown> | null>(null);

  const descriptors = useMemo(() => toolNames.map((name) => buildDescriptor(name)), [toolNames]);
  const selectedDescriptor = useMemo(
    () => descriptors.find((descriptor) => descriptor.name === selected) || null,
    [descriptors, selected]
  );
  const selectedTask = useMemo(
    () => tasks.find((task) => task.id === selectedTaskId) ?? null,
    [tasks, selectedTaskId]
  );
  const queueCounts = useMemo(
    () =>
      tasks.reduce(
        (acc, task) => {
          acc.total += 1;
          acc[task.status] = (acc[task.status] ?? 0) + 1;
          return acc;
        },
        {
          total: 0,
          Queued: 0,
          WaitingApproval: 0,
          Running: 0,
          Done: 0,
          Denied: 0,
        } as Record<'total' | TaskQueueStatus, number>
      ),
    [tasks]
  );

  const provenanceInfo = useMemo(readGlobalProvenance, []);
  const sbBuildHash = provenanceInfo.sb_build_hash;
  const vrBaselineId = provenanceInfo.vr_baseline_id;
  const provenanceGeneratedAt = provenanceInfo.generated_at;
  const provenanceReady = sbBuildHash !== 'unavailable' && vrBaselineId !== 'unavailable';

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoadingTools(true);
      setToolError(null);
      try {
        const names = await fetchToolNames();
        if (cancelled) return;
        setToolNames(names);
        if (!selected && names.length) {
          setSelected(names[0]);
          const defaults = schemaDefaults(genericInputSchema as JsonSchema);
          setInputs(enforceApplyValue(defaults, genericInputSchema as JsonSchema, false));
        }
      } catch (err: unknown) {
        if (cancelled) return;
        const message = err instanceof BridgeError ? err.message : 'Failed to load tools';
        setToolError(message);
      } finally {
        if (!cancelled) {
          setLoadingTools(false);
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedDescriptor) return;
    if (selectedTask && selectedTask.tool === selectedDescriptor.name) {
      return;
    }
    const defaults = schemaDefaults(selectedDescriptor.inputSchema);
    setInputs(enforceApplyValue(defaults, selectedDescriptor.inputSchema, false));
    setPlanResult(null);
    setApplyResult(null);
    setErrorState(null);
    setPhase('idle');
    planInputRef.current = null;
  }, [selectedDescriptor, selectedTask]);

  useEffect(() => {
    if (phase === 'error') {
      errorHeadingRef.current?.focus();
    } else if (phase === 'summary') {
      summaryHeadingRef.current?.focus();
    }
  }, [phase]);

  const handleChangeTool = (event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value as ToolName;
    setSelected(value);
  };

  const handleCheckboxChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = event.target;
    setInputs((prev) => ({ ...prev, [name]: checked }));
  };

  const canQueue = Boolean(selectedDescriptor);
  const canPlan =
    selectedDescriptor != null &&
    selectedTask != null &&
    !selectedTask.planInFlight &&
    !selectedTask.applyInFlight &&
    phase !== 'planning' &&
    phase !== 'executing';
  const canApprove =
    planResult != null &&
    selectedTask != null &&
    selectedTask.status === 'WaitingApproval' &&
    selectedTask.applySupported &&
    !selectedTask.applyInFlight &&
    phase !== 'planning' &&
    phase !== 'executing';
  const canDeny =
    selectedTask != null &&
    selectedTask.applySupported &&
    selectedTask.status === 'WaitingApproval' &&
    !selectedTask.applyInFlight;

  const runPlan = useCallback(async () => {
    if (!selectedDescriptor || !selectedTask) return;
    const descriptor = selectedDescriptor;
    setPlanResult(null);
    setApplyResult(null);
    setPhase('planning');
    setErrorState(null);
    setSrAnnouncement('Planning preview…');

    const baseInput = inputs;
    const preparedInput = enforceApplyValue(baseInput, descriptor.inputSchema, false);
    planInputRef.current = { ...preparedInput };
      setTasks((prev) =>
        prev.map((task) =>
          task.id === selectedTask.id
            ? {
                ...task,
                status: task.applySupported ? (task.status === 'Denied' ? 'Queued' : task.status) : 'Done',
                planInFlight: true,
                planError: null,
                applyError: null,
                planInput: { ...preparedInput },
                inputs: { ...preparedInput },
              deniedReason: null,
            }
          : task
      )
    );
    try {
      const result = await runTool(descriptor.name, preparedInput);
      setPlanResult(result);
      setPhase('review');
      setSrAnnouncement(selectedTask.applySupported ? 'Plan ready. Review the proposed changes.' : 'Dry run complete.');
      const telemetryHref = result.diagnosticsPath ? artifactHref(result.diagnosticsPath) : null;
      setTasks((prev) =>
        prev.map((task) =>
          task.id === selectedTask.id
            ? {
                ...task,
                status: task.applySupported ? 'WaitingApproval' : 'Done',
                planInFlight: false,
                planResult: result,
                planInput: { ...preparedInput },
                planError: null,
                incidentId: result.incidentId ?? task.incidentId,
                telemetryHref: telemetryHref ?? task.telemetryHref,
              }
            : task
        )
      );
    } catch (err: unknown) {
      const bridgeError = err instanceof BridgeError ? err : new BridgeError(String(err));
      const errorDescriptor: ErrorState = {
        phase: 'planning',
        message: bridgeError.message,
        code: bridgeError.code ?? null,
        status: bridgeError.status ?? null,
        incidentId: bridgeError.incidentId ?? null,
        details: bridgeError.details,
      };
      setErrorState(errorDescriptor);
      setPhase('error');
      setSrAnnouncement('Run failed. See error details.');
      setTasks((prev) =>
        prev.map((task) =>
          task.id === selectedTask.id
            ? {
                ...task,
                planInFlight: false,
                planError: errorDescriptor,
                status: 'Queued',
              }
            : task
        )
      );
    }
  }, [inputs, selectedDescriptor, selectedTask]);

  const runApply = useCallback(async () => {
    if (!selectedDescriptor || !selectedTask || !selectedTask.applySupported) return;
    if (!planResult && !planInputRef.current && !selectedTask.planInput) return;
    setPhase('executing');
    setErrorState(null);
    setSrAnnouncement('Applying approved changes now.');

    const baseInput = selectedTask.planInput ?? planInputRef.current ?? enforceApplyValue(inputs, selectedDescriptor.inputSchema, false);
    const preparedInput = { ...baseInput, apply: true };
    planInputRef.current = { ...baseInput };
    setTasks((prev) =>
      prev.map((task) =>
        task.id === selectedTask.id
          ? {
              ...task,
              status: 'Running',
              applyInFlight: true,
              applyError: null,
            }
          : task
      )
    );
    try {
      const result = await runTool(selectedDescriptor.name, preparedInput);
      setApplyResult(result);
      setPhase('summary');
      setSrAnnouncement('Run complete. Artifacts available.');
      const telemetryHref = result.diagnosticsPath ? artifactHref(result.diagnosticsPath) : selectedTask.telemetryHref;
      setTasks((prev) =>
        prev.map((task) =>
          task.id === selectedTask.id
            ? {
                ...task,
                status: 'Done',
                applyInFlight: false,
                applyResult: result,
                applyError: null,
                incidentId: result.incidentId ?? task.incidentId,
                telemetryHref: telemetryHref ?? task.telemetryHref,
                deniedReason: null,
              }
            : task
        )
      );
      setApprovalTaskId(null);
    } catch (err: unknown) {
      const bridgeError = err instanceof BridgeError ? err : new BridgeError(String(err));
      const errorDescriptor: ErrorState = {
        phase: 'executing',
        message: bridgeError.message,
        code: bridgeError.code ?? null,
        status: bridgeError.status ?? null,
        incidentId: bridgeError.incidentId ?? null,
        details: bridgeError.details,
      };
      setErrorState(errorDescriptor);
      setPhase('error');
      setSrAnnouncement('Run failed. See error details.');
      setTasks((prev) =>
        prev.map((task) =>
          task.id === selectedTask.id
            ? {
                ...task,
                status: 'WaitingApproval',
                applyInFlight: false,
                applyError: errorDescriptor,
              }
            : task
        )
      );
      setApprovalTaskId(null);
    }
  }, [inputs, planResult, selectedDescriptor, selectedTask]);

  const handleRemoveTask = useCallback(
    (taskId: string) => {
      setTasks((prev) => prev.filter((task) => task.id !== taskId));
      if (selectedTaskId === taskId) {
        setSelectedTaskId(null);
      }
    },
    [selectedTaskId]
  );

  const handleQueueTask = useCallback(() => {
    if (!selectedDescriptor) return;
    const preparedInput = enforceApplyValue(inputs, selectedDescriptor.inputSchema, false);
    const id = createTaskId();
    const applySupported = APPLY_CAPABLE_TOOLS.has(selectedDescriptor.name);
    const nextTask: TaskRecord = {
      id,
      tool: selectedDescriptor.name,
      label: selectedDescriptor.label,
      createdAt: new Date().toISOString(),
      status: 'Queued',
      inputs: { ...preparedInput },
      planInput: null,
      planResult: null,
      applyResult: null,
      planError: null,
      applyError: null,
      planInFlight: false,
      applyInFlight: false,
      incidentId: null,
      telemetryHref: null,
      deniedReason: null,
      applySupported,
    };
    setTasks((prev) => [...prev, nextTask]);
    setSelectedTaskId(id);
    setSelected(selectedDescriptor.name);
    setPlanResult(null);
    setApplyResult(null);
    setErrorState(null);
    setPhase('idle');
    planInputRef.current = null;
    setSrAnnouncement(`Task "${selectedDescriptor.label}" queued.`);
  }, [inputs, selectedDescriptor]);

  const handleSelectTask = useCallback(
    (task: TaskRecord) => {
      setSelectedTaskId(task.id);
      setSelected(task.tool);
      const descriptor = buildDescriptor(task.tool);
      const prepared = enforceApplyValue(task.planInput ?? task.inputs, descriptor.inputSchema, false);
      setInputs(prepared);
      planInputRef.current = task.planInput ? { ...task.planInput } : null;
      setSrAnnouncement(`Selected task "${task.label}".`);
    },
    []
  );

  const handleDenyTask = useCallback(() => {
    if (!selectedTask || !selectedTask.applySupported) return;
    const reason = window.prompt('Provide a short reason for denying this task (optional):', selectedTask.deniedReason ?? '') ?? '';
    const normalizedReason = reason.trim();
    setTasks((prev) =>
      prev.map((task) =>
        task.id === selectedTask.id
          ? {
              ...task,
              status: 'Denied',
              planInFlight: false,
              applyInFlight: false,
              deniedReason: normalizedReason.length ? normalizedReason : null,
            }
          : task
      )
    );
    setPhase('summary');
    setErrorState(null);
    setSrAnnouncement('Task denied. Waiting for next action.');
  }, [selectedTask]);

  const handleRetry = () => {
    if (!errorState) return;
    if (errorState.phase === 'executing') {
      void runApply();
    } else {
      void runPlan();
    }
  };

  useEffect(() => {
    if (tasks.length === 0) {
      if (selectedTaskId !== null) {
        setSelectedTaskId(null);
      }
      setPlanResult(null);
      setApplyResult(null);
      setErrorState(null);
      setPhase('idle');
      planInputRef.current = null;
      return;
    }
    if (selectedTaskId && tasks.some((task) => task.id === selectedTaskId)) {
      return;
    }
    const fallback = tasks[tasks.length - 1];
    setSelectedTaskId(fallback.id);
    setSelected(fallback.tool);
    const descriptor = buildDescriptor(fallback.tool);
    const prepared = enforceApplyValue(fallback.planInput ?? fallback.inputs, descriptor.inputSchema, false);
    setInputs(prepared);
    planInputRef.current = fallback.planInput ? { ...fallback.planInput } : null;
  }, [selectedTaskId, tasks]);

  useEffect(() => {
    if (!selectedTask) {
      setPlanResult(null);
      setApplyResult(null);
      setErrorState(null);
      if (phase !== 'awaiting-approval') {
        setPhase('idle');
      }
      return;
    }
    setPlanResult(selectedTask.planResult);
    setApplyResult(selectedTask.applyResult);
    if (selectedTask.applyInFlight) {
      setPhase('executing');
      setErrorState(null);
    } else if (selectedTask.planInFlight) {
      setPhase('planning');
      setErrorState(null);
    } else if (selectedTask.applyError) {
      setErrorState(selectedTask.applyError);
      setPhase('error');
    } else if (selectedTask.planError) {
      setErrorState(selectedTask.planError);
      setPhase('error');
    } else if (selectedTask.status === 'WaitingApproval') {
      setPhase('review');
      setErrorState(null);
    } else if (selectedTask.status === 'Running') {
      setPhase('executing');
      setErrorState(null);
    } else if (selectedTask.status === 'Done') {
      if (selectedTask.applySupported) {
        setPhase('summary');
      } else {
        setPhase('review');
      }
      setErrorState(null);
    } else if (selectedTask.status === 'Denied') {
      setPhase('summary');
      setErrorState(null);
    } else if (phase !== 'awaiting-approval') {
      setPhase('idle');
      setErrorState(null);
    }
    if (selectedTask.planInput) {
      planInputRef.current = { ...selectedTask.planInput };
    }
  }, [phase, selectedTask]);

  const renderFields = (): ReactNode => {
    if (!selectedDescriptor) return null;
    const schema = selectedDescriptor.inputSchema;
    if (schema?.type !== 'object' || !schema.properties) {
      return <Muted>No configurable inputs for this tool.</Muted>;
    }

    return Object.entries(schema.properties).map(([key, def]) => {
      if (!def) return null;

      if (def.type === 'boolean') {
        const disabled = key === 'apply';
        return (
          <Label key={key}>
            <CheckboxWrap>
              <input
                type="checkbox"
                name={key}
                checked={Boolean(inputs[key])}
                onChange={handleCheckboxChange}
                disabled={disabled}
              />
              <span>{def.title || key}</span>
            </CheckboxWrap>
            {disabled ? (
              <FieldHint>Apply is gated behind approval and cannot be toggled directly.</FieldHint>
            ) : (
              def.description && <FieldHint>{def.description}</FieldHint>
            )}
          </Label>
        );
      }

      if (def.type === 'string') {
        const enumValues = Array.isArray(def.enum) ? def.enum : null;
        const candidate =
          typeof inputs[key] === 'string'
            ? inputs[key]
            : typeof def.default === 'string'
            ? def.default
            : enumValues && enumValues.length
            ? enumValues[0]
            : '';
        const currentValue = String(candidate);

        if (enumValues && enumValues.length) {
          return (
            <Label key={key}>
              {def.title || key}
              <Select
                value={currentValue}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  setInputs((prev) => ({ ...prev, [key]: nextValue }));
                }}
                disabled={key === 'apply'}
              >
                {enumValues.map((option) => {
                  const optionValue = String(option);
                  return (
                    <option key={optionValue} value={optionValue}>
                      {optionValue}
                    </option>
                  );
                })}
              </Select>
              {def.description && <FieldHint>{def.description}</FieldHint>}
            </Label>
          );
        }

        return (
          <Label key={key}>
            {def.title || key}
            <TextInput
              type="text"
              name={key}
              value={currentValue}
              onChange={(event) => {
                const nextValue = event.target.value;
                setInputs((prev) => ({ ...prev, [key]: nextValue }));
              }}
            />
            {def.description && <FieldHint>{def.description}</FieldHint>}
          </Label>
        );
      }

      if (def.type === 'array') {
        const selectedValues = new Set(
          Array.isArray(inputs[key]) ? (inputs[key] as unknown[]).map((value) => String(value)) : []
        );
        const options =
          def.items && Array.isArray(def.items.enum) ? def.items.enum.map((option) => String(option)) : [];

        return (
          <Label key={key}>
            {def.title || key}
            <div>
              {options.map((option) => (
                <CheckboxWrap key={option}>
                  <input
                    type="checkbox"
                    name={`${key}-${option}`}
                    checked={selectedValues.has(option)}
                    onChange={(event) => {
                      const checked = event.target.checked;
                      setInputs((prev) => {
                        const previous = new Set(
                          Array.isArray(prev[key]) ? (prev[key] as unknown[]).map((value) => String(value)) : []
                        );
                        if (checked) {
                          previous.add(option);
                        } else {
                          previous.delete(option);
                        }
                        return { ...prev, [key]: Array.from(previous) };
                      });
                    }}
                  />
                  <span>{option}</span>
                </CheckboxWrap>
              ))}
            </div>
            {def.description && <FieldHint>{def.description}</FieldHint>}
          </Label>
        );
      }

      return (
        <Label key={key}>
          {def.title || key}
          <Muted>({def.type || 'unknown'})</Muted>
        </Label>
      );
    });
  };

  const showPreviewSection = Boolean(planResult);
  const diffLoading = phase === 'planning';
  const srAnnouncementText = srAnnouncement;

  return (
    <Container>
      <SRStatus role="status" aria-live="polite">
        {srAnnouncementText}
      </SRStatus>

      <Section aria-labelledby="agent-provenance-heading">
        <SectionTitle id="agent-provenance-heading">About This Build</SectionTitle>
        <ProvenanceList>
          <ProvenanceTerm>Status</ProvenanceTerm>
          <ProvenanceValue>
            <ProvenanceStatus>{provenanceReady ? 'Ready' : 'Pending pkg:build'}</ProvenanceStatus>
          </ProvenanceValue>
          <ProvenanceTerm>Generated</ProvenanceTerm>
          <ProvenanceValue>{provenanceGeneratedAt}</ProvenanceValue>
          <ProvenanceTerm>Storybook hash</ProvenanceTerm>
          <ProvenanceValue>
            <code>{sbBuildHash}</code>
          </ProvenanceValue>
          <ProvenanceTerm>VR baseline</ProvenanceTerm>
          <ProvenanceValue>
            <code>{vrBaselineId}</code>
          </ProvenanceValue>
        </ProvenanceList>
        {!provenanceReady ? (
          <Muted>
            Run <code>pnpm run pkg:build</code> to refresh Storybook and visual-regression provenance.
          </Muted>
        ) : null}
      </Section>

      <Section aria-labelledby="agent-status-heading">
        <SectionTitle id="agent-status-heading">Status</SectionTitle>
        <StatusList>
          <li>
            Bridge: <code>{bridgeOrigin}</code>
          </li>
          <li>Panel phase: {formattedPhase(phase)}</li>
          <li>Selected tool: {selectedDescriptor ? selectedDescriptor.label : 'None'}</li>
          <li>
            Tasks: {queueCounts.total} total (queued {queueCounts.Queued}, waiting {queueCounts.WaitingApproval}, running{' '}
            {queueCounts.Running}, done {queueCounts.Done}, denied {queueCounts.Denied})
          </li>
          {selectedTask ? (
            <li>
              Active task: {selectedTask.label} —{' '}
              {selectedTask.planInFlight
                ? 'Planning…'
                : selectedTask.applyInFlight
                ? 'Running…'
                : selectedTask.status}
              {selectedTask.incidentId && (
                <>
                  {' '}
                  • Incident{' '}
                  {selectedTask.telemetryHref ? (
                    <TaskIncidentLink href={selectedTask.telemetryHref} target="_blank" rel="noreferrer">
                      {selectedTask.incidentId}
                    </TaskIncidentLink>
                  ) : (
                    <code>{selectedTask.incidentId}</code>
                  )}
                </>
              )}
            </li>
          ) : (
            <li>Active task: none</li>
          )}
        </StatusList>
        {loadingTools && <Muted>Loading tools…</Muted>}
        {toolError && (
          <ErrorCard role="alert" $severity="error">
            <ErrorTitle $severity="error">Tools Unavailable</ErrorTitle>
            <ErrorDetails>{toolError}</ErrorDetails>
          </ErrorCard>
        )}
      </Section>

      <Section aria-labelledby="agent-tool-heading">
        <SectionTitle id="agent-tool-heading">Tool</SectionTitle>
        {descriptors.length === 0 ? (
          <Muted>No tools available.</Muted>
        ) : (
          <div>
            <Label>
              Select tool
              <Select value={selected} onChange={handleChangeTool} disabled={isPlanningPhase(phase) || isExecutingPhase(phase)}>
                {descriptors.map((descriptor) => (
                  <option key={descriptor.name} value={descriptor.name}>
                    {descriptor.label}
                  </option>
                ))}
              </Select>
            </Label>
            {selectedDescriptor && <FieldHint>{selectedDescriptor.description}</FieldHint>}
          </div>
        )}
      </Section>

      <Section aria-labelledby="agent-input-heading">
        <SectionTitle id="agent-input-heading">Input</SectionTitle>
        {renderFields()}
      </Section>

      <Section aria-labelledby="agent-queue-heading">
        <SectionTitle id="agent-queue-heading">Task Queue</SectionTitle>
        <ActionsRow>
          <PrimaryButton type="button" onClick={handleQueueTask} disabled={!canQueue}>
            Queue task
          </PrimaryButton>
        </ActionsRow>
        {tasks.length === 0 ? (
          <TaskEmptyNotice>No tasks queued yet. Configure inputs and queue a task to begin.</TaskEmptyNotice>
        ) : (
          <TaskQueueList className="agent-panel__task-list">
            {tasks.map((task) => {
              const isActive = Boolean(selectedTask && selectedTask.id === task.id);
              return (
                <li key={task.id}>
                  <TaskQueueItemButton
                    type="button"
                    onClick={() => handleSelectTask(task)}
                    $active={isActive}
                    className="agent-panel__task-item"
                  >
                    <TaskTitleRow>
                      <TaskLabel>{task.label}</TaskLabel>
                      <TaskStatusBadge className="agent-panel__task-status" $status={task.status}>
                        {task.planInFlight ? 'Planning…' : task.applyInFlight ? 'Running…' : task.status}
                      </TaskStatusBadge>
                      <TaskRemoveButton
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleRemoveTask(task.id);
                        }}
                        aria-label={`Remove task ${task.label}`}
                      >
                        ✕
                      </TaskRemoveButton>
                    </TaskTitleRow>
                    <TaskMetaRow>
                      <span>Tool: {task.tool}</span>
                      <span>Queued: {task.createdAt}</span>
                      {task.incidentId && (
                        <span>
                          Incident:{' '}
                          {task.telemetryHref ? (
                            <TaskIncidentLink href={task.telemetryHref} target="_blank" rel="noreferrer">
                              {task.incidentId}
                            </TaskIncidentLink>
                          ) : (
                            <code>{task.incidentId}</code>
                          )}
                        </span>
                      )}
                      {task.deniedReason && <span>Reason: {task.deniedReason}</span>}
                      {task.planError && <span>Dry-run error</span>}
                      {task.applyError && <span>Apply error</span>}
                    </TaskMetaRow>
                  </TaskQueueItemButton>
                </li>
              );
            })}
          </TaskQueueList>
        )}
      </Section>

      <Section aria-labelledby="agent-actions-heading">
        <SectionTitle id="agent-actions-heading">Plan &amp; Apply</SectionTitle>
        <ActionsRow>
          <PrimaryButton
            type="button"
            onClick={() => void runPlan()}
            disabled={!canPlan}
            $busy={isPlanningPhase(phase)}
          >
            {isPlanningPhase(phase) ? 'Planning…' : 'Preview selected task'}
          </PrimaryButton>
          <PrimaryButton
            type="button"
            onClick={() => {
              if (!selectedTask) return;
              setApprovalTaskId(selectedTask.id);
              setPhase('awaiting-approval');
              setSrAnnouncement('Approval required dialog open. Focus is on the cancel button.');
            }}
            disabled={!canApprove}
            $variant="secondary"
          >
            Approve &amp; Apply…
          </PrimaryButton>
          <PrimaryButton type="button" onClick={() => handleDenyTask()} disabled={!canDeny} $variant="secondary">
            Deny Task
          </PrimaryButton>
        </ActionsRow>
        {!selectedTask?.applySupported && selectedTask && (
          <Muted>This tool is dry-run only. Approval is not required.</Muted>
        )}
        {phase === 'review' && <Muted>Plan ready. Review before approving.</Muted>}
        {phase === 'executing' && <Muted>Applying approved changes…</Muted>}
        {selectedTask?.status === 'Denied' && <Muted>Task marked as denied. Queue another run when ready.</Muted>}
      </Section>

      {showPreviewSection && (
        <Section aria-labelledby="agent-preview-heading">
          <SectionTitle id="agent-preview-heading">Plan Preview</SectionTitle>
          <PlanNotice role="status">Preview only (no changes will be applied) until approval is granted.</PlanNotice>
          <DiffViewer
            diffs={planResult?.preview?.diffs || null}
            loading={diffLoading}
            autoFocus={phase === 'review'}
          />
          <Divider />
          <ArtifactList
            caption="Preview artifacts"
            artifacts={planResult?.artifacts ?? []}
            artifactsDetail={planResult?.artifactsDetail}
            transcriptPath={planResult?.transcriptPath ?? null}
            bundleIndexPath={planResult?.bundleIndexPath ?? null}
            diagnosticsPath={planResult?.diagnosticsPath ?? null}
          />
        </Section>
      )}

      {phase === 'summary' && (
        <Section aria-labelledby="agent-summary-heading">
          <SectionTitle id="agent-summary-heading" ref={summaryHeadingRef} tabIndex={-1}>
            Summary
          </SectionTitle>
          <SummaryCard role="status">
            <SummaryTitle>
              {selectedTask?.status === 'Denied'
                ? 'Task Denied'
                : selectedTask?.applySupported === false
                ? 'Dry Run Complete'
                : 'Changes Applied'}
            </SummaryTitle>
            <span>
              {selectedTask?.status === 'Denied'
                ? 'Task marked as denied. No changes were applied.'
                : selectedTask?.applySupported === false
                ? 'Dry run finished successfully. Review the generated artifacts above.'
                : 'Run complete. Artifacts are available below. Transcript and bundle index are stored for audit.'}
            </span>
            {selectedTask?.deniedReason && <span>Reason: {selectedTask.deniedReason}</span>}
          </SummaryCard>
          {selectedTask?.status !== 'Denied' && selectedTask?.applySupported !== false && (
            <ArtifactList
              caption="Applied artifacts"
              artifacts={applyResult?.artifacts ?? []}
              artifactsDetail={applyResult?.artifactsDetail}
              transcriptPath={applyResult?.transcriptPath ?? null}
              bundleIndexPath={applyResult?.bundleIndexPath ?? null}
              diagnosticsPath={applyResult?.diagnosticsPath ?? null}
            />
          )}
        </Section>
      )}

      {phase === 'error' && errorState && (() => {
        const descriptor = resolveErrorDescriptor(errorState.code ?? null, errorState.status ?? null);
        const normalizedCode = descriptor.taxonomyCode;
        const sourceCode = errorState.code ?? null;
        const baseCode = normalizedCode ?? sourceCode;
        const metaItems: ReactNode[] = [];
        if (baseCode) {
          metaItems.push(
            <ErrorMetaItem key="code">
              Code: <code>{baseCode}</code>
              {normalizedCode && sourceCode && normalizedCode !== sourceCode ? (
                <span>
                  {' '}
                  (source <code>{sourceCode}</code>)
                </span>
              ) : null}
            </ErrorMetaItem>
          );
        }
        if (typeof errorState.status === 'number') {
          metaItems.push(
            <ErrorMetaItem key="status">
              HTTP: <code>{errorState.status}</code>
            </ErrorMetaItem>
          );
        }
        if (errorState.incidentId) {
          metaItems.push(
            <ErrorMetaItem key="incident">
              Incident ID: <code>{errorState.incidentId}</code>
            </ErrorMetaItem>
          );
        }
        const detailMessage =
          errorState.message && errorState.message !== descriptor.description ? errorState.message : null;
        const detailText = typeof errorState.details === 'string' ? errorState.details : null;

        return (
          <Section aria-labelledby="agent-error-heading">
            <ErrorCard role="alert" $severity={descriptor.severity}>
              <ErrorTitle
                id="agent-error-heading"
                ref={errorHeadingRef}
                tabIndex={-1}
                $severity={descriptor.severity}
              >
                {descriptor.title}
              </ErrorTitle>
              <ErrorDetails>
                <span>{descriptor.description}</span>
                <ErrorGuidance>{descriptor.guidance}</ErrorGuidance>
                {metaItems.length > 0 && <ErrorMetaList>{metaItems}</ErrorMetaList>}
                {detailMessage && <ErrorMessage>{detailMessage}</ErrorMessage>}
                {detailText && <ErrorMessage>{detailText}</ErrorMessage>}
              </ErrorDetails>
              <ActionsRow>
                <PrimaryButton type="button" onClick={handleRetry}>
                  Retry
                </PrimaryButton>
                <PrimaryButton
                  type="button"
                  $variant="secondary"
                  onClick={() => {
                    setPhase(planResult ? 'review' : 'idle');
                    setApprovalTaskId(null);
                    setErrorState(null);
                    setSrAnnouncement('');
                  }}
                >
                  Back
                </PrimaryButton>
              </ActionsRow>
            </ErrorCard>
          </Section>
        );
      })()}

      <Section aria-labelledby="agent-artifact-viewer-heading">
        <SectionTitle id="agent-artifact-viewer-heading">Artifact Viewer</SectionTitle>
        <ArtifactViewer headingId="agent-artifact-viewer-heading" />
      </Section>

      <ApproveDialog
        open={Boolean(approvalTaskId)}
        confirming={Boolean(selectedTask?.applyInFlight)}
        onCancel={() => {
          setApprovalTaskId(null);
          setPhase(planResult ? 'review' : 'idle');
          setSrAnnouncement('');
        }}
        onConfirm={() => {
          void runApply();
        }}
      />
    </Container>
  );
}
