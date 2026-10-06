// Use Ajv 2020-12 to match schema meta
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - type resolution for subpath import
import AjvCtor from 'ajv/dist/2020.js';
import addFormatsImport from 'ajv-formats';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isKnownBrand } from './brand-registry.js';
import { BRAND_FORMAT } from '../security/errors.js';

let ajvInstance: any | null = null;

export function getAjv(): any {
  if (!ajvInstance) {
    const AjvClass: any = AjvCtor as any;
    ajvInstance = new AjvClass({
      allErrors: true,
      allowUnionTypes: true,
      strict: false,
      useDefaults: true
    });
    const addFormats: any = (addFormatsImport as any).default ?? addFormatsImport;
    addFormats(ajvInstance);
    // s213-m04: a brand field is a string the brand registry holds, checked on every call, so a brand the token
    // build adds is accepted without a schema edit and an unknown one names the known brands.
    ajvInstance.addFormat(BRAND_FORMAT, { type: 'string', validate: (value: string) => isKnownBrand(value) });
    const metaPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '../schemas/json-schema-draft-07.json');
    try {
      const draft7 = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
      ajvInstance.addMetaSchema(draft7);
    } catch {
      // ignore missing meta schema; validation will be less strict without it
    }

    // Preload shared schemas so relative $ref links (e.g. ./repl.patch.json)
    // resolve without external fetches. Only load the shared dependencies to
    // avoid duplicate registrations for top-level schemas compiled elsewhere.
    const schemasDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../schemas');
    for (const file of ['repl.patch.json', 'repl.ui.schema.json']) {
      const schemaPath = path.join(schemasDir, file);
      if (!fs.existsSync(schemaPath)) continue;
      const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
      const schemaId = typeof schema.$id === 'string' && schema.$id.trim().length > 0 ? schema.$id : `urn:local-schema:${file}`;
      if (!ajvInstance.getSchema(schemaId)) {
        ajvInstance.addSchema(schema, schemaId);
      }
    }
  }
  return ajvInstance;
}
