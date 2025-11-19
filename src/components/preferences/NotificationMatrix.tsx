import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import type { JSX } from 'react';

import {
  applyChannelPreference,
  createNotificationMatrix,
  DEFAULT_NOTIFICATION_CHANNELS,
  DEFAULT_NOTIFICATION_EVENTS,
  normalizeNotificationMatrix,
  setAllChannels,
  setChannelForAllEvents,
  type NotificationChannelConfig,
  type NotificationEventDefinition,
  type NotificationPreferenceMatrix,
} from '@/traits/preferenceable/notification/notification-matrix.js';
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
} from '@/components/base/Table.js';

import { ChannelToggle } from './ChannelToggle.js';

export interface NotificationMatrixProps {
  readonly channels?: readonly NotificationChannelConfig[];
  readonly events?: readonly NotificationEventDefinition[];
  readonly value?: NotificationPreferenceMatrix;
  readonly defaultValue?: NotificationPreferenceMatrix;
  readonly onChange?: (matrix: NotificationPreferenceMatrix) => void;
  readonly readOnly?: boolean;
  readonly showBulkControls?: boolean;
  readonly className?: string;
}

export function NotificationMatrix({
  channels = DEFAULT_NOTIFICATION_CHANNELS,
  events = DEFAULT_NOTIFICATION_EVENTS,
  value,
  defaultValue,
  onChange,
  readOnly = false,
  showBulkControls = true,
  className,
}: NotificationMatrixProps): JSX.Element {
  const matrixId = useId();
  const [matrixState, setMatrixState] = useState<NotificationPreferenceMatrix>(() =>
    createNotificationMatrix({ seed: value ?? defaultValue, events, channels })
  );

  useEffect(() => {
    if (value) {
      setMatrixState(normalizeNotificationMatrix(value, { events, channels }));
      return;
    }
    setMatrixState((current) => normalizeNotificationMatrix(current, { events, channels }));
  }, [value, events, channels]);

  const matrix = value
    ? normalizeNotificationMatrix(value, { events, channels })
    : matrixState;

  const updateMatrix = useCallback(
    (updater: (current: NotificationPreferenceMatrix) => NotificationPreferenceMatrix) => {
      const next = updater(matrix);
      if (!value) {
        setMatrixState(next);
      }
      onChange?.(next);
    },
    [matrix, onChange, value]
  );

  const handleToggle = useCallback(
    (eventId: string, channelId: string, enabled: boolean) => {
      updateMatrix((current) => applyChannelPreference(current, eventId, channelId, enabled));
    },
    [updateMatrix]
  );

  const handleEnableAll = useCallback(() => {
    updateMatrix((current) => setAllChannels(current, true));
  }, [updateMatrix]);

  const handleDisableAll = useCallback(() => {
    updateMatrix((current) => setAllChannels(current, false));
  }, [updateMatrix]);

  const handleChannelToggleAll = useCallback(
    (channelId: string) => {
      const allEnabled = events.every((event) => Boolean(matrix[event.id]?.[channelId]));
      updateMatrix((current) => setChannelForAllEvents(current, channelId, !allEnabled));
    },
    [events, matrix, updateMatrix]
  );

  const renderBulkControls = showBulkControls ? (
    <div className="flex flex-wrap gap-2" aria-label="Bulk controls">
      <button
        type="button"
        className="rounded-lg border border-[--cmp-border-subtle] bg-[--cmp-surface-canvas] px-3 py-2 text-sm font-medium text-[--sys-text-primary] transition-colors hover:border-[--cmp-border-strong] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[--sys-focus-ring] disabled:opacity-60"
        onClick={handleEnableAll}
        disabled={readOnly}
      >
        Enable all
      </button>
      <button
        type="button"
        className="rounded-lg border border-[--cmp-border-subtle] bg-[--cmp-surface-canvas] px-3 py-2 text-sm font-medium text-[--sys-text-primary] transition-colors hover:border-[--cmp-border-strong] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[--sys-focus-ring] disabled:opacity-60"
        onClick={handleDisableAll}
        disabled={readOnly}
      >
        Disable all
      </button>
    </div>
  ) : null;

  const containerClassName = ['notification-matrix space-y-4', className]
    .filter(Boolean)
    .join(' ');

  const memoizedRows = useMemo(
    () =>
      events.map((event) => ({
        definition: event,
        row: matrix[event.id] ?? {},
      })),
    [events, matrix]
  );

  return (
    <section className={containerClassName} aria-labelledby={`${matrixId}-title`}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p id={`${matrixId}-title`} className="text-base font-semibold text-[--sys-text-primary]">
            Notification preferences
          </p>
          <p className="text-sm text-[--sys-text-muted]">
            Enable or disable notification channels per event type. Updates apply immediately.
          </p>
        </div>
        {renderBulkControls}
      </header>
      <Table containerClassName="rounded-2xl border border-[--cmp-border-subtle] bg-[--cmp-surface-subtle] p-2 shadow-[0_1px_6px_rgba(15,23,42,0.08)]">
        <TableHeader>
          <TableRow>
            <TableHeaderCell scope="col" className="text-left text-xs font-semibold uppercase tracking-wide text-[--sys-text-muted]">
              Event type
            </TableHeaderCell>
            {channels.map((channel) => {
              const allEnabled = events.every((event) => Boolean(matrix[event.id]?.[channel.id]));
              return (
                <TableHeaderCell key={channel.id} scope="col" className="text-center">
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-xs font-semibold uppercase tracking-wide text-[--sys-text-muted]">
                      {channel.label}
                    </span>
                    <button
                      type="button"
                      className="rounded-full border border-[--cmp-border-subtle] bg-[--cmp-surface-canvas] px-2 py-1 text-[0.65rem] font-semibold uppercase tracking-wide text-[--sys-text-muted] transition-colors hover:border-[--cmp-border-strong] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[--sys-focus-ring] disabled:opacity-60"
                      onClick={() => handleChannelToggleAll(channel.id)}
                      disabled={readOnly}
                      aria-label={`${allEnabled ? 'Disable' : 'Enable'} ${channel.label} for all events`}
                    >
                      {allEnabled ? 'Disable' : 'Enable'}
                    </button>
                  </div>
                </TableHeaderCell>
              );
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          {memoizedRows.map(({ definition, row }) => (
            <TableRow key={definition.id}>
              <TableHeaderCell
                scope="row"
                className="align-top text-left"
              >
                <div>
                  <p className="text-sm font-semibold text-[--sys-text-primary]">{definition.label}</p>
                  {definition.description ? (
                    <p className="text-xs text-[--sys-text-muted]">{definition.description}</p>
                  ) : null}
                </div>
              </TableHeaderCell>
              {channels.map((channel) => (
                <TableCell key={`${definition.id}-${channel.id}`} className="text-center">
                  <ChannelToggle
                    channel={channel}
                    eventLabel={definition.label}
                    enabled={Boolean(row?.[channel.id])}
                    onToggle={(next) => handleToggle(definition.id, channel.id, next)}
                    readOnly={readOnly}
                    disabled={readOnly}
                  />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  );
}
