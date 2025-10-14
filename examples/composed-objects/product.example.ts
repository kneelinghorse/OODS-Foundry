/**
 * Product Example
 *
 * Demonstrates composing a Product object with collision resolution:
 * - Colorized (color scheme support)
 * - Priceable (pricing information)
 * - Inventoried (stock tracking)
 * - Categorizable (category management)
 *
 * This example demonstrates handling a collision on the 'name' field
 * that appears in both base object and a trait.
 */

import { TraitCompositor } from '../../src/core/compositor.js';
import type { TraitDefinition } from '../../src/core/trait-definition.js';

// Define the Colorized trait
const ColorizedTrait: TraitDefinition = {
  trait: {
    name: 'Colorized',
    version: '1.0.0',
    description: 'Provides customizable color properties and theming support',
    category: 'styling',
  },
  schema: {
    color: {
      type: 'string',
      required: false,
      description: 'The current color value applied to this object',
      validation: {
        pattern: '^#[0-9a-fA-F]{6}$',
      },
    },
    color_scheme: {
      type: 'string',
      required: false,
      default: 'default',
      description: 'The selected color scheme',
      validation: {
        enum: ['default', 'primary', 'secondary', 'accent'],
      },
    },
  },
  semantics: {
    color: {
      semantic_type: 'color_field',
      ui_hints: {
        component: 'ColorPicker',
        showAlpha: false,
      },
    },
  },
  view_extensions: {
    list: [
      {
        component: 'ColorSwatch',
        props: {
          field: 'color',
          size: 'sm',
        },
        priority: 15,
      },
    ],
  },
  tokens: {
    'colorized-swatch-size-sm': '1rem',
    'colorized-swatch-size-md': '1.5rem',
  },
};

// Define the Priceable trait
const PriceableTrait: TraitDefinition = {
  trait: {
    name: 'Priceable',
    version: '1.0.0',
    description: 'Adds pricing information',
    category: 'financial',
  },
  schema: {
    price: {
      type: 'number',
      required: true,
      description: 'Product price',
      validation: {
        min: 0,
      },
    },
    currency: {
      type: 'string',
      required: true,
      default: 'usd',
      description: 'Currency code',
      validation: {
        pattern: '^[a-z]{3}$',
      },
    },
    sale_price: {
      type: 'number',
      required: false,
      description: 'Sale price (if on sale)',
      validation: {
        min: 0,
      },
    },
  },
  semantics: {
    price: {
      semantic_type: 'currency_amount',
      ui_hints: {
        component: 'PriceDisplay',
        showCurrency: true,
      },
    },
  },
  view_extensions: {
    list: [
      {
        component: 'PriceTag',
        props: {
          showSale: true,
        },
        priority: 20,
      },
    ],
    detail: [
      {
        component: 'PricingSection',
        position: 'top',
        priority: 10,
      },
    ],
  },
};

// Define the Inventoried trait
const InventoriedTrait: TraitDefinition = {
  trait: {
    name: 'Inventoried',
    version: '1.0.0',
    description: 'Adds inventory tracking',
    category: 'operational',
  },
  schema: {
    stock_quantity: {
      type: 'number',
      required: true,
      default: 0,
      description: 'Current stock quantity',
      validation: {
        min: 0,
      },
    },
    stock_status: {
      type: 'string',
      required: true,
      default: 'in_stock',
      description: 'Stock availability status',
      validation: {
        enum: ['in_stock', 'low_stock', 'out_of_stock', 'discontinued'],
      },
    },
    reorder_point: {
      type: 'number',
      required: false,
      description: 'Quantity at which to reorder',
      validation: {
        min: 0,
      },
    },
  },
  semantics: {
    stock_status: {
      semantic_type: 'status_enum',
      ui_hints: {
        component: 'Badge',
        color_when_true: 'success',
        color_when_false: 'danger',
      },
    },
  },
  view_extensions: {
    list: [
      {
        component: 'StockBadge',
        props: {
          field: 'stock_status',
        },
        priority: 25,
      },
    ],
    detail: [
      {
        component: 'InventoryInfo',
        position: 'top',
        props: {
          showQuantity: true,
          showReorderPoint: true,
        },
        priority: 30,
      },
    ],
  },
  actions: [
    {
      name: 'adjustStock',
      label: 'Adjust Stock',
      icon: 'package',
    },
  ],
  tokens: {
    'stock-in-stock': '#28a745',
    'stock-low-stock': '#ffc107',
    'stock-out-of-stock': '#dc3545',
    'stock-discontinued': '#6c757d',
  },
};

