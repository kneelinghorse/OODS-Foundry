/** Read a built package's public exports without importing it or running any package script. */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { parse } from 'acorn';
import type { ComponentImplementation } from './component-substitution.js';

type Syntax = { type: string; [key: string]: any };

function target(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(target).find(Boolean);
  if (value && typeof value === 'object') {
    for (const [condition, entry] of Object.entries(value)) {
      if (['browser', 'import', 'default'].includes(condition)) {
        const found = target(entry);
        if (found) return found;
      }
    }
  }
  return undefined;
}

function moduleFile(file: string): string {
  const found = [file, `${file}.js`, `${file}.mjs`, `${file}.cjs`, path.join(file, 'index.js')]
    .find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
  if (!found) throw new Error(`entry file does not exist: ${file}`);
  return fs.realpathSync(found);
}

function bindingNames(node: Syntax): string[] {
  if (node.type === 'Identifier') return [node.name];
  if (node.type === 'ObjectPattern') return node.properties.flatMap((prop: Syntax) => bindingNames(prop.value ?? prop.argument));
  if (node.type === 'ArrayPattern') return node.elements.filter(Boolean).flatMap(bindingNames);
  if (node.type === 'AssignmentPattern') return bindingNames(node.left);
  if (node.type === 'RestElement') return bindingNames(node.argument);
  return [];
}

function memberName(node: Syntax): string | undefined {
  return node.computed ? typeof node.property.value === 'string' ? node.property.value : undefined : node.property.name;
}

function commonJsObject(node: Syntax): boolean {
  return node.type === 'MemberExpression' && node.object.type === 'Identifier' && node.object.name === 'module' && memberName(node) === 'exports';
}

export function exportsName(file: string, name: string, seen = new Set<string>(), read = (file: string) => fs.readFileSync(file, 'utf8'), resolve?: (specifier: string, importer: string) => string): boolean {
  const key = `${file}:${name}`;
  if (seen.has(key)) return false;
  seen.add(key);
  const source = read(file);
  const tree = parse(source, { ecmaVersion: 'latest', sourceType: 'module', allowHashBang: true }) as unknown as { body: Syntax[] };
  const follow = (specifier: string, exported: string) => {
    const resolved = resolve ? resolve(specifier, file) : specifier.startsWith('.')
      ? moduleFile(path.resolve(path.dirname(file), specifier))
      : createRequire(file).resolve(specifier);
    return exportsName(resolved, exported, seen, read, resolve);
  };
  for (const statement of tree.body) {
    if (statement.type === 'ExportDefaultDeclaration' && name === 'default') return true;
    if (statement.type === 'ExportNamedDeclaration') {
      const declaration = statement.declaration;
      if (declaration?.id?.name === name) return true;
      if (declaration?.type === 'VariableDeclaration' && declaration.declarations.some((item: Syntax) => bindingNames(item.id).includes(name))) return true;
      for (const specifier of statement.specifiers) {
        if ((specifier.exported.name ?? specifier.exported.value) !== name) continue;
        if (!statement.source || follow(statement.source.value, specifier.local.name ?? specifier.local.value)) return true;
      }
    }
    if (statement.type === 'ExportAllDeclaration') {
      if (statement.exported && (statement.exported.name ?? statement.exported.value) === name) return true;
      if (!statement.exported && name !== 'default' && follow(statement.source.value, name)) return true;
    }
    // Statically named CommonJS exports are accepted too. Computed/dynamic export factories are not executed.
    const expression = statement.type === 'ExpressionStatement' ? statement.expression : undefined;
    if (expression?.type !== 'AssignmentExpression' || expression.operator !== '=') continue;
    const left = expression.left;
    if (left.type === 'MemberExpression' && (left.object.type === 'Identifier' && left.object.name === 'exports' || commonJsObject(left.object)) && memberName(left) === name) return true;
    if (commonJsObject(left)) {
      if (name === 'default') return true;
      if (expression.right.type === 'ObjectExpression' && expression.right.properties.some((prop: Syntax) => prop.type === 'Property' && !prop.computed && (prop.key.name ?? prop.key.value) === name)) return true;
    }
  }
  return false;
}

/** localPath describes a pinned, built package, not an instruction to execute or install one. */
export function validateLocalImplementation(source: ComponentImplementation): void {
  if (!source.localPath || !source.package) return;
  const directory = fs.realpathSync(source.localPath);
  const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'package.json'), 'utf8'));
  const nameParts = source.package.startsWith('@') ? 2 : 1;
  const name = source.package.split('/').slice(0, nameParts).join('/');
  const subpath = source.package.slice(name.length);
  if (!source.version || manifest.name !== name || manifest.version !== source.version) {
    throw new Error(`expected ${name}@${source.version ?? '(exact version required with localPath)'}, found ${manifest.name}@${manifest.version}`);
  }
  const exports = manifest.exports;
  const entry = exports !== undefined
    ? target(exports && typeof exports === 'object' && !Array.isArray(exports) && Object.keys(exports).some(key => key.startsWith('.')) ? exports[subpath ? `.${subpath}` : '.'] : subpath ? undefined : exports)
    : subpath ? `.${subpath}` : target(manifest.browser) ?? manifest.module ?? manifest.main ?? './index.js';
  if (typeof entry !== 'string') throw new Error(`no import entry for ${source.package}`);
  const file = moduleFile(path.resolve(directory, entry));
  if (!file.startsWith(`${directory}${path.sep}`)) throw new Error('entry must stay inside its package directory');
  if (!exportsName(file, source.export)) throw new Error(`${source.package} does not statically export '${source.export}' from ${path.relative(directory, file)}`);
}
