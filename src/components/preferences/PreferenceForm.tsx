import { useCallback, useMemo } from 'react';
import type { JSX } from 'react';
import type { FormProps, IChangeEvent } from '@rjsf/core';
import { withTheme } from '@rjsf/core';
import type { RJSFSchema, UiSchema } from '@rjsf/utils';
import validatorAjv8 from '@rjsf/validator-ajv8';

import type { PreferenceDocument } from '@/schemas/preferences/preference-document.js';
import { resolvePreferenceSchema } from '@/traits/preferenceable/schema-registry.js';

import { oodsRjsfTheme } from './oods-rjsf-theme.js';

const ThemedForm = withTheme(oodsRjsfTheme);
const DEFAULT_VALIDATOR = validatorAjv8;

export interface PreferenceDocumentChange<TData> {
  readonly document: TData;
  readonly version: string;
}

type BaseFormProps = Omit<FormProps<any, RJSFSchema, any>, 'schema' | 'uiSchema' | 'formData' | 'onChange'>;

export interface PreferenceFormProps<TData = PreferenceDocument> extends BaseFormProps {
  readonly version?: string;
  readonly schema?: RJSFSchema;
  readonly uiSchema?: UiSchema<any, RJSFSchema, any>;
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
      (structuredClone(schemaDefinition.uiSchema) as UiSchema<any, RJSFSchema, any>),
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

  return (
    <ThemedForm
      {...rest}
      formData={formData ?? resolvedDocument}
      schema={schema}
      uiSchema={uiSchema}
      validator={validator ?? DEFAULT_VALIDATOR}
      onChange={handleChange}
    />
  );
}
