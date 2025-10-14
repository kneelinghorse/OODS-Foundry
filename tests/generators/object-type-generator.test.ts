import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ObjectRegistry } from '../../src/registry/registry.ts';
import { generateObjectInterface } from '../../src/generators/object-type-generator.ts';
import { renderBarrelFile } from '../../src/generators/barrel-generator.ts';

function createWorkspace(): { root: string; objects: string; traits: string } {
  const root = mkdtempSync(join(tmpdir(), 'object-generator-'));
  const objects = join(root, 'objects');
  const traits = join(root, 'traits');
  mkdirSync(objects, { recursive: true });
  mkdirSync(traits, { recursive: true });
  return { root, objects, traits };
}

describe('object type generator', () => {
  let workspace: ReturnType<typeof createWorkspace>;

  beforeEach(() => {
    workspace = createWorkspace();
  });

  afterEach(() => {
    rmSync(workspace.root, { recursive: true, force: true });
  });

  it('generates provenance-aware interfaces with literal unions', async () => {
    writeFileSync(
      join(workspace.traits, 'StatusTrait.trait.yaml'),
      `
trait:
  name: StatusTrait
  version: 1.0.0
parameters:
  - name: statuses
    type: string[]
    required: true
    default: [draft, active]
schema:
  status:
    type: string
    required: true
    description: Canonical lifecycle status.
    validation:
      enumFromParameter: statuses
  notes:
    type: string
    required: false
    description: Optional comments.
`,
      'utf8'
    );

    writeFileSync(
      join(workspace.objects, 'Ticket.object.yaml'),
      `
object:
  name: Ticket
traits:
  - name: StatusTrait
schema:
  notes: string?
`,
      'utf8'
    );

    const registry = new ObjectRegistry({
      roots: [workspace.objects],
      watch: false,
    });

    try {
      await registry.waitUntilReady();
      const resolved = await registry.resolve('Ticket', {
        traitRoots: [workspace.traits],
        validateParameters: false,
      });

      const generated = generateObjectInterface(resolved);
      expect(generated.interfaceName).toBe('Ticket');
      expect(generated.fileName).toBe('Ticket.d.ts');
      expect(generated.code).toContain('export interface Ticket');
      expect(generated.code).toContain(`status: 'draft' | 'active';`);
      expect(generated.code).toContain('Source: StatusTrait (trait)');
      expect(generated.code).toContain("notes?: string;");
      expect(generated.code).toContain('Source: Ticket (object override)');
    } finally {
      registry.close();
    }
  });

  it('renders barrel exports for generated objects', () => {
    const barrel = renderBarrelFile([
      { interfaceName: 'Ticket', fileName: 'Ticket.d.ts' },
      { interfaceName: 'Invoice', fileName: 'Invoice.d.ts' },
    ]);

    expect(barrel).toContain("export type { Invoice } from './Invoice';");
    expect(barrel).toContain("export type { Ticket } from './Ticket';");
  });
});
