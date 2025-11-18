import type { Product } from '../../generated/objects/Product';
import {
  normalizeCategoryNode,
  type CategoryNode,
} from '@/schemas/classification/category-node.js';
import { normalizeClassificationMetadata } from '@/schemas/classification/classification-metadata.js';

const primaryCategory = normalizeCategoryNode({
  id: 'cat_mobile_android',
  slug: 'android-phones',
  name: 'Android Phones',
  path: ['hardware', 'mobile', 'android'],
  parentId: 'cat_mobile',
  ancestors: ['cat_hardware', 'cat_mobile'],
  childCount: 42,
  mode: 'taxonomy',
  depth: 2,
  isSelectable: true,
  metadata: { source: 'catalog', sortKey: 30 },
});

const ancestorCategories: CategoryNode[] = [
  normalizeCategoryNode({
    id: 'cat_hardware',
    slug: 'hardware',
    name: 'Hardware',
    path: ['hardware'],
    childCount: 6,
    mode: 'taxonomy',
    depth: 0,
    isSelectable: true,
  }),
  normalizeCategoryNode({
    id: 'cat_mobile',
    slug: 'mobile',
    name: 'Mobile',
    path: ['hardware', 'mobile'],
    parentId: 'cat_hardware',
    ancestors: ['cat_hardware'],
    childCount: 3,
    mode: 'taxonomy',
    depth: 1,
    isSelectable: true,
  }),
];

const productCategories: CategoryNode[] = [...ancestorCategories, primaryCategory];

const productClassificationMetadata = normalizeClassificationMetadata({
  mode: 'taxonomy',
  hierarchyStorageModel: 'materialized_path',
  tagPolicy: 'locked',
  primaryCategoryRequired: true,
  tagLimit: 8,
  source: {
    dataset: 'catalog',
    version: '2025.45',
    generatedAt: '2025-11-18T20:55:00Z',
  },
  governance: {
    synonymsEnabled: false,
    moderationQueue: true,
    spamHeuristics: {
      maxTagsPerItem: 8,
      velocityThreshold: 5,
    },
  },
});

export const ProductWithCategoriesExample: Product = {
  product_id: 'prod_classifiable_001',
  sku: 'SKU-CLASS-ANDROID',
  label: 'Axiom X2 Mobile Platform',
  description: 'Flagship Android hardware bundle with telemetry + warranty services.',
  placeholder: 'Search hardware catalog',
  summary_blurb: 'Premium Android hardware with enterprise MDM baked in.',
  support_level: 'enterprise',
  release_channel: 'general_availability',
  requires_subscription: true,
  inventory_status: 'in_stock',
  pricing_model: 'subscription',
  billing_interval: 'month',
  currency: 'USD',
  unit_amount_cents: 42000,
  tax_behavior: 'exclusive',
  state_history: [
    {
      from_state: 'draft',
      to_state: 'in_review',
      timestamp: '2025-10-30T16:00:00Z',
    },
    {
      from_state: 'in_review',
      to_state: 'active',
      timestamp: '2025-11-05T12:30:00Z',
    },
  ],
  status: 'active',
  created_at: '2025-10-15T10:00:00Z',
  updated_at: '2025-11-18T20:58:00Z',
  last_event: 'price_changed',
  last_event_at: '2025-11-18T20:58:00Z',
  categories: productCategories,
  classification_metadata: productClassificationMetadata,
  primary_category_id: primaryCategory.id,
  primary_category_path: 'Hardware › Mobile › Android Phones',
  tag_count: 0,
  tags: [],
};
