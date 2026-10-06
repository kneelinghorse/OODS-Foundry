// Link-integrity predicates over a directed (source, target) link list — the data-shape
// half of F4 (sprint-148 m04), lifted here in sprint-172 m03 so its TWO consumers share
// one implementation:
//   - the mcp-server render/certify path builds the OODS-V147 message from findDanglingLinks;
//   - certify's OODS-V158 accuracy rule reads findDuplicateLinks.
// Re-typing either predicate on the second consumer would be the exact
// shared-function-not-transcription failure the process rules forbid.
//
// A duplicate is two links with the same DIRECTED pair — source->target and target->source
// are distinct (a reciprocal trade flow is valid data, not a duplicate). The dedup key is
// collision-safe via JSON.stringify, NOT ECharts' naive `${source}-${target}` concat, which
// collides whenever a node name contains '-'.

export interface LinkRef {
  readonly source: string;
  readonly target: string;
  readonly [key: string]: unknown;
}

export interface DuplicateLink {
  readonly source: string;
  readonly target: string;
  readonly count: number;
}

export function findDanglingLinks(nodeKeys: ReadonlySet<string>, links: readonly LinkRef[]): LinkRef[] {
  return links.filter((link) => !nodeKeys.has(link.source) || !nodeKeys.has(link.target));
}

export function findDuplicateLinks(links: readonly LinkRef[]): DuplicateLink[] {
  const counts = new Map<string, number>();
  for (const link of links) {
    const key = JSON.stringify([link.source, link.target]);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  // One entry per duplicated pair, emitted at the pair's FIRST appearance (input order).
  const emitted = new Set<string>();
  const duplicates: DuplicateLink[] = [];
  for (const link of links) {
    const key = JSON.stringify([link.source, link.target]);
    const count = counts.get(key) ?? 0;
    if (count > 1 && !emitted.has(key)) {
      emitted.add(key);
      duplicates.push({ source: link.source, target: link.target, count });
    }
  }
  return duplicates;
}
