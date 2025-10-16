// Use Ajv 2020-12 to match schema meta
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - type resolution for subpath import
import AjvCtor from 'ajv/dist/2020.js';

let ajvInstance: any | null = null;

export function getAjv(): any {
  if (!ajvInstance) {
    const AjvClass: any = AjvCtor as any;
    ajvInstance = new AjvClass({
      allErrors: true,
      allowUnionTypes: true,
      strict: true,
      removeAdditional: 'failing',
      useDefaults: true
    });
  }
  return ajvInstance;
}
