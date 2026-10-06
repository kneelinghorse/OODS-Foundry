import type { UiSchema } from '../schemas/generated.js';
import { screenTitle } from './screen-shell.js';
import { listObjects } from '../objects/object-loader.js';
import { handle as compose } from '../tools/design.compose.js';
import { seedSchema } from '../compose/workflow-assembler.js';
import { seedPreviewModel } from './preview-model.js';
import { shownSampleRecord, workflowSampleRecords } from './workflow-data-emitter.js';

/** Public compositions, HTML and standalone apps use the preview's same deterministic record. */
export async function renderSeed(schema: UiSchema) {
  const screen = schema.screens[0];
  const label = screen?.meta?.label;
  const context = schema.workflow ? 'workflow' : screen?.id.match(/^screen-([a-z]+)-/)?.[1] ?? 'detail';
  const object = schema.workflow?.object ?? listObjects().find(name => label === screenTitle(name, context));
  let workflowSchema = schema.workflow ? schema : object ? await seedSchema({ object }, compose) : undefined;
  if (workflowSchema && workflowSchema !== schema) workflowSchema = { ...workflowSchema, objectSchema: { ...workflowSchema.objectSchema, ...schema.objectSchema }, seed: schema.seed };
  const records = workflowSampleRecords(workflowSchema ?? schema);
  const record = shownSampleRecord(records.filter(row => !row.is_archived)) ?? {};
  const model = seedPreviewModel({ schema, context, object, workflowSchema });
  return { record, records, model, title: object ? `${object} ${context}` : label };
}
