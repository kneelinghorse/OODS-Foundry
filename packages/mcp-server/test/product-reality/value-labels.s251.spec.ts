import { describe, expect, it } from 'vitest';
import { seedSchema } from '../../src/compose/workflow-assembler.js';
import { handle as compose } from '../../src/tools/design.compose.js';
import { emit as emitHtml } from '../../src/codegen/html-emitter.js';
import { seedPreviewModel } from '../../src/codegen/preview-model.js';
import { snakeToCamel } from '../../src/codegen/binding-utils.js';
import { workflowSampleRecords } from '../../src/codegen/workflow-data-emitter.js';

describe('display-only words for a stored value', () => {
  it.each([
    ['Grant', 'asks_first_for', 'No listed action needs a separate yes', 1],
    ['Grant', 'never_allowed', 'No additional exclusions listed', 1],
    ['Agent', 'acts_for', 'No party listed', 3],
  ] as const)('renders every %s record whose %s stores None', async (object, field, label, count) => {
    const input = { object, context: 'detail' as const };
    const result = await compose({ ...input, options: { transient: true } });
    const schema = result.schema!;
    expect(schema.objectSchema![field].valueLabels).toEqual({ None: label });
    const workflow = await seedSchema(input, compose);
    const records = workflowSampleRecords(workflow).filter(record => record[field] === 'None');
    expect(records).toHaveLength(count);
    for (const row of records) {
      const established = Object.fromEntries(Object.entries(row).map(([key, value]) => [snakeToCamel(key), value]));
      const sampleModel = seedPreviewModel({ schema, context: 'detail', object, workflowSchema: workflow, established });
      const html = emitHtml(schema, { objectName: object, sampleModel });
      expect(html.code).toContain('>' + label + '</span>');
      expect(row[field]).toBe('None');
    }
  });
});
