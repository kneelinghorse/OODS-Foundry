/**
 * s255-m01 (G1, R3 §5.2 run A): a vendor's API often writes its record inline, in the operation that returns it. Mem0's
 * memory is the response of GET and of PUT /v1/memories/{memory_id}/, the same shape twice with different descriptions,
 * and the importer drafted it twice, as Operationb8a06d7f51 and Operationd1f9c006bc. An inline schema is now named by its
 * title or by where it sits (method, path, role), never a hash; an inline record of a shape already read is drafted once;
 * and a schema that only points at a named schema is that record, drafted once under its own name.
 */
import { expect, it } from 'vitest';
import { draftSource } from '../../src/importer/draft.js';

/**
 * A minimal excerpt written from Mem0's published API description, https://docs.mem0.ai/openapi.json (OpenAPI 3.0.1,
 * "Mem0 API Docs" v1, read 2026-11-26, 339,707 bytes, SHA-256 e03088efda24dc9b2ac2dd1d0f59df85739dc7172e11ee9d2f921769e470a242):
 * five of the memory's fields with their published types and descriptions, the PUT's two that differ, and the 400 error.
 */
const memory = (id: string, words: string) => ({ type: 'object', properties: {
  id: { type: 'string', format: 'uuid', description: id },
  memory: { type: 'string', description: words },
  user_id: { type: 'string', nullable: true, description: 'Identifier of the user associated with this memory' },
  created_at: { type: 'string', format: 'date-time', description: 'The timestamp when the memory was created.' },
  updated_at: { type: 'string', format: 'date-time', description: 'The timestamp when the memory was last updated.' },
} });
const error = { type: 'object', properties: { error: { type: 'string' } } };
const json = (schema: object, description = 'OK') => ({ description, content: { 'application/json': { schema } } });
const mem0 = {
  openapi: '3.0.1', info: { title: 'Mem0 API Docs', version: 'v1' },
  paths: { '/v1/memories/{memory_id}/': {
    get: { operationId: 'memories_read', responses: { 200: json(memory('Unique identifier for the memory.', 'The content of the memory')), 400: json(error, 'Bad request') } },
    put: { operationId: 'memories_update', responses: { 200: json(memory('The unique identifier of the updated memory.', 'The updated content of the memory.')), 400: json(error, 'Bad request') } },
  } },
};
const draft = (document: object) => draftSource({ content: JSON.stringify(document), name: 'openapi.json' });

it("drafts Mem0's memory once, named by where it sits, with the first place's descriptions", () => {
  const result = draft(mem0);
  expect(result.drafts.map(item => item.name).sort()).toEqual(['GetV1MemoriesMemoryIdResponse', 'GetV1MemoriesMemoryIdResponse400']);
  const record = result.drafts.find(item => item.name === 'GetV1MemoriesMemoryIdResponse')!;
  expect(Object.keys(record.definition.schema).sort()).toEqual(['created_at', 'id', 'memory', 'updated_at', 'user_id']);
  expect(record.definition.schema.memory.description).toBe('The content of the memory');
  expect(record.definition.object.description).toBe('Imported GET /v1/memories/{memory_id}/ response schema. Samples without source examples are illustrative.');
  expect(result.hub['x-oods'].sourceNames.GetV1MemoriesMemoryIdResponse).toBe('GET /v1/memories/{memory_id}/ response');
  expect(result.report).toContainEqual(expect.objectContaining({
    pointer: '/paths/~1v1~1memories~1{memory_id}~1/put/responses/200/content/application~1json/schema', kind: 'schema', outcome: 'mapped',
    reason: 'The same shape as the inline schema at /paths/~1v1~1memories~1{memory_id}~1/get/responses/200/content/application~1json/schema, apart from its descriptions: one record, drafted once as GetV1MemoriesMemoryIdResponse.',
  }));
  // The two error responses are one shape too, named with their status.
  expect(result.report.filter(entry => /drafted once as GetV1MemoriesMemoryIdResponse400\.$/.test(entry.reason))).toHaveLength(1);
  expect(result.drafts.some(item => /^Operation[0-9a-f]{10}$/.test(item.name))).toBe(false);
});

it('keeps two places apart when their shapes differ, and names a request, a parameter and a component by their role', () => {
  const document = structuredClone(mem0) as any;
  document.paths['/v1/memories/{memory_id}/'].put.responses[200] = json({ ...memory('id', 'words'), properties: { ...memory('id', 'words').properties, categories: { type: 'array', items: { type: 'string' } } } });
  document.paths['/v1/memories/{memory_id}/'].put.requestBody = { content: { 'application/json': { schema: { type: 'object', properties: { text: { type: 'string' } } } } } };
  document.paths['/v1/memories/{memory_id}/'].get.parameters = [{ name: 'filters', in: 'query', schema: { type: 'object', properties: { app_id: { type: 'string' } } } }];
  document.components = { responses: { NotFound: json({ type: 'object', properties: { detail: { type: 'string' } } }) } };
  const names = draft(document).drafts.map(item => item.name).sort();
  expect(names).toEqual(['GetV1MemoriesMemoryIdFiltersParameter', 'GetV1MemoriesMemoryIdResponse', 'GetV1MemoriesMemoryIdResponse400', 'NotFoundResponse', 'PutV1MemoriesMemoryIdRequest', 'PutV1MemoriesMemoryIdResponse']);
});

it('names an inline record by its title, and tells two schemas of one place apart by media type', () => {
  const document = structuredClone(mem0) as any;
  document.paths['/v1/memories/{memory_id}/'].get.responses[200].content['application/json'].schema.title = 'Memory record';
  document.paths['/v1/memories/{memory_id}/'].get.responses[200].content['text/json'] = { schema: { type: 'object', properties: { id: { type: 'string' }, text: { type: 'string' } } } };
  const names = draft(document).drafts.map(item => item.name).sort();
  expect(names).toEqual(['GetV1MemoriesMemoryIdResponse', 'GetV1MemoriesMemoryIdResponse400', 'MemoryRecord']);
  document.paths['/v1/memories/{memory_id}/'].get.responses[200].content['application/json'].schema.title = undefined;
  expect(draft(JSON.parse(JSON.stringify(document))).drafts.map(item => item.name).sort()).toEqual(['GetV1MemoriesMemoryIdResponse', 'GetV1MemoriesMemoryIdResponse400', 'GetV1MemoriesMemoryIdResponseTextJson']);
});

it('drafts a response that only points at a named schema as that schema, once', () => {
  const document = structuredClone(mem0) as any;
  document.components = { schemas: { Memory: memory('Unique identifier for the memory.', 'The content of the memory') } };
  document.paths['/v1/memories/{memory_id}/'].get.responses[200] = json({ $ref: '#/components/schemas/Memory' });
  document.paths['/v1/memories/{memory_id}/'].put.responses[200] = json({ allOf: [{ $ref: '#/components/schemas/Memory' }], description: 'The updated memory.' });
  const result = draft(document);
  expect(result.drafts.map(item => item.name).sort()).toEqual(['GetV1MemoriesMemoryIdResponse400', 'Memory']);
  expect(result.report.filter(entry => entry.reason === 'A reference to Memory: that record is drafted once, under its own name.').map(entry => entry.pointer)).toEqual([
    '/paths/~1v1~1memories~1{memory_id}~1/get/responses/200/content/application~1json/schema',
    '/paths/~1v1~1memories~1{memory_id}~1/put/responses/200/content/application~1json/schema',
  ]);
});
