import { useCallback, useMemo } from 'react';
import type { JSX } from 'react';
import type { FormProps, IChangeEvent } from '@rjsf/core';
import * as FormCore from '@rjsf/core';
import type { FormContextType, RJSFSchema, UiSchema } from '@rjsf/utils';
import validatorAjv8 from '@rjsf/validator-ajv8';

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
  readonly onChange?: (event: IChangeEvent<TData>, id?: string) => void;
  readonly onDocumentChange?: (payload: PreferenceDocumentChange<TData>) => void;
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
    formData,
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

  const handleChange = useCallback(
    (event: IChangeEvent<TData>, id?: string) => {
      onDocumentChange?.({
        document: event.formData as TData,
        version: schemaDefinition.version,
      });
      onChange?.(event, id);
    },
    [onChange, onDocumentChange, schemaDefinition.version]
  );

  const themedProps: FormProps<PreferenceDocument, RJSFSchema, DefaultContext> = {
    ...(rest as FormProps<PreferenceDocument, RJSFSchema, DefaultContext>),
    formData: (formData ?? resolvedDocument) as PreferenceDocument,
    schema,
    uiSchema: uiSchema as UiSchema<PreferenceDocument, RJSFSchema, DefaultContext>,
    validator: (validator ?? DEFAULT_VALIDATOR) as FormProps<
      PreferenceDocument,
      RJSFSchema,
      DefaultContext
    >['validator'],
    onChange: handleChange as FormProps<PreferenceDocument, RJSFSchema, DefaultContext>['onChange'],
  };

  return <ThemedForm {...themedProps} />;
}
