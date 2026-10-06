/**
 * s213-m01 (Sprint 212 review finding 6): a generated Vue screen declares only what its code reads. It destructured every
 * field of its props and, in a form, declared a ref per field, so a team project that forbids unused locals
 * (noUnusedLocals) rejected every screen: 5,604 unread locals across 178 screens. The template reads props directly, so
 * a prop is destructured only when the script reads it, or when it carries a default the template reads; a form's
 * per-field ref stays only when something reads it.
 */

/** The JavaScript a template evaluates: interpolations and bound, event, slot and directive attribute values. */
export function templateExpressions(template: string): string {
  const parts: string[] = [];
  for (const match of template.matchAll(/\{\{([\s\S]*?)\}\}/g)) parts.push(match[1]!);
  for (const match of template.matchAll(/\s(?::|@|#|v-[\w-]+)[\w\-.:[\]]*="([^"]*)"/g)) parts.push(match[1]!);
  return parts.join('\n');
}

/**
 * Object-literal keys, comments, string contents and a one-line handler's own parameters name things; they read nothing.
 * A generated handler (`const handlePageChange = (page: number) => { … }`) reads its parameter, not a prop of that name,
 * and 'list-items-5-row-' or a 'chunked' status literal reads no field.
 */
export function readableCode(code: string): string {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/'(?:[^'\\\n]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
    .split('\n').map(line => {
      const parameters = /^\s*const [A-Za-z_$][\w$]* = \(([^)]*)\) =>/.exec(line)?.[1];
      if (!parameters) return line;
      const names = parameters.split(',').map(parameter => parameter.split(':')[0]!.trim()).filter(name => /^[A-Za-z_$][\w$]*$/.test(name));
      return names.reduce((text, name) => text.replace(new RegExp(`(?<![.\\w$])${name.replace(/\$/g, '\\$')}(?![\\w$])`, 'g'), ''), line);
    }).join('\n')
    .replace(/([{,]\s*)[A-Za-z_$][\w$]*(\s*:)(?!:)/g, '$1$2');
}

export const reads = (code: string, name: string) => new RegExp(`(?<![.\\w$])${name.replace(/\$/g, '\\$')}(?![\\w$])`).test(code);

export function pruneUnreadVueDeclarations(template: string, script: string): string {
  const lines = script.split('\n');
  // Interfaces declare types (the props, the actions' signatures); nothing in them reads a value.
  const typeDeclarations = new Set<number>();
  lines.forEach((line, start) => {
    if (!/^(?:export )?interface [A-Za-z_$][\w$]* \{$/.test(line)) return;
    const end = lines.findIndex((candidate, index) => index > start && candidate === '}');
    for (let at = start; at <= end; at += 1) typeDeclarations.add(at);
  });
  const expressions = readableCode(templateExpressions(template));
  const scriptWithout = (skip: Set<number>) => readableCode(lines.filter((_, index) => !skip.has(index) && !typeDeclarations.has(index)).join('\n'));
  const drop = new Set<number>();

  // A form's per-field ref, with the description comment above it.
  lines.forEach((line, index) => {
    const name = /^const ([A-Za-z_$][\w$]*) = ref(?:<.*>)?\(generatedProps\.\1 \?\? /.exec(line)?.[1];
    if (!name || reads(expressions, name) || reads(scriptWithout(new Set([index])), name)) return;
    drop.add(index);
    if ((lines[index - 1] ?? '').trimEnd().endsWith('*/')) {
      let start = index - 1;
      while (start > 0 && !lines[start]!.trimStart().startsWith('/**')) start -= 1;
      for (let at = start; at < index; at += 1) drop.add(at);
    }
  });

  // The destructured props: what the script reads, and a default the template reads (the template sees the prop
  // itself, without the default, when the name is not destructured).
  lines.forEach((line, index) => {
    const match = /^const \{ (.*) \} = (defineProps(?:<Props>\(\)|\(\[[^\]]*\]\)));$/.exec(line);
    if (!match) return;
    const others = scriptWithout(new Set([index, ...drop]));
    const kept = match[1]!.split(',').map(entry => entry.trim()).filter(Boolean).filter(entry => {
      const [name, fallback] = entry.split('=').map(part => part.trim());
      return reads(others, name!) || (fallback !== undefined && reads(expressions, name!));
    });
    lines[index] = kept.length ? `const { ${kept.join(', ')} } = ${match[2]};` : `${match[2]};`;
  });

  const pruned = lines.filter((_, index) => !drop.has(index));
  // The vue runtime import names only what is still called.
  return pruned.flatMap((line, index) => {
    const vue = /^import \{ ([^}]*) \} from 'vue';$/.exec(line);
    if (!vue) return [line];
    const rest = readableCode(pruned.filter((_, at) => at !== index).join('\n'));
    const used = vue[1]!.split(',').map(name => name.trim()).filter(name => new RegExp(`\\b${name}\\s*[<(]`).test(rest));
    return used.length ? [`import { ${used.join(', ')} } from 'vue';`] : [];
  }).join('\n');
}
