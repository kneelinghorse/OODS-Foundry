import { join } from 'path';
import { parseTypeScriptTraitSync } from './src/parsers/ts-parser.ts';

const file = join(process.cwd(), 'tests/fixtures/ts/valid-trait.js');
const res = parseTypeScriptTraitSync(file);
console.log(JSON.stringify(res, null, 2));
