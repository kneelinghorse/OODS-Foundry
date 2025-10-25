#!/usr/bin/env node
/**
 * scripts/adoption/audit.mjs
 * 
 * Brownfield adoption gap analysis tool.
 * Scans the codebase for OODS integration readiness and generates a report.
 * 
 * Usage:
 *   pnpm adoption:audit [--focus=tokens|components|objects|compliance]
 *   pnpm adoption:audit --format=json --threshold=high
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../..');

// CLI arguments
const args = process.argv.slice(2);
const focus = args.find(a => a.startsWith('--focus='))?.split('=')[1] || 'all';
const format = args.find(a => a.startsWith('--format='))?.split('=')[1] || 'markdown';
const threshold = args.find(a => a.startsWith('--threshold='))?.split('=')[1] || 'low';

// Severity levels
const SEVERITY = {
  high: 3,
  medium: 2,
  low: 1,
};

const thresholdLevel = SEVERITY[threshold] || SEVERITY.low;

/**
 * Audit results structure
 */
const auditResults = {
  timestamp: new Date().toISOString(),
  focus,
  format,
  threshold,
  phases: {},
  summary: {
    total: 0,
    high: 0,
    medium: 0,
    low: 0,
  },
};

/**
 * Phase 1: Tokens & Theming Audit
 */
function auditTokens() {
  const findings = [];

  // Check for semantic token usage
  const srcDir = path.join(rootDir, 'src');
  const componentsWithLiterals = scanForHexLiterals(srcDir);

  if (componentsWithLiterals.length > 0) {
    findings.push({
      severity: 'high',
      category: 'tokens',
      title: 'Components using hex literals instead of semantic tokens',
      description: `Found ${componentsWithLiterals.length} files with hardcoded color values`,
      files: componentsWithLiterals,
      remediation: 'Replace hex colors with CSS variables from tokens.css',
    });
  }

  // Check for token coverage
  const tokenFiles = [
    'packages/tokens/src/tokens/base/reference/color.brand.json',
    'packages/tokens/src/tokens/themes/theme0/color.json',
    'packages/tokens/src/tokens/themes/dark/color.json',
  ];

  const missingTokenFiles = tokenFiles.filter(f => !fs.existsSync(path.join(rootDir, f)));

  if (missingTokenFiles.length > 0) {
    findings.push({
      severity: 'medium',
      category: 'tokens',
      title: 'Missing token files',
      description: `${missingTokenFiles.length} expected token files not found`,
      files: missingTokenFiles,
      remediation: 'Run pnpm tokens:export && pnpm tokens:transform',
    });
  }

  // Check for brand switcher
  const hasBrandSwitcher = fs.existsSync(path.join(rootDir, 'src/hooks/useBrand.ts')) ||
                          fs.existsSync(path.join(rootDir, 'src/hooks/useBrand.tsx'));

  if (!hasBrandSwitcher) {
    findings.push({
      severity: 'low',
      category: 'tokens',
      title: 'Brand switcher not implemented',
      description: 'useBrand hook not found in src/hooks/',
      remediation: 'Implement useBrand hook for multi-brand support',
    });
  }

  return findings;
}

/**
 * Phase 2: Components & Contexts Audit
 */
function auditComponents() {
  const findings = [];

  // Check for context providers
  const hasContextProvider = searchInFiles(path.join(rootDir, 'src'), /ContextProvider|useContext/);

  if (!hasContextProvider) {
    findings.push({
      severity: 'high',
      category: 'components',
      title: 'No context providers found',
      description: 'Components not using contextual styling (list/detail/form/timeline)',
      remediation: 'Wrap feature areas with <ContextProvider context="...">',
    });
  }

  // Check for statusables pattern
  const hasStatusables = searchInFiles(
    path.join(rootDir, 'src/components'),
    /Badge|Banner|Toast/
  );

  if (!hasStatusables) {
    findings.push({
      severity: 'medium',
      category: 'components',
      title: 'Statusables components not found',
      description: 'No Badge, Banner, or Toast components detected',
      remediation: 'Import statusables from @oods/react-components',
    });
  }

  return findings;
}

/**
 * Phase 3: Objects & Domain Logic Audit
 */
