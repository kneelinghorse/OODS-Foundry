# International Address Formatting (UPU S42)

Sprint 25 introduces the international formatting engine for the Addressable trait. The engine transforms canonical `Address` value objects into locale-aware postal strings using the UPU S42 component + template model. This document captures the structure, APIs, and guardrails for the formatter, component extractor, and accompanying data assets.

## Template Data + Parser

- **Source of truth:** `data/upu-s42-templates.json`
- **Parser/registry:** `src/traits/addressable/template-parser.ts`, `src/traits/addressable/format-templates.ts`

Each entry supplies:

```json
{
  "key": "US",
  "countryCode": "US",
  "description": "United States (USPS)",
  "aliases": ["USA", "US-PR"],
  "template": "{{organizationName}}\n{{addressLines|multiline}}\n{{locality}}{{administrativeArea|prefix=', '}}{{postalCode|prefix=' '}}\n{{countryName}}"
}
```

Supported placeholder modifiers:

| Modifier | Description |
| --- | --- |
| `prefix='<text>'` / `suffix='<text>'` | Emit adjacent punctuation only when the component value exists |
| `uppercase` | Force uppercase (e.g., Canadian postal codes) |
| `multiline` | Expand a component across multiple lines (`addressLines`) |
| `separator='<text>'` | Join array-based components when not multiline |

The parser produces a typed AST (`TemplateLine`, `TemplateToken`) consumed by the formatter + extractor.

## Formatting API

`src/traits/addressable/address-formatter.ts` exposes a pure formatter that looks up the appropriate template (by `formatTemplateKey` or `countryCode`), injects the normalized address data, and returns deterministic output.

```ts
import { formatAddress } from '@/traits/addressable/address-formatter.ts';
import { normalizeAddress } from '@/schemas/address.ts';

const address = normalizeAddress({
  organizationName: 'OODS Foundry',
  countryCode: 'US',
  administrativeArea: 'CA',
  locality: 'San Francisco',
  addressLines: ['123 Market St', 'Suite 500'],
  postalCode: '94105',
  formatTemplateKey: 'US',
});

const result = formatAddress(address, { locale: 'en-US' });
console.log(result.lines);
// [
//   'OODS Foundry',
//   '123 Market St',
//   'Suite 500',
//   'San Francisco, CA 94105',
//   'United States'
// ]
```

Returned metadata:

- `lines` – array of rendered lines (whitespace trimmed, ready for UI)
- `formatted` – newline-joined string
- `template` – template definition used for rendering
- `components` – record mapping component keys to the rendered substrings (used for analytics or debugging)

The Addressable runtime now forwards this API via `AddressableTrait.formatAddress()` / `getFormattedAddress()` for convenience.

## Component Extraction

`src/traits/addressable/component-extractor.ts` performs a best-effort reverse parse of postal strings:

```ts
import { extractComponents } from '@/traits/addressable/component-extractor.ts';

const components = extractComponents(result.formatted, { templateKey: 'US' });
// components.organizationName -> 'OODS Foundry'
// components.addressLines -> ['123 Market St', 'Suite 500']
// components.administrativeArea -> 'CA'
```

The extractor:

1. Replays template lines sequentially.
2. Handles `addressLines|multiline` blocks using the schema’s `ADDRESS_MAX_LINES`.
3. Respects prefix/suffix modifiers to avoid leftover punctuation.

> **Note:** This routine is intended for diagnostics, data quality checks, and eventual ingestion pipelines. It does not replace upstream address parsing libraries.

## Storybook Coverage

`stories/traits/AddressFormatting.stories.tsx` renders multiple country samples (US, GB, JP, BR) and allows runtime switching between locales/template keys. The story displays normalized inputs next to formatted output lines, making it easy to confirm template behaviour visually.

## Testing

- `tests/traits/addressable/format-templates.test.ts` validates template registry + parser semantics.
- `tests/traits/addressable/international-formatting.test.ts` covers formatter output, trait integration, and extraction accuracy for US/CA/JP locales.

## Next Steps

1. Extend `data/upu-s42-templates.json` with tier-2 countries (ES, IT, BR, MX, IN already seeded).
2. Hook into validation lifecycle (B25.3) so validation metadata can influence formatting (e.g., corrected addresses).
3. Expose template metadata via CLI (`./cmos/cli.py address templates list`) for documentation automation.
