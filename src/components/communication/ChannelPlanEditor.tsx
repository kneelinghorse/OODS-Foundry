import type { ChangeEvent, JSX } from 'react';
import { useCallback } from 'react';

import { deliveryPolicySchema, type DeliveryPolicy } from '@/schemas/communication/delivery-policy.js';

export interface ChannelPlanValidationResult {
  readonly isValid: boolean;
  readonly issues: readonly string[];
}

export interface ChannelPlanEditorProps {
  readonly policy: DeliveryPolicy;
  readonly channelTypes: readonly string[];
  readonly onChange: (next: DeliveryPolicy, validation: ChannelPlanValidationResult) => void;
}

export function ChannelPlanEditor({
  policy,
  channelTypes,
  onChange,
}: ChannelPlanEditorProps): JSX.Element {
  const handleRetryMaxChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const nextValue = parseInt(event.target.value, 10);
      const safe = Number.isFinite(nextValue) ? nextValue : 0;
      const nextPolicy: DeliveryPolicy = {
        ...policy,
        retry: {
          ...policy.retry,
          max_attempts: safe,
        },
      };
      onChange(nextPolicy, validatePolicy(nextPolicy));
    },
    [onChange, policy]
  );

  const handleRetryDelayChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const nextValue = parseInt(event.target.value, 10);
      const safe = Number.isFinite(nextValue) ? nextValue : 0;
      const nextPolicy: DeliveryPolicy = {
        ...policy,
        retry: {
          ...policy.retry,
          initial_delay_seconds: safe,
        },
      };
      onChange(nextPolicy, validatePolicy(nextPolicy));
    },
    [onChange, policy]
  );

  const handleBackoffStrategyChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      const value = event.target.value as DeliveryPolicy['retry']['backoff_strategy'];
      const nextPolicy: DeliveryPolicy = {
        ...policy,
        retry: {
          ...policy.retry,
          backoff_strategy: value,
        },
      };
      onChange(nextPolicy, validatePolicy(nextPolicy));
    },
    [onChange, policy]
  );

  const handleThrottleChange = useCallback(
    (field: 'max_per_minute' | 'max_per_hour' | 'max_per_day') =>
      (event: ChangeEvent<HTMLInputElement>) => {
        const nextValue = parseInt(event.target.value, 10);
        const safe = Number.isFinite(nextValue) ? nextValue : 0;
        const nextPolicy: DeliveryPolicy = {
          ...policy,
          throttling: {
            ...policy.throttling,
            [field]: safe,
          },
        };
        onChange(nextPolicy, validatePolicy(nextPolicy));
      },
    [onChange, policy]
  );

  const validation = validatePolicy(policy);

  const quietHoursSummary =
    policy.quiet_hours != null
      ? `${policy.quiet_hours.start_time}–${policy.quiet_hours.end_time} (${policy.quiet_hours.timezone})`
      : 'Not configured';

  return (
    <section
      className="space-y-4 rounded-2xl border border-[--cmp-communication-policy-editor-border] bg-[--cmp-surface] p-4"
      aria-label="Channel plan editor"
    >
      <header className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold text-[--sys-text-primary]">Channel plan</h3>
        <p className="text-xs text-[--sys-text-muted]">
          Controls retry behaviour, throttling limits, and quiet hours for{' '}
          {channelTypes.length > 0 ? channelTypes.join(', ') : 'configured channels'}.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <fieldset className="space-y-3" aria-label="Retry strategy">
          <legend className="text-xs font-semibold uppercase tracking-wide text-[--sys-text-muted]">
            Retry strategy
          </legend>
          <div className="space-y-1">
            <label className="block text-xs font-medium text-[--sys-text-primary]" htmlFor="retry-max-attempts">
              Max attempts
            </label>
            <input
              id="retry-max-attempts"
              type="number"
              min={0}
              max={10}
              value={policy.retry.max_attempts}
              onChange={handleRetryMaxChange}
              className="w-full rounded-md border border-[--cmp-communication-policy-editor-border] bg-[--cmp-surface] px-2 py-1 text-sm text-[--sys-text-primary]"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-medium text-[--sys-text-primary]" htmlFor="retry-backoff">
              Backoff strategy
            </label>
            <select
              id="retry-backoff"
              value={policy.retry.backoff_strategy}
              onChange={handleBackoffStrategyChange}
              className="w-full rounded-md border border-[--cmp-communication-policy-editor-border] bg-[--cmp-surface] px-2 py-1 text-sm text-[--sys-text-primary]"
            >
              <option value="exponential">Exponential</option>
              <option value="linear">Linear</option>
              <option value="none">None</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-medium text-[--sys-text-primary]" htmlFor="retry-initial-delay">
              Initial delay (seconds)
            </label>
            <input
              id="retry-initial-delay"
              type="number"
              min={0}
              max={3600}
              value={policy.retry.initial_delay_seconds}
              onChange={handleRetryDelayChange}
              className="w-full rounded-md border border-[--cmp-communication-policy-editor-border] bg-[--cmp-surface] px-2 py-1 text-sm text-[--sys-text-primary]"
            />
          </div>
        </fieldset>

        <fieldset className="space-y-3" aria-label="Throttling">
          <legend className="text-xs font-semibold uppercase tracking-wide text-[--sys-text-muted]">
            Throttling
          </legend>
          <div className="space-y-1">
            <label className="block text-xs font-medium text-[--sys-text-primary]" htmlFor="throttle-per-minute">
              Per minute
            </label>
            <input
              id="throttle-per-minute"
              type="number"
              min={0}
              max={1000}
              value={policy.throttling.max_per_minute}
              onChange={handleThrottleChange('max_per_minute')}
              className="w-full rounded-md border border-[--cmp-communication-policy-editor-border] bg-[--cmp-surface] px-2 py-1 text-sm text-[--sys-text-primary]"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-medium text-[--sys-text-primary]" htmlFor="throttle-per-hour">
              Per hour
            </label>
            <input
              id="throttle-per-hour"
              type="number"
              min={0}
              max={10000}
              value={policy.throttling.max_per_hour}
              onChange={handleThrottleChange('max_per_hour')}
              className="w-full rounded-md border border-[--cmp-communication-policy-editor-border] bg-[--cmp-surface] px-2 py-1 text-sm text-[--sys-text-primary]"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-medium text-[--sys-text-primary]" htmlFor="throttle-per-day">
              Per day
            </label>
            <input
              id="throttle-per-day"
              type="number"
              min={0}
              max={100000}
              value={policy.throttling.max_per_day}
              onChange={handleThrottleChange('max_per_day')}
              className="w-full rounded-md border border-[--cmp-communication-policy-editor-border] bg-[--cmp-surface] px-2 py-1 text-sm text-[--sys-text-primary]"
            />
          </div>
        </fieldset>
      </div>

      <fieldset className="space-y-2" aria-label="Quiet hours">
        <legend className="text-xs font-semibold uppercase tracking-wide text-[--sys-text-muted]">
          Quiet hours
        </legend>
        <p className="text-xs text-[--sys-text-muted]">{quietHoursSummary}</p>
      </fieldset>

      {validation.issues.length > 0 ? (
        <div
          role="alert"
          aria-label="Policy validation issues"
          className="rounded-md border border-[--sys-status-warning-fg] bg-[--cmp-surface] px-3 py-2 text-xs text-[--sys-text-primary]"
        >
          <p className="font-semibold">Policy has {validation.issues.length} issue(s):</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            {validation.issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function validatePolicy(policy: DeliveryPolicy): ChannelPlanValidationResult {
  const parsed = deliveryPolicySchema.safeParse(policy);
  if (parsed.success) {
    return {
      isValid: true,
      issues: [],
    };
  }
  const issues = parsed.error.issues.map((issue) => issue.message);
  return {
    isValid: false,
    issues,
  };
}