function auditObjects() {
  const findings = [];

  // Check for object definitions
  const objectsDir = path.join(rootDir, 'objects');
  
  if (!fs.existsSync(objectsDir)) {
    findings.push({
      severity: 'high',
      category: 'objects',
      title: 'No objects directory found',
      description: 'Missing objects/ directory for domain object definitions',
      remediation: 'Create objects/custom/ and define your domain objects',
    });
  } else {
    const objectFiles = walkDir(objectsDir, '.yaml');
    
    if (objectFiles.length === 0) {
      findings.push({
        severity: 'medium',
        category: 'objects',
        title: 'No custom object definitions',
        description: 'objects/ directory exists but contains no .yaml files',
        remediation: 'Define domain objects following authoring-objects.md guide',
      });
    }
  }

  // Check for validation integration
  const hasValidation = searchInFiles(
    path.join(rootDir, 'src'),
    /validateObject|@oods\/trait-engine\/validation/
  );

  if (!hasValidation) {
    findings.push({
      severity: 'low',
      category: 'objects',
      title: 'Validation pipeline not integrated',
      description: 'No usage of validateObject found in API layer',
      remediation: 'Wire validateObject into API endpoints',
    });
  }

  return findings;
}

/**
 * Phase 4: Compliance & Governance Audit
 */
function auditCompliance() {
  const findings = [];

  // Check for RBAC service
  const hasRBAC = searchInFiles(
    path.join(rootDir, 'src'),
    /RBACService|checkPermission|grantRole/
  );

  if (!hasRBAC) {
    findings.push({
      severity: 'high',
      category: 'compliance',
      title: 'RBAC service not integrated',
      description: 'No usage of RBACService found in codebase',
      remediation: 'Import and use RBACService from @oods/trait-engine/services/compliance',
    });
  }

  // Check for audit logging
  const hasAudit = searchInFiles(
    path.join(rootDir, 'src'),
    /AuditLogService|audit\.record/
  );

  if (!hasAudit) {
    findings.push({
      severity: 'medium',
      category: 'compliance',
      title: 'Audit logging not integrated',
      description: 'No usage of AuditLogService found in codebase',
      remediation: 'Record critical actions via AuditLogService',
    });
  }

  // Check for tenancy context
  const hasTenancy = searchInFiles(
    path.join(rootDir, 'src'),
    /TenancyContext|withTenant/
  );

  if (!hasTenancy) {
    findings.push({
      severity: 'low',
      category: 'compliance',
      title: 'Tenancy isolation not configured',
      description: 'No usage of TenancyContext found in data access layer',
      remediation: 'Wrap database queries with TenancyContext.create(tenantId).withTenant()',
    });
  }

  // Check for database migration
  const migrationFile = path.join(rootDir, 'database/migrations/20251024_171_compliance_core.sql');
  
  if (!fs.existsSync(migrationFile)) {
    findings.push({
      severity: 'high',
      category: 'compliance',
      title: 'Compliance core migration not run',
      description: 'Database migration for RBAC/audit tables not found',
      remediation: 'Run pnpm db:migrate --file=20251024_171_compliance_core.sql',
    });
  }

  return findings;
}

/**
 * Utility: Scan for hex color literals in source files
 */
function scanForHexLiterals(dir) {
  const hexPattern = /#[0-9a-fA-F]{3,8}/;
  const files = walkDir(dir, '.tsx', '.ts', '.jsx', '.js');
  const matches = [];

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');
    if (hexPattern.test(content)) {
      matches.push(file.replace(rootDir + '/', ''));
    }
  }

  return matches;
}

/**
 * Utility: Search for pattern in files
 */
function searchInFiles(dir, pattern) {
  if (!fs.existsSync(dir)) return false;

  const files = walkDir(dir, '.tsx', '.ts', '.jsx', '.js');

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');
    if (pattern.test(content)) {
      return true;
    }
  }

  return false;
}

/**
 * Utility: Walk directory recursively
 */
function walkDir(dir, ...extensions) {
  if (!fs.existsSync(dir)) return [];

  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      // Skip node_modules, .git, dist, build
      if (['node_modules', '.git', 'dist', 'build', 'coverage'].includes(entry.name)) {
        continue;
      }
      results.push(...walkDir(fullPath, ...extensions));
    } else if (entry.isFile()) {
      if (extensions.length === 0 || extensions.some(ext => entry.name.endsWith(ext))) {
        results.push(fullPath);
      }
    }
  }

  return results;
}

