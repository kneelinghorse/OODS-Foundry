import Ajv2020 from 'ajv/dist/2020.js';

let ajvInstance: Ajv2020 | null = null;

export function getAjv(): Ajv2020 {
  if (!ajvInstance) {
    ajvInstance = new Ajv2020({
      allErrors: true,
      allowUnionTypes: true,
      strict: true,
      removeAdditional: 'failing',
      useDefaults: true,
    });
  }
  return ajvInstance;
}
