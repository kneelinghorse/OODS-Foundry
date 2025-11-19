import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormContextType, RJSFSchema, UiSchema } from '@rjsf/utils';
import validatorAjv8 from '@rjsf/validator-ajv8';

import type { PreferenceDocument } from '@/schemas/preferences/preference-document.js';
import {
  resolvePreferenceSchema,
  type PreferenceSchemaDefinition,
} from '@/traits/preferenceable/schema-registry.js';

import type {
  PreferenceDocumentChange,
  PreferenceFormProps,
  PreferenceFormValidationIssue,
  PreferenceFormValidationState,
} from '@/components/preferences/PreferenceForm.js';
import {
  buildPreferencePreviewSections,
  type PreferencePreviewSection,
} from '@/components/preferences/PreferencePreview.js';

export interface UsePreferenceFormOptions<TData extends PreferenceDocument = PreferenceDocument> {
  readonly version?: string;
  readonly initialDocument?: TData;
  readonly schema?: RJSFSchema;
  readonly uiSchema?: UiSchema<TData, RJSFSchema, FormContextType>;
  readonly validator?: PreferenceFormProps<TData>['validator'];
  readonly onChange?: (payload: PreferenceDocumentChange<TData>) => void;
}

export interface UsePreferenceFormResult<TData extends PreferenceDocument = PreferenceDocument> {
  readonly schema: PreferenceSchemaDefinition;
  readonly document: TData;
  readonly isDirty: boolean;
  readonly resetToDefaults: () => void;
  readonly resetToInitial: () => void;
  readonly validationIssues: readonly PreferenceFormValidationIssue[];
  readonly previewSections: readonly PreferencePreviewSection[];
  readonly formProps: PreferenceFormProps<TData>;
}

export function usePreferenceForm<TData extends PreferenceDocument = PreferenceDocument>(
  options: UsePreferenceFormOptions<TData> = {}
): UsePreferenceFormResult<TData> {
  const {
    version,
    initialDocument,
    schema: schemaOverride,
    uiSchema: uiSchemaOverride,
    validator: validatorOverride,
    onChange,
  } = options;

  const schemaDefinition = useMemo(() => resolvePreferenceSchema(version), [version]);

  const canonicalInitial = useMemo(
    () => structuredClone((initialDocument ?? schemaDefinition.metadata.example) as TData),
    [initialDocument, schemaDefinition]
  );

  const [document, setDocument] = useState<TData>(canonicalInitial);
  const [validationIssues, setValidationIssues] = useState<PreferenceFormValidationIssue[]>([]);

  useEffect(() => {
    setDocument(structuredClone(canonicalInitial));
    setValidationIssues([]);
  }, [canonicalInitial]);

  const previewSections = useMemo(
    () => buildPreferencePreviewSections(document),
    [document]
  );

  const initialSnapshot = useMemo(() => stableStringify(canonicalInitial), [canonicalInitial]);
  const currentSnapshot = useMemo(() => stableStringify(document), [document]);
  const isDirty = currentSnapshot !== initialSnapshot;

  const handleDocumentChange = useCallback(
    (payload: PreferenceDocumentChange<TData>) => {
      const cloned = structuredClone(payload.document);
      setDocument(cloned);
      onChange?.({
        document: cloned,
        version: payload.version,
      });
    },
    [onChange]
  );

  const handleValidationState = useCallback(
    (state: PreferenceFormValidationState<TData>) => {
      setValidationIssues([...state.issues]);
    },
    []
  );

  const resetToDefaults = useCallback(() => {
    const defaults = structuredClone(schemaDefinition.metadata.example) as TData;
    setDocument(defaults);
    setValidationIssues([]);
    onChange?.({
      document: defaults,
      version: schemaDefinition.version,
    });
  }, [onChange, schemaDefinition]);

  const resetToInitial = useCallback(() => {
    const initial = structuredClone(canonicalInitial);
    setDocument(initial);
    setValidationIssues([]);
    onChange?.({
      document: initial,
      version: schemaDefinition.version,
    });
  }, [canonicalInitial, onChange, schemaDefinition]);

  const resolvedValidator = (validatorOverride ?? validatorAjv8) as PreferenceFormProps<TData>['validator'];

  const formProps: PreferenceFormProps<TData> = useMemo(
    () => ({
      version: schemaDefinition.version,
      document,
      formData: document,
      schema: schemaOverride,
      uiSchema: uiSchemaOverride,
      validator: resolvedValidator,
      liveValidate: true,
      showErrorList: false,
      noHtml5Validate: true,
      focusOnFirstError: false,
      onDocumentChange: handleDocumentChange,
      onValidationChange: handleValidationState,
    }),
    [
      document,
      handleDocumentChange,
      handleValidationState,
      schemaOverride,
      uiSchemaOverride,
      resolvedValidator,
      schemaDefinition.version,
    ]
  );

  return {
    schema: schemaDefinition,
    document,
    isDirty,
    resetToDefaults,
    resetToInitial,
    validationIssues,
    previewSections,
    formProps,
  };
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(',')}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
    a.localeCompare(b)
  );
  return `{${entries
    .map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`)
    .join(',')}}`;
}