/**
 * Aggregate findings by phase
 */
function aggregateFindings() {
  const phases = {
    tokens: focus === 'all' || focus === 'tokens' ? auditTokens() : [],
    components: focus === 'all' || focus === 'components' ? auditComponents() : [],
    objects: focus === 'all' || focus === 'objects' ? auditObjects() : [],
    compliance: focus === 'all' || focus === 'compliance' ? auditCompliance() : [],
  };

  // Filter by threshold
  for (const [phase, findings] of Object.entries(phases)) {
    auditResults.phases[phase] = findings.filter(
      f => SEVERITY[f.severity] >= thresholdLevel
    );
  }

  // Compute summary
  for (const findings of Object.values(auditResults.phases)) {
    for (const finding of findings) {
      auditResults.summary.total++;
      auditResults.summary[finding.severity]++;
    }
  }
}

/**
 * Format output
 */
function formatMarkdown() {
  let output = '# OODS Brownfield Adoption Audit Report\n\n';
  output += `**Timestamp:** ${auditResults.timestamp}\n`;
  output += `**Focus:** ${focus}\n`;
  output += `**Threshold:** ${threshold}\n\n`;

  output += '## Summary\n\n';
  output += `- **Total Findings:** ${auditResults.summary.total}\n`;
  output += `- **High Severity:** ${auditResults.summary.high}\n`;
  output += `- **Medium Severity:** ${auditResults.summary.medium}\n`;
  output += `- **Low Severity:** ${auditResults.summary.low}\n\n`;

  for (const [phase, findings] of Object.entries(auditResults.phases)) {
    if (findings.length === 0) continue;

    output += `## Phase: ${phase.charAt(0).toUpperCase() + phase.slice(1)}\n\n`;

    for (const finding of findings) {
      output += `### ${finding.title} [${finding.severity.toUpperCase()}]\n\n`;
      output += `**Description:** ${finding.description}\n\n`;
      if (finding.files && finding.files.length > 0) {
        output += `**Affected Files:**\n`;
        for (const file of finding.files.slice(0, 5)) {
          output += `- ${file}\n`;
        }
        if (finding.files.length > 5) {
          output += `- ... and ${finding.files.length - 5} more\n`;
        }
        output += '\n';
      }
      output += `**Remediation:** ${finding.remediation}\n\n`;
      output += '---\n\n';
    }
  }

  if (auditResults.summary.total === 0) {
    output += '## ✅ No Issues Found\n\n';
    output += 'Your codebase meets the adoption criteria for the selected phase(s).\n';
  }

  return output;
}

function formatJSON() {
  return JSON.stringify(auditResults, null, 2);
}

/**
 * Main execution
 */
async function main() {
  console.log('🔍 Running OODS Brownfield Adoption Audit...\n');
  console.log(`Focus: ${focus}`);
  console.log(`Format: ${format}`);
  console.log(`Threshold: ${threshold}\n`);

  // Run audits
  aggregateFindings();

  // Generate output
  const outputDir = path.join(rootDir, 'artifacts/adoption');
  fs.mkdirSync(outputDir, { recursive: true });

  let outputContent;
  let outputFile;

  if (format === 'json') {
    outputContent = formatJSON();
    outputFile = path.join(outputDir, 'audit-report.json');
  } else {
    outputContent = formatMarkdown();
    outputFile = path.join(outputDir, 'audit-report.md');
  }

  fs.writeFileSync(outputFile, outputContent);

  console.log(`✅ Audit complete!`);
  console.log(`📄 Report saved to: ${outputFile.replace(rootDir + '/', '')}\n`);

  // Print summary
  console.log('Summary:');
  console.log(`  Total Findings: ${auditResults.summary.total}`);
  console.log(`  High Severity: ${auditResults.summary.high}`);
  console.log(`  Medium Severity: ${auditResults.summary.medium}`);
  console.log(`  Low Severity: ${auditResults.summary.low}\n`);

  // Exit with non-zero if high-severity findings
  if (auditResults.summary.high > 0) {
    console.error('⚠️  High-severity findings detected. Review report for details.');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Error running audit:', err);
  process.exit(1);
});

