import { describe, expect, it } from 'vitest';
import { buildSchema, introspectionFromSchema } from 'graphql';
import { draftSource } from '../../src/importer/draft.js';
import { canonical } from '../../src/importer/source.js';
import { populateCollections } from '../../src/compose/collections.js';
import type { UiSchema } from '../../src/schemas/generated.js';

const odata = (value: unknown) => draftSource({ format: 'odata', content: typeof value === 'string' ? value : JSON.stringify(value) });
const graphql = (content: string) => draftSource({ format: 'graphql', content });
const path = (value: string) => ({ $Path: value });
const model = {
  $Version: '4.01', Demo: {
    Product: { $Kind: 'EntityType', $Key: ['ID'],
      '@UI.HeaderInfo': { Title: { Value: path('Caption') }, Description: { Value: path('Description') } },
      '@UI.LineItem': [{ Value: path('Caption'), Label: 'Product name' }, { Value: path('Price') }],
      '@UI.FieldGroup#Money': { Data: [{ Value: path('Price') }, { Value: path('Currency') }] },
      '@UI.Facets': [{ Label: 'Commercial', Target: { $AnnotationPath: '@UI.FieldGroup#Money' } }],
      ID: { $Type: 'Edm.Guid', '@Core.Computed': true }, Caption: { $Type: 'Edm.String', $Nullable: false, '@Common.Label': 'Product name' },
      Description: { $Type: 'Edm.String' }, Price: { $Type: 'Edm.Decimal', $Nullable: false, '@Measures.ISOCurrency': path('Currency') },
      Currency: { $Type: 'Edm.String', $Nullable: false, '@Validation.AllowedValues': [{ Value: 'USD' }, { Value: 'EUR' }] },
      Weight: { $Type: 'Edm.Decimal', '@Measures.Unit': 'kg' },
      CategoryID: { $Type: 'Edm.Int32', '@Common.Text': path('CategoryCaption'), '@Common.ValueList': { CollectionPath: 'Categories', Label: 'Category', Parameters: [{ LocalDataProperty: { $PropertyPath: 'CategoryID' }, ValueListProperty: 'ID' }] } },
      CategoryCaption: { $Type: 'Edm.String' }, Category: { $Kind: 'NavigationProperty', $Type: 'Demo.Category', $ReferentialConstraint: { CategoryID: 'ID' } },
      State: { $Type: 'Demo.State' }, Address: { $Type: 'Demo.Address' },
    },
    Category: { $Kind: 'EntityType', $Key: ['ID'], ID: { $Type: 'Edm.Int32' }, Name: { $Type: 'Edm.String' } },
    Address: { $Kind: 'ComplexType', City: { $Type: 'Edm.String' } }, State: { $Kind: 'EnumType', New: 0, Active: 1 },
    Container: { $Kind: 'EntityContainer', Products: { $Collection: true, $Type: 'Demo.Product', '@Capabilities.InsertRestrictions': { Insertable: false }, '@Capabilities.UpdateRestrictions': { Updatable: false } }, Categories: { $Collection: true, $Type: 'Demo.Category' } },
  },
};
describe('CSDL vocabulary preserves declared presentation', () => {
  it('projects entity/complex/enum/key/navigation plus title, columns, groups, money, labels, pickers and read-only sets', () => {
    const result = odata(model), product = result.drafts.find(draft => draft.name === 'Product')!;
    expect(product.definition.metadata.supportedContexts).toEqual(['list', 'detail']);
    expect(product.definition.metadata.listColumns).toEqual([{ field: 'Caption', label: 'Product name' }, { field: 'Price' }]);
    expect(product.definition.semantics.Caption.semantic_type).toBe('text.label');
    expect(product.definition.semantics.Description.semantic_type).toBe('text.summary');
    expect(product.definition.semantics.Price.ui_hints).toMatchObject({ currencyField: 'Currency', detail_group: 'Commercial' });
    expect(product.definition.semantics.Weight.ui_hints).toMatchObject({ unit: { symbol: 'kg' } });
    expect(product.definition.semantics.CategoryID.ui_hints).toMatchObject({ displayLabelField: 'CategoryCaption' });
    expect(product.definition.schema.ID.readOnly).toBe(true);
    expect(product.definition.schema.ID.required).toBe(true);
    expect(product.definition.schema.State.validation?.enum).toEqual(['New', 'Active']);
    expect(product.definition.relationships).toContainEqual(expect.objectContaining({ via: 'CategoryID', target: 'Category' }));
    expect(product.proposals).toContainEqual(expect.objectContaining({ trait: expect.objectContaining({ name: 'Priceable' }), grade: 'strong' }));
    expect(canonical(odata(model))).toBe(canonical(result));
  });
  it('keeps readable local names without conflating equal type names from separate namespaces', () => {
    const data = { $Version: '4.01', First: { Item: { $Kind: 'EntityType', ID: { $Type: 'Edm.Int32' } } }, Second: { Item: { $Kind: 'EntityType', Name: { $Type: 'Edm.String' } } } };
    const result = odata(data);
    expect(result.drafts.map(d => d.name)).toEqual(['Item', expect.stringMatching(/^Item[a-f0-9]{10}$/)]);
    expect(new Set(result.drafts.map(d => d.sourceName))).toEqual(new Set(['First.Item', 'Second.Item']));
    expect(canonical(odata(data))).toBe(canonical(result));
  });
  it('recognizes fully qualified SAP lowercase v1 terms and aliases', () => {
    const data = structuredClone(model) as any;
    data.$Reference = { 'https://example.test/UI.xml': { $Include: [{ $Namespace: 'com.sap.vocabularies.UI.v1', $Alias: 'UI' }] } };
    data.Demo.Product['@com.sap.vocabularies.Common.v1.Label'] = 'Product';
    const product = odata(data).drafts.find(d => d.name === 'Product')!;
    expect(product.definition.semantics.Caption.semantic_type).toBe('text.label');
    expect(product.definition.metadata.listColumns?.map(column => column.field)).toEqual(['Caption', 'Price']);
    expect(product.definition.semantics.Price.ui_hints?.detail_group).toBe('Commercial');
  });
  it('reads EDMX v4 annotations and v2 SAP labels/associations directly without a network resolver', () => {
    const result = odata(`<?xml version="1.0"?><edmx:Edmx xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx" Version="4.0"><edmx:Reference Uri="https://example.test/vocab.xml"><edmx:Include Namespace="com.sap.vocabularies.UI.v1" Alias="UI" /></edmx:Reference><edmx:DataServices><Schema Namespace="Demo" xmlns="http://docs.oasis-open.org/odata/ns/edm"><EntityType Name="Product"><Key><PropertyRef Name="ID"/></Key><Property Name="ID" Type="Edm.Int32" Nullable="false"/><Property Name="Name" Type="Edm.String" sap:label="Product &amp; item"/><Property Name="Date" Type="Edm.DateTime" sap:display-format="Date"/><NavigationProperty Name="Category" Relationship="Demo.ProductCategory" ToRole="Category"/><Annotation Term="UI.HeaderInfo"><Record><PropertyValue Property="Title"><Record><PropertyValue Property="Value" Path="Name"/></Record></PropertyValue></Record></Annotation></EntityType><EntityType Name="Category"><Key><PropertyRef Name="ID"/></Key><Property Name="ID" Type="Edm.Int32"/></EntityType><Association Name="ProductCategory"><End Role="Category" Type="Demo.Category" Multiplicity="1"/></Association><EntityContainer Name="Container"><EntitySet Name="Products" EntityType="Demo.Product" sap:creatable="false" sap:updatable="false"/></EntityContainer></Schema></edmx:DataServices></edmx:Edmx>`);
    const product = result.drafts.find(d => d.name === 'Product')!;
    expect(product.definition.semantics.Name.ui_hints?.label).toBe('Product & item');
    expect(product.definition.schema.Date.type).toBe('date?');
    expect(product.definition.relationships?.[0].target).toBe('Category');
    expect(product.definition.metadata.supportedContexts).toEqual(['list', 'detail']);
    expect(result.report.some(row => row.reason.includes('not fetched'))).toBe(true);
  });
  it('refuses DTDs before parsing and preserves unsupported vocabulary explicitly', () => {
    expect(() => odata('<!DOCTYPE x [<!ENTITY secret SYSTEM "file:///etc/passwd">]><Schema/>')).toThrow(/DTD and entity/);
    const data = structuredClone(model) as any; data.Demo.Product['@UI.Unknown'] = { Dynamic: 'anything' };
    const result = odata(data);
    expect(result.hub.$defs.Product['x-odata']['@UI.Unknown']).toEqual({ Dynamic: 'anything' });
    expect(result.report.some(row => row.pointer.endsWith('@UI.Unknown') && row.outcome === 'unmapped')).toBe(true);
  });
  it('uses the same ordered list declaration for hand-written objects', () => {
    const schema = { version: '2026.02', objectSchema: { id: { type: 'integer' }, name: { type: 'string' }, amount: { type: 'number' } }, screens: [{ id: 'screen', component: 'Stack', children: [{ id: 'list-toolbar-x', component: 'Stack' }, { id: 'list-items-x', component: 'Stack' }] }] } as UiSchema;
    populateCollections(schema, 'list', 'NoRegistry', undefined, [{ field: 'amount', label: 'Total' }, { field: 'name' }]);
    const content = schema.screens[0].children![1].children![0].children!;
    expect(content.map(node => node.children![1].props?.field)).toEqual(['amount', 'name']);
    expect(content[0].children![0].props?.text).toBe('Total');
  });
});
const sdl = `"Opaque undeclared format" scalar DateTime
scalar Timestamp @specifiedBy(url: "https://scalars.graphql.org/andimarek/date-time.html")
enum State { NEW ACTIVE }
interface Named { name: String! }
"A customer record" type Customer implements Named { id: ID!, name: String!, joined: Timestamp, old: String @deprecated(reason: "Use name"), state: State!, orders: [Order!]!, unknown: DateTime }
type Order { id: ID!, customer: Customer!, total: Float, flags: [Boolean!] }
union Result = Customer | Order
type Query { search: [Result!]! }`;
describe('GraphQL has variants and declared scalar evidence', () => {
  it('projects SDL object fields, enums, nullability, lists, descriptions, deprecations and relationships', () => {
    const result = graphql(sdl), customer = result.drafts.find(d => d.name === 'Customer')!;
    expect(customer.definition.schema.name.required).toBe(true);
    expect(customer.definition.schema.joined.type).toBe('datetime?');
    expect(customer.definition.schema.state.validation?.enum).toEqual(['NEW', 'ACTIVE']);
    expect(customer.definition.schema.orders.type).toBe('string[]');
    expect(customer.definition.schema).not.toHaveProperty('unknown');
    expect(customer.definition.relationships).toContainEqual(expect.objectContaining({ target: 'Order', via: 'orders' }));
    expect(result.hub.$defs.Customer.properties.old.deprecated).toBe(true);
    expect(result.hub.$defs.Result.oneOf).toHaveLength(2);
    expect(result.hub.$defs.Named.oneOf).toHaveLength(1);
    expect(result.drafts.map(d => d.name)).toEqual(expect.not.arrayContaining(['Query', 'Result', 'Named']));
    expect(result.report.some(row => row.reason.includes('name does not determine'))).toBe(true);
    expect(canonical(graphql(sdl))).toBe(canonical(result));
  });
  it('reads introspection JSON and keeps source type/field pointers', () => {
    const result = graphql(JSON.stringify({ data: introspectionFromSchema(buildSchema(sdl)) }));
    const customer = result.drafts.find(d => d.name === 'Customer')!;
    expect(customer.definition.schema.joined.type).toBe('datetime?');
    expect(customer.origin.pointer).toMatch(/^\/data\/__schema\/types\/\d+$/);
    expect(result.hub['x-oods'].provenance['/$defs/Customer/properties/name'].pointer).toMatch(/\/fields\/\d+$/);
    expect(result.hub.$defs.Customer.properties.old['x-graphql-deprecationReason']).toBe('Use name');
  });
  it('combines type extensions without guessing missing referenced types', () => {
    const result = graphql('type Record { id: ID! } extend type Record { label: String! other: Missing }');
    expect(result.drafts[0].definition.schema.label.required).toBe(true);
    expect(result.drafts[0].definition.schema).not.toHaveProperty('other');
    expect(result.report.some(row => row.kind === 'link' && row.outcome === 'unmapped')).toBe(true);
  });
});

