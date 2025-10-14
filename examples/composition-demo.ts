/**
 * Composition Demo
 *
 * Demonstrates the Trait Compositor with all features:
 * - Basic composition
 * - Collision resolution
 * - Dependency ordering
 * - Provenance tracking
 * - Performance metrics
 * - Report generation
 */

import { createSubscriptionExample } from './composed-objects/subscription.example.js';
import { createUserExample } from './composed-objects/user.example.js';
import { createProductExample } from './composed-objects/product.example.js';
import { generateFullVisualization } from '../src/utils/composition-visualizer.js';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

console.log('\n' + '='.repeat(80));
console.log('TRAIT COMPOSITOR DEMONSTRATION');
console.log('='.repeat(80));
console.log('\n');

// Example 1: Subscription
console.log('\n📝 Example 1: Subscription Composition\n');
const subscription = createSubscriptionExample();

if (subscription) {
  console.log('\n✨ Generating visualizations...\n');

  const subViz = generateFullVisualization(subscription);

  console.log('ASCII Flow Diagram:');
  console.log(subViz.ascii.flow);
  console.log('\n');

  console.log('Provenance Table:');
  console.log(subViz.ascii.provenance);
  console.log('\n');

  console.log('Mermaid Diagram:');
  console.log(subViz.mermaid);
  console.log('\n');

  // Save HTML report
  try {
    mkdirSync(join(process.cwd(), 'examples', 'reports'), { recursive: true });
    writeFileSync(
      join(process.cwd(), 'examples', 'reports', 'subscription-report.html'),
      subViz.html
    );
    console.log('✅ Saved HTML report to: examples/reports/subscription-report.html\n');
  } catch (error) {
    console.error('Failed to save HTML report:', error);
  }
}

console.log('\n' + '─'.repeat(80) + '\n');

// Example 2: User
console.log('\n👤 Example 2: User Composition\n');
const user = createUserExample();

if (user) {
  const userViz = generateFullVisualization(user);

  console.log('\nCollision Table:');
  console.log(userViz.ascii.collisions);
  console.log('\n');

  console.log('View Extensions:');
  console.log(userViz.ascii.viewExtensions);
  console.log('\n');

  // Save HTML report
  try {
    writeFileSync(
      join(process.cwd(), 'examples', 'reports', 'user-report.html'),
      userViz.html
    );
    console.log('✅ Saved HTML report to: examples/reports/user-report.html\n');
  } catch (error) {
    console.error('Failed to save HTML report:', error);
  }
}

console.log('\n' + '─'.repeat(80) + '\n');

// Example 3: Product
console.log('\n🛍️  Example 3: Product Composition\n');
const product = createProductExample();

if (product) {
  const productViz = generateFullVisualization(product);

  // Save all formats
  try {
    const reportsDir = join(process.cwd(), 'examples', 'reports');

    writeFileSync(
      join(reportsDir, 'product-report.html'),
      productViz.html
    );
    console.log('✅ Saved HTML report to: examples/reports/product-report.html');

    writeFileSync(
      join(reportsDir, 'product-schema.json'),
      productViz.json
    );
    console.log('✅ Saved JSON export to: examples/reports/product-schema.json');

    writeFileSync(
      join(reportsDir, 'product-diagram.md'),
      productViz.mermaid
    );
    console.log('✅ Saved Mermaid diagram to: examples/reports/product-diagram.md');

    console.log('\n');
  } catch (error) {
    console.error('Failed to save reports:', error);
  }
}

console.log('\n' + '='.repeat(80));
console.log('DEMONSTRATION COMPLETE');
console.log('='.repeat(80));
console.log('\n');
console.log('📊 Summary:');
console.log('  - 3 composed objects created');
console.log('  - Multiple collision resolutions demonstrated');
console.log('  - Dependency ordering validated');
console.log('  - Performance metrics tracked');
console.log('  - Reports generated in multiple formats');
console.log('\n');
console.log('📁 Check the examples/reports/ directory for generated reports');
console.log('\n');