// Define the Categorizable trait
const CategorizableTrait: TraitDefinition = {
  trait: {
    name: 'Categorizable',
    version: '1.0.0',
    description: 'Adds category management',
    category: 'content',
  },
  schema: {
    category_id: {
      type: 'uuid',
      required: false,
      description: 'Primary category ID',
    },
    categories: {
      type: 'array',
      required: false,
      default: [],
      description: 'Additional categories',
    },
  },
  semantics: {
    category_id: {
      semantic_type: 'reference',
      ui_hints: {
        component: 'CategoryPicker',
        referenceType: 'category',
      },
    },
  },
  view_extensions: {
    detail: [
      {
        component: 'CategoryBreadcrumb',
        position: 'top',
        priority: 5,
      },
    ],
  },
};

// Compose the Product object
export function createProductExample() {
  console.log('='.repeat(80));
  console.log('PRODUCT COMPOSITION EXAMPLE');
  console.log('='.repeat(80));
  console.log('');

  const compositor = new TraitCompositor({
    trackProvenance: true,
    trackPerformance: true,
  });

  const result = compositor.compose(
    [
      ColorizedTrait,
      PriceableTrait,
      InventoriedTrait,
      CategorizableTrait,
    ],
    {
      id: 'product',
      name: 'Product',
      schema: {
        id: { type: 'uuid', required: true },
        name: {
          type: 'string',
          required: true,
          description: 'Product name',
          validation: {
            minLength: 1,
            maxLength: 200,
          },
        },
        description: {
          type: 'string',
          required: false,
          description: 'Product description',
        },
        sku: {
          type: 'string',
          required: true,
          description: 'Stock Keeping Unit',
        },
        image_url: {
          type: 'url',
          required: false,
          description: 'Primary product image',
        },
        created_at: { type: 'timestamp', required: true },
        updated_at: { type: 'timestamp', required: true },
      },
    }
  );

  if (!result.success) {
    console.error('❌ Composition failed:', result.errors);
    return null;
  }

  console.log('✅ Composition successful!');
  console.log('');

  const composed = result.data!;

  // Show statistics
  console.log('COMPOSITION STATISTICS');
  console.log('-'.repeat(80));
  console.log(`Total Traits: ${composed.metadata.traitCount}`);
  console.log(`Trait Order: ${composed.metadata.traitOrder.join(' → ')}`);
  console.log(`Total Fields: ${Object.keys(composed.schema).length}`);
  console.log(`Collisions Resolved: ${composed.metadata.collisions.length}`);
  console.log(
    `Total Actions: ${composed.actions.length}`
  );
  console.log('');

  // Show tokens
  console.log('TOKENS');
  console.log('-'.repeat(80));
  const tokenCount = Object.keys(composed.tokens).length;
  console.log(`Total Tokens: ${tokenCount}`);
  if (tokenCount > 0) {
    for (const [tokenName, tokenValue] of Object.entries(composed.tokens)) {
      console.log(`  ${tokenName}: ${tokenValue}`);
    }
  }
  console.log('');

  // Show performance metrics
  if (composed.metadata.performance) {
    console.log('PERFORMANCE');
    console.log('-'.repeat(80));
    console.log(
      `Composition Duration: ${composed.metadata.performance.durationMs}ms`
    );
    console.log(
      `Fields Processed: ${composed.metadata.performance.fieldsProcessed}`
    );
    console.log(
      `View Extensions Processed: ${composed.metadata.performance.viewExtensionsProcessed}`
    );
    console.log('');
  }

  // Generate full report
  const report = compositor.generateReport(composed);
  console.log(report);

  return composed;
}

// Run the example
if (import.meta.url === `file://${process.argv[1]}`) {
  createProductExample();
}
