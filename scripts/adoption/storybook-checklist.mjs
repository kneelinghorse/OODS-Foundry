#!/usr/bin/env node
/**
 * scripts/adoption/storybook-checklist.mjs
 * 
 * Generates a component parity checklist comparing OODS components to legacy.
 * Useful for Phase 2 adoption (Components & Contexts).
 * 
 * Usage:
 *   pnpm adoption:storybook-checklist [--phase=1|2|3|4]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../..');

// CLI arguments
const args = process.argv.slice(2);
const phase = args.find(a => a.startsWith('--phase='))?.split('=')[1] || '2';

/**
 * Phase 2: Component parity checklist
 */
const phase2Checklist = [
  {
    component: 'Button',
    checks: [
      'OODS variant matches legacy visually',
      'Hover/focus states use tokens',
      'Size variants (sm, md, lg) implemented',
      'Intent variants (primary, secondary, danger) implemented',
      'Accessibility: ARIA labels and roles',
      'Storybook stories cover all variants',
    ],
  },
  {
    component: 'Badge',
    checks: [
      'Status mapping 100% coverage',
      'Intent colors use semantic tokens',
      'Size variants match design specs',
      'HC mode renders with outline',
      'Storybook stories cover all statuses',
    ],
  },
  {
    component: 'Banner',
    checks: [
      'Intent variants (info, warning, error, success)',
      'Dismissible variant implemented',
      'Icon rendering uses semantic tokens',
      'HC mode readable',
      'Storybook stories cover all intents',
    ],
  },
  {
    component: 'TextField',
    checks: [
      'Validation states use tokens',
      'Error/helper text styling matches context',
      'Disabled state uses semantic tokens',
      'Placeholder text contrast passes WCAG AA',
      'Storybook stories cover validation scenarios',
    ],
  },
  {
    component: 'Select',
    checks: [
      'Dropdown positioning works in all contexts',
      'Validation states implemented',
      'Keyboard navigation (arrow keys, enter)',
      'Multi-select variant (if needed)',
      'Storybook stories cover all variants',
    ],
  },
  {
    component: 'Checkbox',
    checks: [
      'Checked/unchecked states use tokens',
      'Indeterminate state implemented',
      'Focus ring visible in HC mode',
      'Label alignment matches context density',
      'Storybook stories cover all states',
    ],
  },
  {
    component: 'Table',
    checks: [
      'Column headers use context typography',
      'Row hover state uses semantic tokens',
      'Pagination controls integrated',
      'Sorting indicators accessible',
      'Storybook stories show full table with data',
    ],
  },
  {
    component: 'Context Wrappers',
    checks: [
      'List context: compact density, tight spacing',
      'Detail context: default density, relaxed spacing',
      'Form context: relaxed line-height, explicit labels',
      'Timeline context: compact type, event markers',
      'Storybook stories demonstrate context switching',
    ],
  },
];

/**
 * Generate checklist markdown
 */
function generateChecklist() {
  const timestamp = new Date().toISOString();
  let output = `# Phase ${phase} Component Parity Checklist\n\n`;
  output += `**Generated:** ${timestamp}\n\n`;
  output += `This checklist tracks progress migrating components to OODS patterns.\n`;
  output += `Mark items complete as you verify parity between legacy and OODS components.\n\n`;
  output += `---\n\n`;

  for (const item of phase2Checklist) {
    output += `## ${item.component}\n\n`;
    for (const check of item.checks) {
      output += `- [ ] ${check}\n`;
    }
    output += '\n';
  }

  output += `---\n\n`;
  output += `## Validation Steps\n\n`;
  output += `After completing the checklist:\n\n`;
  output += `1. **Visual regression:**\n`;
  output += `   \`\`\`bash\n`;
  output += `   pnpm local:pr-check\n`;
  output += `   \`\`\``${''}\n\n`;
  output += `2. **Accessibility smoke test:**\n`;
  output += `   \`\`\`bash\n`;
  output += `   pnpm a11y:diff\n`;
  output += `   \`\`\``${''}\n\n`;
  output += `3. **Storybook verification:**\n`;
  output += `   - Launch Storybook: \`pnpm storybook\`\n`;
  output += `   - Toggle brand switcher (Brand A ↔ Brand B)\n`;
  output += `   - Toggle theme (light ↔ dark ↔ forced-colors)\n`;
  output += `   - Verify no visual regressions\n\n`;

  return output;
}

/**
 * Scan for existing components to pre-check items
 */
function detectCompletedItems() {
  const srcDir = path.join(rootDir, 'src/components');
  const detectedComponents = new Set();

  if (fs.existsSync(srcDir)) {
    const entries = fs.readdirSync(srcDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && /\.(tsx?|jsx?)$/.test(entry.name)) {
        const componentName = entry.name.replace(/\.(tsx?|jsx?)$/, '');
        detectedComponents.add(componentName);
      }
    }
  }

  return detectedComponents;
}

/**
 * Generate smart checklist with detected components pre-checked
 */
function generateSmartChecklist() {
  const detected = detectCompletedItems();
  const timestamp = new Date().toISOString();

  let output = `# Phase ${phase} Component Parity Checklist\n\n`;
  output += `**Generated:** ${timestamp}\n`;
  output += `**Auto-detected components:** ${Array.from(detected).join(', ') || 'None'}\n\n`;
  output += `---\n\n`;

  for (const item of phase2Checklist) {
    const isDetected = detected.has(item.component);
    output += `## ${item.component} ${isDetected ? '✅' : '⏳'}\n\n`;

    for (const check of item.checks) {
      // Auto-check first item if component is detected
      const checked = isDetected && check === item.checks[0] ? 'x' : ' ';
      output += `- [${checked}] ${check}\n`;
    }
    output += '\n';
  }

  output += `---\n\n`;
  output += `## Validation Steps\n\n`;
  output += `1. Complete all checklist items above\n`;
  output += `2. Run visual regression: \`pnpm local:pr-check\`\n`;
  output += `3. Run accessibility audit: \`pnpm a11y:diff\`\n`;
  output += `4. Verify in Storybook across brands/themes\n\n`;

  return output;
}

/**
 * Main execution
 */
async function main() {
  console.log(`📋 Generating Phase ${phase} Component Parity Checklist...\n`);

  const outputDir = path.join(rootDir, 'artifacts/adoption');
  fs.mkdirSync(outputDir, { recursive: true });

  const content = generateSmartChecklist();
  const outputFile = path.join(outputDir, `checklist-phase${phase}.md`);

  fs.writeFileSync(outputFile, content);

  console.log(`✅ Checklist generated!`);
  console.log(`📄 Saved to: ${outputFile.replace(rootDir + '/', '')}\n`);
}

main().catch(err => {
  console.error('Error generating checklist:', err);
  process.exit(1);
});

