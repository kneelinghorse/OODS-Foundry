import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
await build({ absWorkingDir: fileURLToPath(new URL('.', import.meta.url)), entryPoints: ['src/react.tsx', 'src/vue.ts'], outdir: 'dist', bundle: true, format: 'esm', platform: 'browser', external: ['react', 'vue'] });
execFileSync(process.execPath, [createRequire(import.meta.url).resolve('typescript/bin/tsc'),
  'src/react.tsx', 'src/vue.ts', '--declaration', '--emitDeclarationOnly', '--outDir', 'dist', '--jsx', 'react-jsx',
  '--moduleResolution', 'bundler', '--module', 'esnext', '--target', 'es2022', '--skipLibCheck', '--esModuleInterop'],
{ cwd: fileURLToPath(new URL('.', import.meta.url)), stdio: 'inherit' });