it('names malformed duplicate GraphQL fields and keeps the first declaration without overwriting it', () => {
  const result = graphql('type Record { id: ID!, value: String!, value: Int }');
  expect(result.drafts[0].definition.schema.value.type).toBe('string');
  expect(result.report.some(row => row.kind === 'property' && row.outcome === 'unmapped' && row.reason.includes('Duplicate GraphQL field'))).toBe(true);
});
it('respects the distinct XML and JSON CSDL nullability defaults', () => {
  const json = odata({ $Version: '4.01', Demo: { Item: { $Kind: 'EntityType', a: {}, b: { $Nullable: true } } } });
  expect(json.drafts[0].definition.schema.a.type).toBe('string');
  expect(json.drafts[0].definition.schema.b.type).toBe('string?');
  const xml = odata('<Schema Namespace="Demo"><EntityType Name="Item"><Property Name="a" Type="Edm.String"/><Property Name="b" Type="Edm.String" Nullable="false"/></EntityType></Schema>');
  expect(xml.drafts[0].definition.schema.a.type).toBe('string?');
  expect(xml.drafts[0].definition.schema.b.type).toBe('string');
});

it('represents a CSDL navigation through its foreign key once and does not render unresolved localization tokens', () => {
  const data = { $Version: '4.01', Demo: {
    Category: { $Kind: 'EntityType', $Key: ['ID'], ID: { $Type: 'Edm.Int32' } },
    Item: { $Kind: 'EntityType', ID: { $Type: 'Edm.Int32' }, category_id: { $Type: 'Edm.Int32', '@Core.Description': '{i18n>Category.Help}' }, category: { $Kind: 'NavigationProperty', $Type: 'Demo.Category', $ReferentialConstraint: { category_id: 'ID' }, '@Common.Label': '{i18n>Category}' } },
  } };
  const result = odata(data), item = result.drafts.find(d => d.name === 'Item')!;
  expect(item.definition.schema.category).toBeUndefined();
  expect(item.definition.schema.category_id.description).toBe('');
  expect(item.definition.relationships).toEqual([{ target: 'Category', via: 'category_id', cardinality: 'many-to-one', label: 'category' }]);
  expect(result.report.some(row => row.outcome === 'unmapped' && row.reason.includes('translation bundle'))).toBe(true);
});

it('uses v2 association principal/dependent constraints for the same scalar foreign-key editor', () => {
  const result = odata('<Schema Namespace="Demo"><EntityType Name="Product"><Property Name="ID" Type="Edm.Int32"/><Property Name="CategoryID" Type="Edm.Int32"/><NavigationProperty Name="Category" Relationship="Demo.ProductCategory" FromRole="Products" ToRole="Categories"/></EntityType><EntityType Name="Category"><Key><PropertyRef Name="ID"/></Key><Property Name="ID" Type="Edm.Int32"/></EntityType><Association Name="ProductCategory"><End Role="Categories" Type="Demo.Category" Multiplicity="0..1"/><End Role="Products" Type="Demo.Product" Multiplicity="*"/><ReferentialConstraint><Principal Role="Categories"><PropertyRef Name="ID"/></Principal><Dependent Role="Products"><PropertyRef Name="CategoryID"/></Dependent></ReferentialConstraint></Association></Schema>');
  const product = result.drafts.find(d => d.name === 'Product')!;
  expect(product.definition.schema.Category).toBeUndefined();
  expect(product.definition.relationships).toEqual([{ target: 'Category', via: 'CategoryID', cardinality: 'many-to-one', label: 'Category' }]);
});
