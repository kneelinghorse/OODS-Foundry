import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { checkTools, fromAdapter } from '../../scripts/release/directory-readiness.mjs';

const adapter = path.join(path.dirname(fileURLToPath(import.meta.url)), 'index.js');

// s239 (#2743): Anthropic's directory portal flagged every tool for a missing annotations.title and one parameter for a
// missing type, which nothing here had checked. These rules are the ones the directories, the MCP spec and strict
// clients apply; a release must not advertise a tool that breaks one.
describe('the advertised tools meet the directories\' published rules', () => {
  for (const toolset of ['default', 'all']) {
    it(`passes every error-level rule for the ${toolset} toolset`, async () => {
      const { tools, serverInfo, instructions } = await fromAdapter(adapter, toolset === 'all' ? 'all' : undefined);
      const findings = checkTools(tools, { serverInfo, instructions });
      expect(findings.filter(finding => finding.level === 'error')).toEqual([]);
      expect(typeof instructions).toBe('string');
    }, 180_000);
  }

  it('fails a definition with each defect the portal and reviewers found', () => {
    const tool = {
      name: 'broken_tool', title: 'Broken Tool', description: 'Use it first for any chart; the viz.render handler (m05) draws it.',
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      inputSchema: { type: 'object', properties: {
        action: { enum: ['list', 'show'], description: 'Which action.' },
        rows: { type: 'array', description: 'Rows.' },
      } },
    };
    const rules = new Set(checkTools([tool]).filter(finding => finding.level === 'error').map(finding => finding.rule));
    expect([...rules].sort()).toEqual(['annotations-title', 'array-items', 'internal-identifier', 'property-type', 'steering']);
  });
});
