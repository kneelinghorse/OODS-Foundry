// Check mentions of tool calls, while preserving JSON/YAML parameter names such as object and schema.
import fs from 'node:fs';
import path from 'node:path';
import { markdownFiles } from './guide-versions.mjs';
import { toolSurface } from './tool-names.mjs';

export function retiredToolReferences(text, file = '') {
  // Only the new rename table is exempt; old changelog prose is checked too.
  if (path.basename(file) === 'CHANGELOG.md') text = text.replace(/### Tool renames\n[\s\S]*?(?=\nOld names)/, '');
  const findings = [];
  for (const [internal, entry] of Object.entries(toolSurface())) {
    const legacy = internal.replaceAll('.', '_');
    if (legacy === entry.name) continue;
    const escaped = legacy.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const patterns = ['object', 'schema'].includes(legacy)
      ? [new RegExp('`' + escaped + '`(?=\\s*(?:tool|\\(?`?(?:action|list|show|save|load|register|validate)|with))', 'g'), new RegExp('(?:call|use|using|ask for|start with)\\s+`' + escaped + '`', 'gi')]
      : [new RegExp('`' + escaped + '`|(?<![\\w./-])(?:structuredData_fetch|brand_intake|repl)(?![\\w./-])', 'g')];
    patterns.push(new RegExp('<!-- quickstart: \\S+ ' + escaped + ' -->', 'g'));
    patterns.push(new RegExp('"name"\\s*:\\s*"' + escaped + '"', 'g'));
    for (const pattern of patterns) for (const match of text.matchAll(pattern)) {
      const name = match[0].match(/structuredData_fetch|brand_intake|\brepl\b/)?.[0] ?? legacy;
      if (name !== legacy) continue;
      findings.push({ file, line: text.slice(0, match.index).split('\n').length, name: legacy, replacement: entry.name });
    }
  }
  return findings.filter((row, i) => findings.findIndex(other => other.file === row.file && other.line === row.line && other.name === row.name) === i);
}

export function checkToolNames(packageRoot) {
  const findings = markdownFiles(packageRoot).flatMap(file => retiredToolReferences(fs.readFileSync(file, 'utf8'), path.relative(packageRoot, file)));
  const errors = path.join(packageRoot, 'errors.json');
  if (fs.existsSync(errors)) {
    const names = new Set(Object.values(toolSurface()).map(entry => entry.name));
    for (const row of JSON.parse(fs.readFileSync(errors, 'utf8')).codes ?? []) for (const name of row.tools ?? []) {
      if (!names.has(name)) findings.push({ file: 'errors.json', code: row.code, name });
    }
  }
  return findings;
}
