#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

function readCoverage(filePath) {
  const resolved = path.resolve(filePath);
  const raw = fs.readFileSync(resolved, 'utf8');
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`Failed to parse JSON from ${resolved}: ${(error && error.message) || error}`);
  }
}

function fromSummary(data) {
  const results = [];
  for (const [file, metrics] of Object.entries(data)) {
    if (file === 'total' || !metrics?.lines) continue;
    const { total = 0, covered = 0, pct = 0 } = metrics.lines;
    const uncovered = Math.max(0, total - covered);
    results.push({ file, uncovered, total, pct });
  }
  return results;
}

function fromFinal(data) {
  const results = [];
  for (const [file, metrics] of Object.entries(data)) {
    if (!metrics?.statementMap || !metrics?.s) continue;

    const lineHits = new Map();
    for (const [id, location] of Object.entries(metrics.statementMap)) {
      const hitCount = metrics.s?.[id] ?? 0;
      const startLine = location.start?.line ?? 0;
      const endLine = location.end?.line ?? startLine;
      for (let line = startLine; line <= endLine; line += 1) {
        if (!line) continue;
        const covered = lineHits.get(line) ?? false;
        lineHits.set(line, covered || hitCount > 0);
      }
    }

    if (!lineHits.size) continue;

    let uncovered = 0;
    for (const covered of lineHits.values()) {
      if (!covered) uncovered += 1;
    }
    const total = lineHits.size;
    const pct = total ? ((total - uncovered) / total) * 100 : 100;
    results.push({ file, uncovered, total, pct });
  }
  return results;
}

function rankTopUncovered(results, limit) {
  return results
    .filter((entry) => entry.uncovered > 0)
    .sort((a, b) => {
      if (b.uncovered !== a.uncovered) return b.uncovered - a.uncovered;
      return a.pct - b.pct;
    })
    .slice(0, limit);
}

function main() {
  const [, , inputPath = 'coverage/coverage-final.json', limitArg] = process.argv;
  const limit = Number(limitArg ?? 5) || 5;

  const data = readCoverage(inputPath);
  const results = 'total' in data ? fromSummary(data) : fromFinal(data);
  if (!results.length) {
    console.log('No coverage entries found.');
    return;
  }

  const top = rankTopUncovered(results, limit);
  if (!top.length) {
    console.log('All files fully covered 🎉');
    return;
  }

  console.log(`Top ${top.length} uncovered files (by uncovered lines):`);
  top.forEach((entry, index) => {
    const pct = `${entry.pct.toFixed(2)}%`;
    const relPath = path.relative(process.cwd(), entry.file);
    console.log(
      `${index + 1}. ${relPath} — uncovered ${entry.uncovered}/${entry.total} lines (coverage ${pct})`
    );
  });
}

main();
