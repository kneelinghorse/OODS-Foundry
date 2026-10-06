import * as React from 'react';
import { DEFAULT_COLOR_STATES, formatReadOnlyValue, geoFieldMapping, recipeItemLabels, traitEventRows, type GeoFieldMappingValue, type TraitEventKind, type TraitEventValues } from '@oods/component-contracts';
import { Checkbox, Input, Select } from './fields.js';
import { ColorSwatch } from './breadth.js';

export interface TraitEventProps extends TraitEventValues { id?: string; title?: string }
function eventRecipe(id: string, kind: TraitEventKind, title: string) {
  return function TraitEvent({ id: elementId, title: heading = title, ...values }: TraitEventProps) {
    const rows = traitEventRows(kind, values);
    // s223-m01 (#2527 ruling 7): an event that never happened is not content, so a card with no events renders nothing.
    if (!rows.length) return null;
    return <article id={elementId} className="oods-trait-recipe" data-oods-component={id} aria-label={heading}>
      <h2>{heading}</h2><ol>{rows.map((row, index) => <li key={index}><strong>{row.title}</strong><p>{row.at ? <time dateTime={row.at}>{row.time}</time> : row.time}</p>{row.actor && <p>Actor: {row.actor}</p>}{row.reason && <p>Reason: {row.reason}</p>}{row.code && <p>Code: {row.code}</p>}</li>)}</ol>
    </article>;
  };
}
export const ArchiveEvent = eventRecipe('ArchiveEvent', 'archive', 'Archive events');
export const CancellationEvent = eventRecipe('CancellationEvent', 'cancellation', 'Cancellation event');
export const StateTransitionEvent = eventRecipe('StateTransitionEvent', 'transition', 'State transitions');

export interface CommunicationDetailPanelProps { id?: string; title?: string; channels?: readonly unknown[]; templates?: readonly unknown[]; policies?: readonly unknown[]; conversations?: readonly unknown[] }
export function CommunicationDetailPanel({ id, title = 'Communication', channels = [], templates = [], policies = [], conversations = [] }: CommunicationDetailPanelProps) {
  return <section id={id} className="oods-trait-recipe" data-oods-component="CommunicationDetailPanel" aria-label={title}><h2>{title}</h2><div role="status" aria-live="polite">{conversations.length} conversations</div><dl>{([['Channels', channels], ['Templates', templates], ['Delivery policies', policies], ['Conversations', conversations]] as const).map(([label, rows]) => <div key={label}><dt>{label}</dt><dd>{rows.length ? <ul>{recipeItemLabels(rows).map((text, index) => <li key={index}>{text}</li>)}</ul> : 'None recorded'}</dd></div>)}</dl></section>;
}

export interface ColorStatePickerProps { id?: string; title?: string; colorStates?: readonly string[]; value?: string; disabled?: boolean; onChange?: (value: string) => void }
export function ColorStatePicker({ id, title = 'Color state', colorStates = DEFAULT_COLOR_STATES, value, disabled, onChange }: ColorStatePickerProps) {
  const generatedId = React.useId(); const [selected, setSelected] = React.useState(value ?? colorStates[0] ?? '');
  React.useEffect(() => setSelected(value ?? colorStates[0] ?? ''), [value, colorStates]);
  return <fieldset id={id} className="oods-trait-recipe" data-oods-component="ColorStatePicker"><legend>{title}</legend><Select id={`${id ?? generatedId}-state`} label="Color state" name="color_state" value={selected} disabled={disabled} options={[...(!colorStates.includes(selected) ? [{ value: selected, label: selected || 'Choose state', disabled: true }] : []), ...colorStates.map(value => ({ value, label: formatReadOnlyValue(value, 'string', true) }))]} onValueChange={next => { setSelected(next); onChange?.(next); }} /></fieldset>;
}
export interface StatusColorLegendProps { id?: string; title?: string; colorStates?: readonly string[]; value?: string; showTokenReferences?: boolean }
export function StatusColorLegend({ id, title = 'Status colors', colorStates = DEFAULT_COLOR_STATES, value, showTokenReferences = false }: StatusColorLegendProps) {
  return <section id={id} className="oods-trait-recipe" data-oods-component="StatusColorLegend" aria-label={title}><h2>{title}</h2><dl>{colorStates.map(state => <div key={state}><dt><ColorSwatch label={state} color={`var(--sys-status-${state}-surface)`} />{state === value && ' (current)'}</dt><dd>{showTokenReferences ? `--sys-status-${state}-surface` : state}</dd></div>)}</dl></section>;
}

export interface GeoFieldMappingFormProps extends Partial<GeoFieldMappingValue> { id?: string; title?: string; embedded?: boolean; disabled?: boolean; onChange?: (value: GeoFieldMappingValue) => void }
export function GeoFieldMappingForm({ id, title = 'Geographic fields', embedded = false, disabled, onChange, ...values }: GeoFieldMappingFormProps) {
  const generatedId = React.useId(); const [value, setValue] = React.useState(() => geoFieldMapping(values));
  React.useEffect(() => setValue(geoFieldMapping(values)), [values.latitude, values.longitude, values.identifier, values.autoDetect]);
  const update = (patch: Partial<GeoFieldMappingValue>) => { const next = { ...value, ...patch }; setValue(next); onChange?.(next); };
  const Tag = embedded ? 'fieldset' : 'form';
  return <Tag id={id} className="oods-trait-recipe" data-oods-component="GeoFieldMappingForm" aria-label={title} onSubmit={event => event.preventDefault()}>{embedded ? <legend>{title}</legend> : <h2>{title}</h2>}{(['latitude', 'longitude', 'identifier'] as const).map(field => <Input key={field} id={`${id ?? generatedId}-${field}`} name={`geo_${field}_field`} label={`${field[0].toUpperCase()}${field.slice(1)} field`} value={value[field]} disabled={disabled} onValueChange={next => update({ [field]: next })} />)}<Checkbox id={`${id ?? generatedId}-auto`} name="geo_auto_detect_enabled" label="Auto detect fields" checked={value.autoDetect} disabled={disabled} onCheckedChange={autoDetect => update({ autoDetect })} /></Tag>;
}
export interface GeoResolutionBadgeProps { id?: string; resolution?: string }
export function GeoResolutionBadge({ id, resolution }: GeoResolutionBadgeProps) {
  return <span id={id} className="oods-geo-resolution" data-oods-component="GeoResolutionBadge">Resolution: {resolution || 'Not determined'}</span>;
}
export interface GeocodablePreviewProps extends GeoResolutionBadgeProps { title?: string; requiresLookup?: boolean; detectedFields?: readonly unknown[] }
export function GeocodablePreview({ id, title = 'Geographic data', resolution, requiresLookup, detectedFields = [] }: GeocodablePreviewProps) {
  return <section id={id} className="oods-trait-recipe" data-oods-component="GeocodablePreview" aria-label={title}><h2>{title}</h2><dl><dt>Resolution</dt><dd>{resolution || 'Not determined'}</dd><dt>Requires lookup</dt><dd>{requiresLookup === undefined ? 'Not determined' : requiresLookup ? 'Yes' : 'No'}</dd><dt>Detected fields</dt><dd>{recipeItemLabels(detectedFields).join(', ') || 'None detected'}</dd></dl></section>;
}
