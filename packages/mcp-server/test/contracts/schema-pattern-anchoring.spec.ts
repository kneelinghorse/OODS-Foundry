// Every `pattern` in every ADVERTISED tool input schema must be fully anchored (^…$).
//
// WHY (2026-08-16, reported by the Mac Studio LLM team — cmos message 7d8c9ddf):
// llama.cpp's JSON-schema→grammar converter (LM Studio, Unsloth, any llama.cpp-
// hosted client) refuses a tool whose `pattern` is not anchored at both ends —
// "Pattern must start with '^' and end with '$'" — BEFORE generation, so the
// tool is unusable from that client. Claude Code and AJV both accept a prefix-
// only pattern, which is why viz.render's `intent.measureRef` (`^gm\.`, the
// sprint-131 governed-reference contract) shipped unnoticed until a strict
// client hit it. The fix is `^gm\..*$`: AJV accepts exactly the same strings as
// before (`.*` keeps the bare `gm.` prefix accepted at the schema, where the
// registry lookup then fails loud with OODS-V130), with ONE deliberate delta —
// a reference containing a newline is now rejected at the schema, since `.`
// never crosses a newline; such a reference could never resolve anyway.
//
// The schema list is derived from the ToolSpec table in src/index.ts — the
// same table the MCP server advertises — plus every local `$ref` those files
// reach, so a new tool or a new shared fragment is covered automatically.
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getAjv } from '../../src/lib/ajv.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PKG = path.resolve(__dirname, '../..');
const SCHEMAS = path.join(PKG, 'src/schemas');

function advertisedInputSchemas(): string[] {
  const src = fs.readFileSync(path.join(PKG, 'src/index.ts'), 'utf8');
  const files = new Set<string>();
  for (const m of src.matchAll(/inputSchema:\s*'\.\/schemas\/([^']+\.json)'/g)) files.add(m[1]);
  return [...files].sort();
}

// Follow local "$ref": "./x.json[#…]" links transitively so shared fragments
// (repl.patch.json, repl.ui.schema.json, …) are covered too.
function withLocalRefs(files: string[]): string[] {
  const seen = new Set<string>();
  const queue = [...files];
  while (queue.length) {
    const f = queue.shift() as string;
    if (seen.has(f)) continue;
    seen.add(f);
    const text = fs.readFileSync(path.join(SCHEMAS, f), 'utf8');
    for (const m of text.matchAll(/"\$ref":\s*"\.\/([^"#]+\.json)(?:#[^"]*)?"/g)) queue.push(m[1]);
  }
  return [...seen].sort();
}

type Hit = { file: string; at: string; pattern: string };

function collectPatterns(node: unknown, at: string, file: string, out: Hit[]): void {
  if (Array.isArray(node)) {
    node.forEach((v, i) => collectPatterns(v, `${at}[${i}]`, file, out));
    return;
  }
  if (node && typeof node === 'object') {
    const rec = node as Record<string, unknown>;
    if (typeof rec.pattern === 'string') out.push({ file, at, pattern: rec.pattern });
    for (const [k, v] of Object.entries(rec)) collectPatterns(v, `${at}/${k}`, file, out);
  }
}

// llama.cpp's rule, literally: first char '^', last char an unescaped '$'.
function isFullyAnchored(p: string): boolean {
  return p.startsWith('^') && p.endsWith('$') && !p.endsWith('\\$');
}

function allPatterns(): Hit[] {
  const out: Hit[] = [];
  for (const f of withLocalRefs(advertisedInputSchemas())) {
    collectPatterns(JSON.parse(fs.readFileSync(path.join(SCHEMAS, f), 'utf8')), '', f, out);
  }
  return out;
}

describe('strict-client schema compatibility: every advertised input-schema pattern is ^…$ anchored', () => {
  it('derives the advertised input-schema list from the src/index.ts ToolSpec table', () => {
    const files = advertisedInputSchemas();
    expect(files).toContain('viz.render.input.json');
    expect(files.length).toBeGreaterThanOrEqual(19); // registry.json auto tools
    for (const f of withLocalRefs(files)) expect(fs.existsSync(path.join(SCHEMAS, f))).toBe(true);
  });

  it('has at least one pattern to guard (the walker is not vacuous)', () => {
    expect(allPatterns().length).toBeGreaterThan(0);
  });

  it('every pattern starts with ^ and ends with $ (llama.cpp schema→grammar requirement)', () => {
    const unanchored = allPatterns().filter((h) => !isFullyAnchored(h.pattern));
    expect(
      unanchored,
      `non-anchored pattern(s) would be rejected by llama.cpp-hosted clients:\n${unanchored
        .map((h) => `  ${h.file}${h.at}: ${JSON.stringify(h.pattern)}`)
        .join('\n')}`,
    ).toEqual([]);
  });

  it('every pattern compiles as a u-flag RegExp (AJV default unicodeRegExp)', () => {
    for (const h of allPatterns()) expect(() => new RegExp(h.pattern, 'u'), `${h.file}${h.at}`).not.toThrow();
  });

  it('keeps absolute CSS and shadcn project paths equivalent to the old prefix check', () => {
    const paths = allPatterns().filter(hit => hit.at.endsWith('/cssPath') || hit.at.endsWith('/shadcn/properties/project'));
    expect(paths.length).toBeGreaterThan(0);
    for (const hit of paths) {
      const validate = getAjv().compile({ type: 'string', pattern: hit.pattern });
      for (const value of ['/', '/team/app', '/team with spaces/app', '/team\napp']) expect(validate(value), `${hit.at}: ${value}`).toBe(true);
      for (const value of ['', 'team/app', '@/components']) expect(validate(value), `${hit.at}: ${value}`).toBe(false);
    }
  });
});

describe('viz.render intent.measureRef keeps the sprint-131 governed-reference acceptance', () => {
  const schema = JSON.parse(fs.readFileSync(path.join(SCHEMAS, 'viz.render.input.json'), 'utf8'));
  const pattern: string = schema.properties.intent.properties.measureRef.pattern;
  const validate = getAjv().compile({ type: 'string', pattern });

  it('pins the anchored pattern (a future tightening to `.+` is a contract change, not a compat fix)', () => {
    expect(pattern).toBe('^gm\\..*$');
  });

  it('accepts what the prefix-only pattern accepted', () => {
    for (const ok of ['gm.revenue.total', 'gm.export.value.total', 'gm.x', 'gm.']) {
      expect(validate(ok), ok).toBe(true); // bare 'gm.' passes the SCHEMA; the registry then hard-errors OODS-V130
    }
  });

  it('rejects what the prefix-only pattern rejected', () => {
    for (const bad of ['revenue.total', 'Gm.revenue', ' gm.revenue', 'xgm.revenue', '', 'gd.region']) {
      expect(validate(bad), JSON.stringify(bad)).toBe(false);
    }
  });

  it('documents the one delta: a newline inside the reference is now rejected at the schema', () => {
    expect(/^gm\./u.test('gm.a\nb')).toBe(true); // old prefix-only pattern
    expect(validate('gm.a\nb')).toBe(false); // anchored pattern
  });
});
