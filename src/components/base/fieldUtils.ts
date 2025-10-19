import type { CSSProperties, ReactNode } from 'react';
import {
  getToneTokenSet,
  type StatusTone,
} from '../statusables/statusRegistry.js';

export type FieldDensity = 'comfortable' | 'compact';

export type ValidationState = 'info' | 'success' | 'error';

export interface FieldValidation {
  readonly state: ValidationState;
  readonly message?: ReactNode;
  readonly id?: string;
}

export interface FieldMetadata {
  readonly descriptionId?: string;
  readonly validationId?: string;
  readonly describedBy?: string;
  readonly ariaInvalid?: true;
  readonly dataValidationState?: ValidationState;
  readonly variables?: CSSProperties;
  readonly validationTone?: StatusTone;
}

interface ResolveFieldMetadataOptions {
  readonly hasDescription: boolean;
  readonly validation?: FieldValidation;
}

const VALIDATION_TONE_MAP: Record<ValidationState, StatusTone> = {
  info: 'info',
  success: 'success',
  error: 'critical',
};

function buildValidationVariables(tone: StatusTone): CSSProperties {
  const tokens = getToneTokenSet(tone);

  const variables = {
    '--form-field-border': tokens.border,
    '--form-field-border-active': tokens.border,
    '--form-field-background-active': tokens.background,
    '--form-field-validation-color': tokens.foreground,
    '--form-field-focus-inner': tokens.border,
    '--form-field-focus-outer': tokens.background,
    '--form-field-accent': tokens.foreground,
  } as CSSProperties;

  return variables;
}

export function resolveFieldMetadata(
  id: string,
  { hasDescription, validation }: ResolveFieldMetadataOptions
): FieldMetadata {
  const descriptionId = hasDescription ? `${id}-description` : undefined;
  const hasValidationMessage = Boolean(validation?.message);
  const validationTone = validation?.state
    ? VALIDATION_TONE_MAP[validation.state]
    : undefined;
  const validationId = hasValidationMessage
    ? validation?.id ?? `${id}-validation`
    : undefined;

  const describedBy = [descriptionId, validationId].filter(Boolean).join(' ') || undefined;

  const ariaInvalid = validation?.state === 'error' ? true : undefined;

  const variables =
    validationTone !== undefined ? buildValidationVariables(validationTone) : undefined;

  return {
    descriptionId,
    validationId,
    describedBy,
    ariaInvalid,
    dataValidationState: validation?.state,
    variables,
    validationTone,
  };
}
