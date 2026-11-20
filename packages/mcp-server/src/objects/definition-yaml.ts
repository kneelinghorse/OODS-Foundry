import yaml, { type LoadOptions, type Type } from 'js-yaml';

// js-yaml exports its timestamp type at runtime; its declarations omit the types table.
const { timestamp } = (yaml as typeof yaml & { types: { timestamp: Type } }).types;
const definitionSchema = yaml.DEFAULT_SCHEMA.extend({
  implicit: [new yaml.Type('tag:yaml.org,2002:timestamp', {
    kind: 'scalar',
    resolve: timestamp.resolve,
    construct: (text: string) => text,
  })],
});

/** Preserve a definition's date spelling, fractional seconds and offset. All other default YAML types still apply. */
export function loadDefinitionYaml(content: string, options?: LoadOptions): unknown {
  return yaml.load(content, { ...options, schema: definitionSchema });
}
