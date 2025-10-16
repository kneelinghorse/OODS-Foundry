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
import { bridgeOrigin, fetchToolNames, fetchArtifactText, runTool } from './bridge.js';
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

const ReplayError = styled.span`
  font-size: 12px;
  color: #7f1d1d;
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
  const [phase, setPhase] = useState<PanelPhase>('idle');
  const [loadingTools, setLoadingTools] = useState(false);
  const [planResult, setPlanResult] = useState<ToolRunSuccess | null>(null);
  const [applyResult, setApplyResult] = useState<ToolRunSuccess | null>(null);
  const [errorState, setErrorState] = useState<ErrorState | null>(null);
  const [srAnnouncement, setSrAnnouncement] = useState('');
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [pendingReplay, setPendingReplay] = useState<{ tool: ToolName; payload: Record<string, unknown>; apply: boolean } | null>(null);
  const [replayIntent, setReplayIntent] = useState<{ tool: ToolName; apply: boolean } | null>(null);
  const [replayError, setReplayError] = useState<string | null>(null);
  const [replayLoading, setReplayLoading] = useState(false);
  const errorHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const summaryHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const planInputRef = useRef<Record<string, unknown> | null>(null);

  const descriptors = useMemo(() => toolNames.map((name) => buildDescriptor(name)), [toolNames]);
  const selectedDescriptor = useMemo(
    () => descriptors.find((descriptor) => descriptor.name === selected) || null,
    [descriptors, selected]
  );

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
    if (selectedDescriptor) {
      const defaults = schemaDefaults(selectedDescriptor.inputSchema);
      setInputs(enforceApplyValue(defaults, selectedDescriptor.inputSchema, false));
      setPlanResult(null);
      setApplyResult(null);
      setPhase('idle');
      setErrorState(null);
      if (!pendingReplay) {
        setReplayIntent(null);
      }
      setReplayError(null);
      planInputRef.current = null;
    }
  }, [selectedDescriptor, pendingReplay]);

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

  const canPlan =
    Boolean(selectedDescriptor) && phase !== 'planning' && phase !== 'executing' && phase !== 'awaiting-approval';
  const canApprove =
    Boolean(planResult) && phase !== 'planning' && phase !== 'executing' && phase !== 'awaiting-approval';

  const runPlan = useCallback(async (override?: { descriptor?: ToolDescriptor; input?: Record<string, unknown>; fromReplay?: boolean }) => {
    const descriptor = override?.descriptor ?? selectedDescriptor;
    if (!descriptor) return;
    setPhase('planning');
    setErrorState(null);
    setApplyResult(null);
    setSrAnnouncement('');

    if (!override?.fromReplay) {
      setReplayIntent(null);
    }

    const baseInput = override?.input ?? inputs;
    const preparedInput = enforceApplyValue(baseInput, descriptor.inputSchema, false);
    planInputRef.current = { ...preparedInput };
    try {
      const result = await runTool(descriptor.name, preparedInput);
      setPlanResult(result);
      setPhase('review');
      setSrAnnouncement('Plan ready. Review the proposed changes.');
    } catch (err: unknown) {
      const bridgeError = err instanceof BridgeError ? err : new BridgeError(String(err));
      setErrorState({
        phase: 'planning',
        message: bridgeError.message,
        code: bridgeError.code ?? null,
        status: bridgeError.status ?? null,
        incidentId: bridgeError.incidentId ?? null,
        details: bridgeError.details,
      });
      setPhase('error');
      setSrAnnouncement('Run failed. See error details.');
    }
  }, [inputs, selectedDescriptor]);

  useEffect(() => {
    if (!pendingReplay) return;
    if (!selectedDescriptor || selectedDescriptor.name !== pendingReplay.tool) return;
    const defaults = schemaDefaults(selectedDescriptor.inputSchema);
    const mergedInput = { ...defaults, ...pendingReplay.payload };
    const prepared = enforceApplyValue(mergedInput, selectedDescriptor.inputSchema, false);
    setInputs(prepared);
    planInputRef.current = { ...prepared };
    setReplayIntent({ tool: pendingReplay.tool, apply: pendingReplay.apply });
    void runPlan({ descriptor: selectedDescriptor, input: prepared, fromReplay: true });
    setPendingReplay(null);
  }, [pendingReplay, runPlan, selectedDescriptor]);

  const runApply = useCallback(async () => {
    if (!selectedDescriptor) return;
    if (!planResult && !planInputRef.current) return;
    setShowApproveDialog(false);
    setPhase('executing');
    setErrorState(null);
    setSrAnnouncement('Applying approved changes now.');

    const baseInput =
      planInputRef.current ?? enforceApplyValue(inputs, selectedDescriptor.inputSchema, false);
    const preparedInput = { ...baseInput, apply: true };
    try {
      const result = await runTool(selectedDescriptor.name, preparedInput);
      setApplyResult(result);
      setPhase('summary');
      setSrAnnouncement('Run complete. Artifacts available.');
    } catch (err: unknown) {
      const bridgeError = err instanceof BridgeError ? err : new BridgeError(String(err));
      setErrorState({
        phase: 'executing',
        message: bridgeError.message,
        code: bridgeError.code ?? null,
        status: bridgeError.status ?? null,
        incidentId: bridgeError.incidentId ?? null,
        details: bridgeError.details,
      });
      setPhase('error');
      setSrAnnouncement('Run failed. See error details.');
    }
  }, [inputs, planResult, selectedDescriptor]);

  const handleReplayFromSummary = useCallback(async () => {
    const targetTranscript = applyResult?.transcriptPath ?? planResult?.transcriptPath ?? null;
    if (!targetTranscript) {
      setReplayError('No transcript available to replay.');
      return;
    }
    setReplayLoading(true);
    setReplayError(null);
    try {
      const text = await fetchArtifactText(targetTranscript);
      const data = JSON.parse(text);
      const replayToolRaw = typeof data?.tool === 'string' ? data.tool : null;
      const replayTool = replayToolRaw && toolNames.includes(replayToolRaw as ToolName) ? (replayToolRaw as ToolName) : null;
      if (!replayTool) {
        throw new Error('Transcript references a tool that is not available.');
      }
      const payloadValue = data?.args?.payload;
      const payload: Record<string, unknown> =
        payloadValue && typeof payloadValue === 'object' ? { ...(payloadValue as Record<string, unknown>) } : {};
      const applyFlag = Boolean(data?.args?.apply);
      setPendingReplay({ tool: replayTool, payload, apply: applyFlag });
      setSelected(replayTool);
      setSrAnnouncement('Loading replay transcript.');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setReplayError(message);
    } finally {
      setReplayLoading(false);
    }
  }, [applyResult, planResult, toolNames]);

  const handleRetry = () => {
    if (!errorState) return;
    if (errorState.phase === 'executing') {
      void runApply();
    } else {
      void runPlan();
    }
  };

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
        const currentValue =
          typeof inputs[key] === 'string'
            ? inputs[key]
            : typeof def.default === 'string'
            ? def.default
            : enumValues && enumValues.length
            ? String(enumValues[0])
            : '';

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

      <Section aria-labelledby="agent-status-heading">
        <SectionTitle id="agent-status-heading">Status</SectionTitle>
        <StatusList>
          <li>
            Bridge: <code>{bridgeOrigin}</code>
          </li>
          <li>Panel phase: {formattedPhase(phase)}</li>
          <li>Selected tool: {selectedDescriptor ? selectedDescriptor.label : 'None'}</li>
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

      <Section aria-labelledby="agent-actions-heading">
        <SectionTitle id="agent-actions-heading">Plan &amp; Apply</SectionTitle>
        <ActionsRow>
          <PrimaryButton
            type="button"
            onClick={() => void runPlan()}
            disabled={!canPlan}
            $busy={isPlanningPhase(phase)}
          >
            {isPlanningPhase(phase) ? 'Planning…' : 'Preview changes'}
          </PrimaryButton>
          <PrimaryButton
            type="button"
            onClick={() => {
              setShowApproveDialog(true);
              setPhase('awaiting-approval');
              setSrAnnouncement('Approval required dialog open. Focus is on the cancel button.');
            }}
            disabled={!canApprove}
            $variant="secondary"
          >
            Approve &amp; Apply…
          </PrimaryButton>
        </ActionsRow>
        {phase === 'review' && <Muted>Plan ready. Review before approving.</Muted>}
        {phase === 'executing' && <Muted>Applying approved changes…</Muted>}
      </Section>

      {showPreviewSection && (
        <Section aria-labelledby="agent-preview-heading">
          <SectionTitle id="agent-preview-heading">Plan Preview</SectionTitle>
          <PlanNotice role="status">
            {replayIntent
              ? 'Replay preview loaded. Apply remains gated behind approval.'
              : 'Preview only (no changes will be applied) until approval is granted.'}
          </PlanNotice>
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
            <SummaryTitle>Changes Applied</SummaryTitle>
            <span>
              Run complete. Artifacts are available below. Transcript and bundle index are stored for audit.
            </span>
          </SummaryCard>
          <ActionsRow>
            <PrimaryButton
              type="button"
              onClick={() => void handleReplayFromSummary()}
              $variant="secondary"
              $busy={replayLoading}
            >
              {replayLoading ? 'Loading replay…' : 'Replay this run'}
            </PrimaryButton>
          </ActionsRow>
          {replayError && <ReplayError role="alert">{replayError}</ReplayError>}
          <ArtifactList
            caption="Applied artifacts"
            artifacts={applyResult?.artifacts ?? []}
            artifactsDetail={applyResult?.artifactsDetail}
            transcriptPath={applyResult?.transcriptPath ?? null}
            bundleIndexPath={applyResult?.bundleIndexPath ?? null}
            diagnosticsPath={applyResult?.diagnosticsPath ?? null}
          />
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
                    setShowApproveDialog(false);
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
        open={showApproveDialog}
        confirming={phase === 'executing'}
        onCancel={() => {
          setShowApproveDialog(false);
          setPhase(planResult ? 'review' : 'idle');
          setSrAnnouncement('');
        }}
        onConfirm={() => void runApply()}
      />
    </Container>
  );
}
