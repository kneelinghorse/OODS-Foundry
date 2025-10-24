#!/usr/bin/env tsx
/**
 * Audit Log Immutability Lint
 *
 * Scans SQL migrations to ensure we never issue UPDATE/DELETE/TRUNCATE
 * statements against the compliance.audit_log table.
 *
 * Mission B17.1 requirement: CI lint preventing mutation of the audit log.
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, '..', '..', 'database', 'migrations');
const TARGET_TABLE = 'compliance.audit_log';

const MUTATION_PATTERNS = [
  /\bUPDATE\s+compliance\.audit_log\b/i,
  /\bDELETE\s+FROM\s+compliance\.audit_log\b/i,
  /\bTRUNCATE\s+TABLE?\s+compliance\.audit_log\b/i,
];

function main(): void {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    return;
  }

  const files = fs.readdirSync(MIGRATIONS_DIR).filter((file) => file.endsWith('.sql'));
  const violations: Array<{ file: string; line: number; text: string }> = [];

  for (const file of files) {
    const filePath = path.join(MIGRATIONS_DIR, file);
    const contents = fs.readFileSync(filePath, 'utf8');
    const lines = contents.split('\n');

    lines.forEach((line, index) => {
      const normalized = line.replace(/\s+/g, ' ');
      for (const pattern of MUTATION_PATTERNS) {
        if (pattern.test(normalized)) {
          violations.push({
            file,
            line: index + 1,
            text: line.trim(),
          });
          return;
        }
      }
    });
  }

  if (violations.length > 0) {
    console.error('🚫 Audit log immutability violation detected:');
    for (const violation of violations) {
      console.error(
        `  ${violation.file}:${violation.line} → ${violation.text} (mutates ${TARGET_TABLE})`
      );
    }
    process.exit(1);
  }
}

main();
