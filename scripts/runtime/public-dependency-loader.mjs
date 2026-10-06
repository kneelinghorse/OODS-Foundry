import { fileURLToPath } from 'node:url';
import guard from './public-dependency-guard.cjs';
export async function resolve(specifier, context, nextResolve) {
  const result = await nextResolve(specifier, context);
  if (result.url.startsWith('file:')) guard.check(fileURLToPath(result.url));
  return result;
}
