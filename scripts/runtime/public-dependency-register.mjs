import { register } from 'node:module';
register('./public-dependency-loader.mjs', import.meta.url);
