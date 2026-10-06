import fs from 'node:fs';
import path from 'node:path';
import type { CodegenResult } from './types.js';
import type { EmittedSubstitution, RecordedSubstitution } from './component-substitutions.js';

/** Keep the team's relative layout so the same import works inside its project and in the portable app. */
export function packageShadcnApplication(result: CodegenResult, substitutions: EmittedSubstitution[], mappings: RecordedSubstitution[]): void {
  const shadcn = substitutions.filter(entry => entry.source.shadcn);
  if (!shadcn.length) return;
  const files = result.files!;
  if (!files.some(file => file.path === 'src/GeneratedUI.tsx')) throw new Error('Shadcn substitutions in workflow application output are not supported; generate each screen as a React component or single-screen application.');
  const manifestFile = files.find(file => file.path === 'package.json')!;
  const manifest = JSON.parse(manifestFile.contents);
  const paths: Record<string, string[]> = {};
  const styles = new Set<string>();
  for (const entry of shadcn) {
    const source = entry.source.shadcn!;
    const project = mappings.find(mapping => mapping.mappingId === entry.mappingId)!.substitution.react!.shadcn!.project;
    for (const relative of source.files) {
      const encoding = /\.(?:[cm]?[jt]sx?|json|css|svg|txt)$/.test(relative) ? undefined : 'base64' as const;
      const contents = fs.readFileSync(path.join(project, relative)).toString(encoding ?? 'utf8');
      const previous = files.find(file => file.path === relative);
      if (previous && (previous.contents !== contents || previous.encoding !== encoding)) throw new Error(`Shadcn source file '${relative}' collides with another generated or mapped file.`);
      if (!previous) files.push({ path: relative, contents, ...(encoding ? { encoding } : {}) });
    }
    for (const [alias, targets] of Object.entries(source.paths)) {
      if (paths[alias] && JSON.stringify(paths[alias]) !== JSON.stringify(targets.map(target => './' + target))) throw new Error(`Shadcn project alias '${alias}' has conflicting targets.`);
      paths[alias] = targets.map(target => './' + target);
    }
    for (const [name, version] of Object.entries(source.dependencies)) {
      // The mapped project owns React pins; shipped OODS packages retain their release pin.
      if (name.startsWith('@oods/')) continue;
      if (!['react', 'react-dom'].includes(name) && manifest.dependencies[name] && manifest.dependencies[name] !== version) throw new Error(`Shadcn dependency '${name}' has conflicting installed versions.`);
      manifest.dependencies[name] = version;
    }
    styles.add(source.css);
  }
  const aliases = Object.entries(paths).map(([alias, targets]) => {
    if (targets.length !== 1 || alias.includes('*') && !alias.endsWith('/*') || targets[0]!.includes('*') && !targets[0]!.endsWith('/*')) throw new Error(`Shadcn application alias '${alias}' requires one exact target or a trailing /* wildcard.`);
    return `{ find: ${JSON.stringify(alias.replace(/\/\*$/, ''))}, replacement: decodeURIComponent(new URL(${JSON.stringify(targets[0]!.replace(/\/\*$/, ''))}, import.meta.url).pathname) }`;
  });
  const config = files.find(file => file.path === 'vite.config.mjs')!;
  const integration = manifest.dependencies['@tailwindcss/vite'] ? '@tailwindcss/vite' : '@tailwindcss/postcss';
  if (!manifest.dependencies[integration]) throw new Error('Shadcn application requires an inspected Tailwind Vite or PostCSS integration.');
  config.contents = `import tailwindcss from '${integration}';\nexport default { plugins: [${integration === '@tailwindcss/vite' ? 'tailwindcss()' : ''}], resolve: { alias: [${aliases.join(', ')}] }, css: { postcss: { plugins: [${integration === '@tailwindcss/postcss' ? 'tailwindcss()' : ''}] } } };\n`;
  const tsconfigFile = files.find(file => file.path === 'tsconfig.json')!;
  const tsconfig = JSON.parse(tsconfigFile.contents); tsconfig.compilerOptions.paths = paths;
  tsconfig.include = ['src', ...new Set(shadcn.flatMap(entry => entry.source.shadcn!.files.filter(file => /\.(tsx?|jsx?)$/.test(file))))];
  tsconfigFile.contents = JSON.stringify(tsconfig, null, 2) + '\n';
  const main = files.find(file => file.path === 'src/main.tsx')!;
  main.contents += [...styles].map(css => `import ${JSON.stringify('./' + path.posix.relative('src', css))};`).join('\n') + '\n';
  for (const entry of shadcn) for (const specifier of [...entry.source.shadcn!.imports, integration]) if (!result.imports.includes(specifier)) result.imports.push(specifier);
  manifestFile.contents = JSON.stringify(manifest, null, 2) + '\n';
}
