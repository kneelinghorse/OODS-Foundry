import { z } from 'zod';

/**
 * Deliverability verdict emitted by validation providers.
 * Mirrors Google Address Validation concepts but remains provider-neutral.
 */
export const VALIDATION_DELIVERABILITY_VALUES = [
  'unknown',
  'deliverable',
  'deliverable_missing_unit',
  'deliverable_incorrect_unit',
  'partial',
  'undeliverable',
] as const;

export type ValidationDeliverability = (typeof VALIDATION_DELIVERABILITY_VALUES)[number];

export const VALIDATION_GRANULARITY_VALUES = [
  'unspecified',
  'subpremise',
  'premise',
  'route',
  'locality',
  'administrative_area',
  'country',
] as const;

export type ValidationGranularity = (typeof VALIDATION_GRANULARITY_VALUES)[number];

export const COMPONENT_CONFIRMATION_STATUSES = ['confirmed', 'unconfirmed', 'inferred', 'missing'] as const;

export type ComponentConfirmationStatus = (typeof COMPONENT_CONFIRMATION_STATUSES)[number];

const ComponentValueSchema = z.union([
  z.string().min(1),
  z.array(z.string().min(1)).min(1),
]);

export const ValidationComponentStatusSchema = z
  .object({
    component: z.string().min(1),
    status: z.enum(COMPONENT_CONFIRMATION_STATUSES),
    inputValue: ComponentValueSchema.optional(),
    correctedValue: ComponentValueSchema.optional(),
    messages: z.array(z.string().min(1)).default([]),
  })
  .strict();

export type ValidationComponentStatus = z.infer<typeof ValidationComponentStatusSchema>;

export const ValidationVerdictSchema = z
  .object({
    provider: z.string().min(2).max(64),
    deliverability: z.enum(VALIDATION_DELIVERABILITY_VALUES).default('unknown'),
    granularity: z.enum(VALIDATION_GRANULARITY_VALUES).default('unspecified'),
    addressComplete: z.boolean().default(false),
    hasInferredComponents: z.boolean().default(false),
    hasUnconfirmedComponents: z.boolean().default(false),
    missingComponents: z.array(z.string().min(1)).default([]),
    unconfirmedComponents: z.array(z.string().min(1)).default([]),
    inferredComponents: z.array(z.string().min(1)).default([]),
    componentStatuses: z.array(ValidationComponentStatusSchema).default([]),
    metadata: z.unknown().optional(),
  })
  .strict();

export type ValidationVerdict = z.infer<typeof ValidationVerdictSchema>;
