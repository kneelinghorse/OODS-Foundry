#!/usr/bin/env node
/** Build the shipped registry items from reviewable TypeScript sources. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const version = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
const items = [
  ['button', 'Button', ['button'], 'Danger/destructive uses solid bg-destructive and text-background, including hover and dark, to preserve text contrast with the team’s tokens. Primary preserves the team’s primary/primary-foreground token pair. Success and warning intents use the secondary variant; shadcn has no distinct success/warning palettes.'],
  ['card', 'Card', ['card'], 'Semantic as containers wrap the shadcn Card.'],
  ['status-badge', 'StatusBadge', ['badge'], 'Status text and icons come from the OODS registry. Critical/danger uses destructive with solid bg-destructive and text-background in both themes; other tones use the team\'s default or secondary badge palette, without distinct status colours. compact and readOnly retain the OODS implementation\'s no-op behavior.'],
  ['tabs', 'Tabs', ['tabs'], 'The tab list scrolls horizontally. overflowLabel and the OODS overflow menu are not implemented.'],
  ['select', 'Select', ['select', 'label'], 'The visible control is a shadcn combobox, not a native select. A hidden native select preserves form values and native onChange events. Native option children, multiple, native size and native-select keyboard contracts are not supported; pass options.'],
  ['search-input', 'SearchInput', ['input', 'label', 'button'], 'Search value, debounce, minimum query length and clear events retain their meanings.'],
  ['pagination-bar', 'PaginationBar', ['pagination'], 'Page links use anchors, not buttons; disabled links prevent navigation and leave the tab order.'],
  ['banner', 'Banner', ['alert', 'button'], 'Critical/danger uses destructive with solid bg-destructive and text-background in both themes, with its description inheriting the foreground; other tones use the team\'s default Alert palette. Distinct success/warning/info colours and solid emphasis are not implemented.'],
  ['input', 'Input', ['input', 'label'], 'Native input props, datetime-local normalization, label, help, validation and value callbacks retain their meanings; density uses team spacing rather than OODS pixel dimensions.'],
  ['textarea', 'Textarea', ['textarea', 'label'], 'Native textarea props, four-row default, label, help, validation and value callbacks retain their meanings; density uses team spacing rather than OODS pixel dimensions.'],
  ['checkbox', 'Checkbox', ['checkbox', 'label'], 'The visible control is the team checkbox. A visually hidden native checkbox preserves the input ref, native onChange and form values. Native input event handlers other than onChange apply to that hidden input, not the visible control; density is metadata only.'],
  ['date-picker', 'DatePicker', ['input', 'label', 'calendar', 'popover', 'button'], 'Keeps the native date input and adds the team calendar/popover, including min, max, step, disabled and readOnly. pickerClassName/pickerStyle apply to the native input; density is metadata only.'],
  ['tag-input', 'TagInput', ['input-group', 'badge'], 'Preserves the OODS text-value callbacks and displayed tag list, including record labels and authored children. The OODS contract does not create or remove tags; this adapter does not add those behaviours.'],
  ['status-selector', 'StatusSelector', ['select'], 'Preserves status/value, normalized options/states, authored children, help and native change callbacks. The visible control uses shadcn combobox keyboard interaction rather than a native select.'],
  ['card-header', 'CardHeader', ['card'], 'Preserves the semantic header, heading level/as, title aliases, scalar/authored children and non-duplicated supporting copy. The team CardTitle and CardDescription supply the visual parts.'],
  ['price-badge', 'PriceBadge', ['badge'], 'Preserves amount and currency precedence, currency minor units, label/children/value fallback and emphasis. Binding metadata props field, amountField, currencyField, intervalField and minorUnitsParameter retain the OODS no-op behavior.'],
];
const generated = [];
for (const [name, component, registryDependencies, limit] of items) {
  const content = fs.readFileSync(path.join(root, 'scripts/runtime/shadcn', `oods-${name}.tsx`), 'utf8');
  const dependencies = [`@oods/components-react@${version}`, ...(content.includes("from '@oods/component-contracts'") ? [`@oods/component-contracts@${version}`] : [])];
  const item = { $schema: 'https://ui.shadcn.com/schema/registry-item.json', name: `oods-${name}`, type: 'registry:component',
    title: `OODS Foundry ${component}`, description: `React adapter for OODS ${component} on shadcn/ui's Radix and Base UI bases. ${limit}`,
    dependencies, registryDependencies, files: [{ path: `components/oods/${name}.tsx`, target: `components/oods/${name}.tsx`, type: 'registry:component', content }] };
  generated.push([`oods-${name}.json`, item]);
}
generated.push(['mappings.json', { mappings: items.map(([name, component]) => ({ externalSystem: 'shadcn', externalComponent: `Oods${component}`, oodsTraits: ['Stateful'], substitution: { component, react: { shadcn: { project: '<shadcn-project>', module: `@/components/oods/${name}` }, export: `Oods${component}` } } })) }]);
let stale = false;
for (const [name, value] of generated) {
  const destination = path.join(root, 'packages/foundry/shadcn', name), text = JSON.stringify(value, null, 2) + '\n';
  if (process.argv.includes('--check')) { if (!fs.existsSync(destination) || fs.readFileSync(destination, 'utf8') !== text) { console.error(`Stale shadcn item: ${name}`); stale = true; } }
  else { fs.mkdirSync(path.dirname(destination), { recursive: true }); fs.writeFileSync(destination, text); }
}
if (stale) process.exitCode = 1;
