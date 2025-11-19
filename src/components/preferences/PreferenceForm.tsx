import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { JSX } from 'react';
import type { FormProps, IChangeEvent } from '@rjsf/core';
import * as FormCore from '@rjsf/core';
import type { FormContextType, RJSFSchema, UiSchema } from '@rjsf/utils';
import validatorAjv8 from '@rjsf/validator-ajv8';

import { getContextDataAttr, useContextMetadata, useViewContext } from '@/ViewContextProvider.jsx';
import type { FieldDensity } from '@/components/base/fieldUtils.js';
import type { PreferenceDocument } from '@/schemas/preferences/preference-document.js';
import { resolvePreferenceSchema } from '@/traits/preferenceable/schema-registry.js';

import { oodsRjsfTheme } from './oods-rjsf-theme.js';

const resolveWithTheme = (): typeof import('@rjsf/core')['withTheme'] => {
  const candidate = (FormCore.default && 'withTheme' in FormCore.default)
    ? FormCore.default
    : FormCore;
  const fn = (candidate as typeof import('@rjsf/core')).withTheme;
  if (typeof fn !== 'function') {
    throw new Error('withTheme is not available on @rjsf/core.');
  }
  return fn;
};

const ThemedForm = resolveWithTheme()<PreferenceDocument, RJSFSchema, DefaultContext>(oodsRjsfTheme);
const DEFAULT_VALIDATOR = validatorAjv8;

export interface PreferenceDocumentChange<TData> {
  readonly document: TData;
  readonly version: string;
}

export interface PreferenceFormValidationIssue {
  readonly message: string;
  readonly path: string;
}

export interface PreferenceFormValidationState<TData extends PreferenceDocument> {
  readonly document: TData;
  readonly version: string;
  readonly issues: readonly PreferenceFormValidationIssue[];
  readonly rawEvent: IChangeEvent<TData>;
}

type DefaultContext = FormContextType;
type BaseFormProps<TData extends PreferenceDocument> = Omit<
  FormProps<TData, RJSFSchema, DefaultContext>,
  'schema' | 'uiSchema' | 'formData' | 'onChange'
>;

export interface PreferenceFormProps<TData extends PreferenceDocument = PreferenceDocument>
  extends BaseFormProps<TData> {
  readonly version?: string;
  readonly schema?: RJSFSchema;
  readonly uiSchema?: UiSchema<TData, RJSFSchema, DefaultContext>;
  readonly document?: TData;
  readonly formData?: TData;
  readonly density?: FieldDensity;
  readonly onChange?: (event: IChangeEvent<TData>, id?: string) => void;
  readonly onDocumentChange?: (payload: PreferenceDocumentChange<TData>) => void;
  readonly onValidationChange?: (state: PreferenceFormValidationState<TData>) => void;
}

/**
 * PreferenceForm renders a schema-driven JSON Schema form (react-jsonschema-form)
 * backed by the Preferenceable registry definitions. Consumers can override the
 * schema/uiSchema while still benefiting from the registry defaults.
 */
export function PreferenceForm<TData extends PreferenceDocument = PreferenceDocument>(
  props: PreferenceFormProps<TData>
): JSX.Element {
  const {
    version,
    schema: schemaOverride,
    uiSchema: uiSchemaOverride,
    document,
    onDocumentChange,
    validator,
    onChange,
    onValidationChange,
    formData,
    density,
    liveValidate = true,
    showErrorList = false,
    noHtml5Validate = true,
    focusOnFirstError = false,
    className,
    formContext,
    id,
    ...rest
  } = props;

  const schemaDefinition = useMemo(() => resolvePreferenceSchema(version), [version]);
  const schema = useMemo(
    () => schemaOverride ?? (structuredClone(schemaDefinition.schema) as RJSFSchema),
    [schemaOverride, schemaDefinition]
  );
  const uiSchema = useMemo(
    () =>
      uiSchemaOverride ??
      (structuredClone(
        schemaDefinition.uiSchema
      ) as UiSchema<TData, RJSFSchema, DefaultContext>),
    [uiSchemaOverride, schemaDefinition]
  );
  const resolvedDocument = useMemo(
    () => structuredClone((document ?? schemaDefinition.metadata.example) as TData),
    [document, schemaDefinition]
  );
  const effectiveFormData = useMemo(
    () => (formData ?? resolvedDocument) as PreferenceDocument,
    [formData, resolvedDocument]
  );

  const viewContext = useViewContext();
  const contextMetadata = useContextMetadata();
  const resolvedContext = contextMetadata ? viewContext : 'form';
  const contextDensity: FieldDensity = density ?? (contextMetadata?.density === 'compact' ? 'compact' : 'comfortable');
  const dataContextAttr = getContextDataAttr(resolvedContext);
  const autoIdRef = useRef<string | undefined>(undefined);
  if (!autoIdRef.current) {
    autoIdRef.current = `preference-form-${Math.random().toString(36).slice(2)}`;
  }
  const formId = id ?? autoIdRef.current;

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const formNode = window.document.getElementById(formId);
    if (formNode) {
      formNode.setAttribute('data-context', dataContextAttr);
    }
  }, [formId, dataContextAttr]);

  const handleChange = useCallback(
    (event: IChangeEvent<TData>, id?: string) => {
      onDocumentChange?.({
        document: event.formData as TData,
        version: schemaDefinition.version,
      });
      onChange?.(event, id);
      if (onValidationChange) {
        onValidationChange({
          document: event.formData as TData,
          version: schemaDefinition.version,
          issues: extractIssues(event),
          rawEvent: event,
        });
      }
    },
    [onChange, onDocumentChange, onValidationChange, schemaDefinition.version]
  );

  const themedProps: FormProps<PreferenceDocument, RJSFSchema, DefaultContext> = {
    ...(rest as FormProps<PreferenceDocument, RJSFSchema, DefaultContext>),
    id: formId,
    className: ['preference-form', className].filter(Boolean).join(' ') || undefined,
    formData: effectiveFormData,
    schema,
    uiSchema: uiSchema as UiSchema<PreferenceDocument, RJSFSchema, DefaultContext>,
    validator: (validator ?? DEFAULT_VALIDATOR) as FormProps<
      PreferenceDocument,
      RJSFSchema,
      DefaultContext
    >['validator'],
    onChange: handleChange as FormProps<PreferenceDocument, RJSFSchema, DefaultContext>['onChange'],
    formContext: {
      ...(formContext as DefaultContext),
      density: contextDensity,
      viewContext: resolvedContext,
      metadata: contextMetadata ?? null,
    } satisfies DefaultContext,
    liveValidate,
    showErrorList,
    noHtml5Validate,
    focusOnFirstError,
  };

  return <ThemedForm {...themedProps} />;
}

function extractIssues<TData extends PreferenceDocument>(event: IChangeEvent<TData>): PreferenceFormValidationIssue[] {
  if (!event.errors || event.errors.length === 0) {
    return [];
  }
  return event.errors.map((error) => ({
    message: error.stack ?? error.message ?? 'Validation error',
    path: error.property ?? '/',
  }));
}
