import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ObjectRegistry } from '../../src/registry/registry.js';

function createTempWorkspace(): { root: string; objects: string; traits: string } {
  const root = mkdtempSync(join(tmpdir(), 'composition-integration-'));
  const objects = join(root, 'objects');
  const traits = join(root, 'traits');
  mkdirSync(objects, { recursive: true });
  mkdirSync(traits, { recursive: true });
  return { root, objects, traits };
}

function writeTrait(directory: string, name: string, contents: string): void {
  writeFileSync(join(directory, `${name}.trait.yaml`), contents, 'utf8');
}

function writeObject(directory: string, name: string, contents: string): void {
  writeFileSync(join(directory, `${name}.object.yaml`), contents, 'utf8');
}

describe('Object composition integration', () => {
  let workspace: ReturnType<typeof createTempWorkspace>;

  beforeEach(() => {
    workspace = createTempWorkspace();

    writeTrait(
      workspace.traits,
      'Timestamped',
      `
trait:
  name: Timestamped
  version: 1.0.0
schema:
  created_at:
    type: string
    required: true
  updated_at:
    type: string
    required: true
`
    );

    writeTrait(
      workspace.traits,
      'Descriptive',
      `
trait:
  name: Descriptive
  version: 1.0.0
schema:
  description:
    type: string
    required: false
`
    );

    writeObject(
      workspace.objects,
      'ContentBase',
      `
object:
  name: ContentBase
traits:
  - name: Timestamped
schema:
  status:
    type: string
    required: true
    default: draft
`
    );

    writeObject(
      workspace.objects,
      'Article',
      `
object:
  name: Article
  extends:
    name: ContentBase
traits:
  - name: Timestamped
  - name: Descriptive
schema:
  description:
    type: string
    required: true
  title:
    type: string
    required: true
resolutions:
  fields:
    description: object
views:
  detail:
    - action: add
      id: articleSummary
      component: ArticleSummary
      priority: 20
`
    );
  });

  afterEach(() => {
    rmSync(workspace.root, { recursive: true, force: true });
  });

  it('resolves objects with trait composition, overrides, and provenance', async () => {
    const registry = new ObjectRegistry({
      roots: [workspace.objects],
      watch: false,
    });

    try {
      const resolved = await registry.resolve('Article', {
        traitRoots: [workspace.traits],
        validateParameters: false,
      });

      expect(resolved.record.name).toBe('Article');
      expect(resolved.base?.name).toBe('ContentBase');
      expect(resolved.viewOverrides?.detail?.[0]?.component).toBe('ArticleSummary');

      const traitNames = resolved.resolvedTraits.map((trait) => trait.reference.name);
      expect(traitNames).toEqual(['Timestamped', 'Descriptive']);

      const descriptionField = resolved.composed.schema.description;
      expect(descriptionField).toBeDefined();
      expect(descriptionField.required).toBe(true);

      const provenance = resolved.composed.metadata.provenance.get('description');
      expect(provenance).toBeDefined();
      expect(provenance?.layer).toBe('object');
      expect(provenance?.source).toBe('Article');
      expect(provenance?.previousSources).toContain('Descriptive');

      const overrides = Array.from(resolved.conflictPlan.objectFieldOverrides);
      expect(overrides).toContain('description');

      const collision = resolved.composed.metadata.collisions.find(
        (entry) => entry.fieldName === 'description'
      );
      expect(collision).toBeDefined();
      expect(collision?.winner).toBe('Article');

      const titleProvenance = resolved.composed.metadata.provenance.get('title');
      expect(titleProvenance?.layer).toBe('object');
      expect(titleProvenance?.source).toBe('Article');

      expect(resolved.metadata.resolutionMs).toBeGreaterThanOrEqual(0);
      expect(resolved.metadata.compositionMs).toBeGreaterThanOrEqual(0);
    } finally {
      registry.close();
    }
  });
});
