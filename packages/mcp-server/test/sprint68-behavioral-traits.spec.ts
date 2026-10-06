/**
 * Sprint 68 — Behavioral Traits + Maturity Surfacing
 *
 * Comprehensive tests for:
 * 1. Behavioral trait loading (Searchable, Filterable, Pageable, Sortable)
 * 2. Component renderers (SearchInput, PaginationBar, FilterPanel)
 * 3. List layout integration with behavioral traits
 * 4. Backward compatibility (non-behavioral objects)
 * 5. Maturity surfacing (object_show, design_compose, catalog_list)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadTrait,
  listTraits,
  clearTraitCache,
} from '../src/objects/trait-loader.js';
import { loadObject, clearObjectCache } from '../src/objects/object-loader.js';
import { composeObject } from '../src/objects/trait-composer.js';
import { collectViewExtensions } from '../src/compose/view-extension-collector.js';
import { renderMappedComponent, hasMappedRenderer } from '../src/render/component-map.js';
import { handle as objectShowHandle } from '../src/tools/object.show.js';
import { handle as composeHandle } from '../src/tools/design.compose.js';

beforeEach(() => {
  clearTraitCache();
  clearObjectCache();
});

// ---- 1. Behavioral trait loading ----

describe('behavioral trait loading', () => {
  const BEHAVIORAL_TRAITS = ['Searchable', 'Filterable', 'Pageable', 'Sortable'];

  it('all 4 behavioral traits are discoverable', () => {
    const all = listTraits();
    for (const name of BEHAVIORAL_TRAITS) {
      expect(all).toContain(name);
    }
  });

  it.each(BEHAVIORAL_TRAITS)('%s loads with category=behavioral', (name) => {
    const trait = loadTrait(name);
    expect(trait.trait.name).toBe(name);
    expect(trait.trait.category).toBe('behavioral');
  });

  it.each(BEHAVIORAL_TRAITS)('%s has view_extensions for list context', (name) => {
    const trait = loadTrait(name);
    expect(trait.view_extensions).toHaveProperty('list');
    expect(trait.view_extensions.list.length).toBeGreaterThan(0);
  });

  it.each(BEHAVIORAL_TRAITS)('%s has parameters (propSchema)', (name) => {
    const trait = loadTrait(name);
    expect(trait.parameters.length).toBeGreaterThan(0);
    for (const param of trait.parameters) {
      expect(param.name).toBeTruthy();
      expect(param.type).toBeTruthy();
    }
  });

  it.each(BEHAVIORAL_TRAITS)('%s has schema fields', (name) => {
    const trait = loadTrait(name);
    expect(Object.keys(trait.schema).length).toBeGreaterThan(0);
    for (const [, field] of Object.entries(trait.schema)) {
      expect(field.type).toBeTruthy();
      expect(field.description).toBeTruthy();
    }
  });

  it.each(BEHAVIORAL_TRAITS)('%s has semantic mappings', (name) => {
    const trait = loadTrait(name);
    expect(Object.keys(trait.semantics).length).toBeGreaterThan(0);
  });

  it.each(BEHAVIORAL_TRAITS)('%s has token definitions', (name) => {
    const trait = loadTrait(name);
    expect(Object.keys(trait.tokens).length).toBeGreaterThan(0);
  });

  it('Searchable has searchQuery and searchActive schema fields', () => {
    const trait = loadTrait('Searchable');
    expect(trait.schema).toHaveProperty('searchQuery');
    expect(trait.schema.searchQuery.type).toBe('string');
    expect(trait.schema).toHaveProperty('searchActive');
    expect(trait.schema.searchActive.type).toBe('boolean');
  });

  it('Filterable has filters, activeFilters, filterCount schema fields', () => {
    const trait = loadTrait('Filterable');
    expect(trait.schema).toHaveProperty('filters');
    expect(trait.schema.filters.type).toBe('object[]');
    expect(trait.schema).toHaveProperty('activeFilters');
    expect(trait.schema).toHaveProperty('filterCount');
    expect(trait.schema.filterCount.type).toBe('number');
  });

  it('Pageable has page, pageSize, totalItems, totalPages schema fields', () => {
    const trait = loadTrait('Pageable');
    expect(trait.schema).toHaveProperty('page');
    expect(trait.schema.page.type).toBe('number');
    expect(trait.schema).toHaveProperty('pageSize');
    expect(trait.schema).toHaveProperty('totalItems');
    expect(trait.schema).toHaveProperty('totalPages');
  });

  it('Sortable has sortField, sortDirection, sortActive schema fields', () => {
    const trait = loadTrait('Sortable');
    expect(trait.schema).toHaveProperty('sortField');
    expect(trait.schema.sortField.type).toBe('string');
    expect(trait.schema).toHaveProperty('sortDirection');
    expect(trait.schema).toHaveProperty('sortActive');
    expect(trait.schema.sortActive.type).toBe('boolean');
  });

  it('Searchable places SearchInput in header position', () => {
    const trait = loadTrait('Searchable');
    const listExts = trait.view_extensions.list;
    const searchInput = listExts.find((e) => e.component === 'SearchInput');
    expect(searchInput).toBeDefined();
    expect(searchInput!.position).toBe('header');
  });

  it('Filterable places FilterPanel in sidebar position', () => {
    const trait = loadTrait('Filterable');
    const listExts = trait.view_extensions.list;
    const filterPanel = listExts.find((e) => e.component === 'FilterPanel');
    expect(filterPanel).toBeDefined();
    expect(filterPanel!.position).toBe('sidebar');
  });

  it('Pageable places PaginationBar in footer position', () => {
    const trait = loadTrait('Pageable');
    const listExts = trait.view_extensions.list;
    const paginationBar = listExts.find((e) => e.component === 'PaginationBar');
    expect(paginationBar).toBeDefined();
    expect(paginationBar!.position).toBe('footer');
  });

  it('Sortable places SortIndicator in header position', () => {
    const trait = loadTrait('Sortable');
    const listExts = trait.view_extensions.list;
    const sortIndicator = listExts.find((e) => e.component === 'SortIndicator');
    expect(sortIndicator).toBeDefined();
    expect(sortIndicator!.position).toBe('header');
  });
});

// ---- 2. Component renderer tests ----

describe('behavioral component renderers', () => {
  it('SearchInput has a mapped renderer', () => {
    expect(hasMappedRenderer('SearchInput')).toBe(true);
  });

  it('PaginationBar has a mapped renderer', () => {
    expect(hasMappedRenderer('PaginationBar')).toBe(true);
  });

  it('FilterPanel has a mapped renderer', () => {
    expect(hasMappedRenderer('FilterPanel')).toBe(true);
  });

  it('SearchInput renders with role=search', () => {
    const html = renderMappedComponent({
      id: 'test-1',
      component: 'SearchInput',
      props: { placeholder: 'Search...' },
    });
    expect(html).toContain('role="search"');
    expect(html).toContain('type="search"');
    expect(html).toContain('placeholder="Search..."');
  });

  it('SearchInput renders clear button when value present and clearable', () => {
    const html = renderMappedComponent({
      id: 'test-2',
      component: 'SearchInput',
      props: { value: 'test', clearable: true },
    });
    expect(html).toContain('data-search-clear="true"');
    expect(html).toContain('Clear search');
  });

  it('SearchInput omits clear button when no value', () => {
    const html = renderMappedComponent({
      id: 'test-3',
      component: 'SearchInput',
      props: { value: '', clearable: true },
    });
    expect(html).not.toContain('data-search-clear');
  });

  it('PaginationBar renders as nav with pagination', () => {
    const html = renderMappedComponent({
      id: 'test-4',
      component: 'PaginationBar',
      props: { page: 3, pageSize: 25, totalItems: 100 },
    });
    expect(html).toContain('<nav');
    expect(html).toContain('aria-label="Pagination"');
    expect(html).toContain('aria-current="page"');
    expect(html).toContain('Showing 51');
    expect(html).toContain('of 100');
  });

  it('PaginationBar disables prev on first page', () => {
    const html = renderMappedComponent({
      id: 'test-5',
      component: 'PaginationBar',
      props: { page: 1, pageSize: 10, totalItems: 50 },
    });
    expect(html).toContain('data-pagination-prev="true" disabled');
  });

  it('PaginationBar disables next on last page', () => {
    const html = renderMappedComponent({
      id: 'test-6',
      component: 'PaginationBar',
      props: { page: 5, pageSize: 10, totalItems: 50 },
    });
    expect(html).toContain('data-pagination-next="true" disabled');
  });

  it('FilterPanel renders with role=region and aria-label', () => {
    const html = renderMappedComponent({
      id: 'test-7',
      component: 'FilterPanel',
      props: { filters: [], activeFilters: [] },
    });
    expect(html).toContain('role="region"');
    expect(html).toContain('aria-label="Filters"');
  });

  it('FilterPanel renders filter sections from filters array', () => {
    const html = renderMappedComponent({
      id: 'test-8',
      component: 'FilterPanel',
      props: {
        filters: [
          { field: 'status', label: 'Status' },
          { field: 'category', label: 'Category' },
        ],
        activeFilters: [],
      },
    });
    expect(html).toContain('<legend>Status</legend>');
    expect(html).toContain('<legend>Category</legend>');
  });

  it('FilterPanel shows active filter count', () => {
    const html = renderMappedComponent({
      id: 'test-9',
      component: 'FilterPanel',
      props: {
        filters: [],
        activeFilters: [{ field: 'status', operator: 'eq', value: 'active' }],
      },
    });
    expect(html).toContain('1 active');
    expect(html).toContain('Clear all');
  });

  it('FilterPanel shows apply button in batch mode', () => {
    const html = renderMappedComponent({
      id: 'test-10',
      component: 'FilterPanel',
      props: { filters: [], activeFilters: [], mode: 'batch' },
    });
    expect(html).toContain('data-filter-apply="true"');
    expect(html).toContain('Apply');
  });

  it('FilterPanel omits apply button in immediate mode', () => {
    const html = renderMappedComponent({
      id: 'test-11',
      component: 'FilterPanel',
      props: { filters: [], activeFilters: [], mode: 'immediate' },
    });
    expect(html).not.toContain('data-filter-apply');
  });
});

// ---- 3. List layout integration ----

describe('list layout behavioral trait integration', () => {
  it('Product with behavioral traits places SearchInput in search slot', async () => {
    const result = await composeHandle({
      object: 'Product',
      context: 'list',
      layout: 'list',
      options: { validate: false },
    });
    expect(result.status).toBe('ok');
    const searchSel = result.selections.find((s) => s.slotName === 'search');
    expect(searchSel?.selectedComponent).toBe('SearchInput');
  });

  it('Product with behavioral traits places FilterPanel in filters slot', async () => {
    const result = await composeHandle({
      object: 'Product',
      context: 'list',
      layout: 'list',
      options: { validate: false },
    });
    const filterSel = result.selections.find((s) => s.slotName === 'filters');
    expect(filterSel?.selectedComponent).toBe('FilterPanel');
  });

  it('Product with behavioral traits places PaginationBar in pagination slot', async () => {
    const result = await composeHandle({
      object: 'Product',
      context: 'list',
      layout: 'list',
      options: { validate: false },
    });
    const paginationSel = result.selections.find((s) => s.slotName === 'pagination');
    expect(paginationSel?.selectedComponent).toBe('PaginationBar');
  });

  it('objectUsed includes behavioral traits', async () => {
    const result = await composeHandle({
      object: 'Product',
      context: 'list',
      layout: 'list',
      options: { validate: false },
    });
    expect(result.objectUsed?.traits).toContain('behavioral/Searchable');
    expect(result.objectUsed?.traits).toContain('behavioral/Filterable');
    expect(result.objectUsed?.traits).toContain('behavioral/Pageable');
  });

  it('view_extension collector returns behavioral entries for list context', () => {
    const obj = loadObject('Product');
    const composed = composeObject(obj);
    const collected = collectViewExtensions(composed, 'list');

    const searchEntry = collected.plan.find((e) => e.component === 'SearchInput');
    expect(searchEntry).toBeDefined();
    expect(searchEntry!.position).toBe('header');
    expect(searchEntry!.sourceTrait).toBe('behavioral/Searchable');

    const filterEntry = collected.plan.find((e) => e.component === 'FilterPanel');
    expect(filterEntry).toBeDefined();
    expect(filterEntry!.position).toBe('sidebar');

    const paginationEntry = collected.plan.find((e) => e.component === 'PaginationBar');
    expect(paginationEntry).toBeDefined();
    expect(paginationEntry!.position).toBe('footer');
  });
});

// ---- 4. Backward compatibility ----

describe('backward compatibility', () => {
  it('Transaction (no behavioral traits) composes list layout without errors', async () => {
    const result = await composeHandle({
      object: 'Transaction',
      context: 'list',
      layout: 'list',
      options: { validate: false },
    });
    expect(result.status).toBe('ok');
    expect(result.objectUsed?.traits).not.toContain('behavioral/Searchable');
  });

  it('Transaction search slot now benefits from generic SearchInput ranking', async () => {
    const result = await composeHandle({
      object: 'Transaction',
      context: 'list',
      layout: 'list',
      options: { validate: false },
    });
    const searchSel = result.selections.find((s) => s.slotName === 'search');
    expect(searchSel).toBeDefined();
    expect(searchSel!.selectedComponent).toBe('SearchInput');
  });

  it('compose without object still works', async () => {
    const result = await composeHandle({
      intent: 'product list with search',
      layout: 'list',
      options: { validate: false },
    });
    expect(result.status).toBe('ok');
    expect(result.selections.length).toBeGreaterThan(0);
  });
});

// ---- 5. Maturity surfacing ----

describe('maturity surfacing', () => {
  it('object_show returns maturity for beta objects', async () => {
    const result = await objectShowHandle({ name: 'Invoice' });
    expect(result.maturity).toBe('beta');
  });

  it('object_show returns maturity for stable objects', async () => {
    const result = await objectShowHandle({ name: 'User' });
    expect(result.maturity).toBe('stable');
  });

  it('object_show returns null maturity when not set', async () => {
    const result = await objectShowHandle({ name: 'Transaction' });
    expect(result.maturity).toBeNull();
  });

  it('design_compose warns for beta object maturity', async () => {
    const result = await composeHandle({
      object: 'Invoice',
      context: 'list',
      layout: 'list',
      options: { validate: false },
    });
    const maturityWarning = result.warnings.find((w) => w.code === 'OODS-V121');
    expect(maturityWarning).toBeDefined();
    expect(maturityWarning!.message).toContain('beta');
    expect(maturityWarning!.message).toContain('Invoice');
  });

  it('design_compose does not warn for stable objects', async () => {
    const result = await composeHandle({
      object: 'User',
      context: 'list',
      layout: 'list',
      options: { validate: false },
    });
    const maturityWarning = result.warnings.find((w) => w.code === 'OODS-V121');
    expect(maturityWarning).toBeUndefined();
  });

  it('design_compose meta.warnings includes maturity message for beta objects', async () => {
    const result = await composeHandle({
      object: 'Invoice',
      context: 'list',
      layout: 'list',
      options: { validate: false },
    });
    expect(result.meta?.warnings).toBeDefined();
    const maturityMsg = result.meta!.warnings!.find((w) => w.includes('maturity'));
    expect(maturityMsg).toBeDefined();
  });

  it('design_compose does not add meta.warnings for objects without maturity issues', async () => {
    const result = await composeHandle({
      object: 'Transaction',
      context: 'list',
      layout: 'list',
      options: { validate: false },
    });
    const maturityMsg = result.meta?.warnings?.find((w) => w.includes('maturity'));
    expect(maturityMsg).toBeUndefined();
  });
});
