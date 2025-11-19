import { useCallback } from 'react';
import type { JSX } from 'react';

import type { NotificationChannelConfig } from '@/traits/preferenceable/notification/notification-matrix.js';

type ChannelToggleState = 'enabled' | 'disabled';

export interface ChannelToggleProps {
  readonly channel: NotificationChannelConfig;
  readonly eventLabel: string;
  readonly enabled: boolean;
  readonly onToggle?: (next: boolean) => void;
  readonly disabled?: boolean;
  readonly readOnly?: boolean;
  readonly className?: string;
}

const BASE_CLASSES =
  'channel-toggle inline-flex w-full items-center justify-center rounded-xl border px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[--sys-focus-ring]';
const ENABLED_CLASSES =
  'border-[--cmp-border-strong] bg-[--cmp-surface-accent] text-[--cmp-text-body] shadow-sm';
const DISABLED_CLASSES =
  'border-[--cmp-border-subtle] bg-[--cmp-surface-canvas] text-[--sys-text-muted]';
const DISABLED_STATE_CLASSES = 'opacity-60 cursor-not-allowed';

export function ChannelToggle({
  channel,
  eventLabel,
  enabled,
  onToggle,
  disabled,
  readOnly,
  className,
}: ChannelToggleProps): JSX.Element {
  const handleClick = useCallback(() => {
    if (disabled || readOnly) {
      return;
    }
    onToggle?.(!enabled);
  }, [disabled, readOnly, enabled, onToggle]);

  const state: ChannelToggleState = enabled ? 'enabled' : 'disabled';
  const classes = [
    BASE_CLASSES,
    state === 'enabled' ? ENABLED_CLASSES : DISABLED_CLASSES,
    disabled || readOnly ? DISABLED_STATE_CLASSES : null,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const ariaLabel = `${enabled ? 'Disable' : 'Enable'} ${channel.label} notifications for ${eventLabel}`;

  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label={ariaLabel}
      aria-disabled={disabled || readOnly ? 'true' : undefined}
      className={classes}
      title={`${channel.label} channel`}
      data-channel-id={channel.id}
      data-state={state}
      onClick={handleClick}
      disabled={disabled}
    >
      <span className="truncate" aria-hidden="true">
        {channel.label}
      </span>
    </button>
  );
}
