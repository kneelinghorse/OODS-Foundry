import type { Slot } from './templates/types.js';

export interface IntentSection {
  index: number;
  heading?: string;
  body: string;
  source: 'paragraph' | 'headed' | 'enumerated' | 'sentence';
  keywords: string[];
}

export interface ParsedIntentSections {
  summary: string;
  sections: IntentSection[];
  isLongForm: boolean;
}

export interface DashboardSectionSlot {
  slotName: string;
  description: string;
  intent: string;
  required: boolean;
  title?: string;
  zone: 'metrics' | 'main' | 'sidebar';
  context: string[];
}

export interface DashboardSectionPlan {
  expanded: boolean;
  metrics: DashboardSectionSlot[];
  main: DashboardSectionSlot[];
  sidebar: DashboardSectionSlot[];
  slots: DashboardSectionSlot[];
}

const STOPWORDS = new Set([
  'a', 'an', 'and', 'the', 'for', 'with', 'that', 'this', 'from', 'into', 'used',
  'should', 'include', 'showing', 'shows', 'show', 'used', 'monitor', 'page',
  'panel', 'section', 'sections', 'dashboard', 'view', 'list', 'form',
]);

const METRIC_KEYWORDS = ['kpi', 'metric', 'metrics', 'score', 'revenue', 'churn', 'nps', 'users', 'growth', 'arr', 'mrr'];
const EXPLICIT_METRIC_KEYWORDS = ['kpi', 'metric', 'metrics', 'scorecard', 'score'];
const SIDEBAR_KEYWORDS = ['alert', 'alerts', 'incident', 'incidents', 'health', 'sidebar', 'filter', 'filters', 'severity', 'uptime'];
const MAIN_CONTENT_KEYWORDS = ['feed', 'chart', 'map', 'activity', 'orders', 'order', 'projection', 'projections', 'timeline', 'table', 'trend', 'forecast', 'heat'];
const TABLE_KEYWORDS = ['table', 'orders', 'order', 'rows', 'catalog', 'inventory', 'grid'];
const LIST_KEYWORDS = ['feed', 'timeline', 'log', 'event', 'events', 'stream', 'alerts', 'incidents', 'history'];
const STATUS_KEYWORDS = ['health', 'status', 'severity', 'uptime', 'availability', 'incident', 'alert'];
const MAX_DASHBOARD_SECTIONS = {
  metrics: 4,
  main: 6,
  sidebar: 3,
} as const;

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function tokenize(value: string): string[] {
  return normalizeWhitespace(value)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 1 && !STOPWORDS.has(token));
}

function deriveHeading(body: string): string | undefined {
  const normalized = normalizeWhitespace(body);
  const sectionMatch = normalized.match(/^(?:a|an)\s+(.+?)\s+section\b/i);
  if (sectionMatch) return sectionMatch[1];

  const clauseMatch = normalized.match(/^(?:a|an)\s+(.+?)\s+(?:showing|listing|with|for)\b/i);
  if (clauseMatch) return clauseMatch[1];

  const words = normalized.split(/\s+/).slice(0, 4);
  return words.length > 0 ? words.join(' ') : undefined;
}

function buildSection(
  sections: IntentSection[],
  seen: Set<string>,
  body: string,
  source: IntentSection['source'],
  heading?: string,
): void {
  const normalizedBody = normalizeWhitespace(body);
  if (normalizedBody.length < 12) return;

  const key = normalizedBody.toLowerCase();
  if (seen.has(key)) return;
  seen.add(key);

  const normalizedHeading = heading ? normalizeWhitespace(heading.replace(/:$/, '')) : deriveHeading(normalizedBody);
  sections.push({
    index: sections.length,
    heading: normalizedHeading || undefined,
    body: normalizedBody,
    source,
    keywords: Array.from(new Set(tokenize(`${normalizedHeading ?? ''} ${normalizedBody}`))),
  });
}

export function parseIntentSections(intent: string): ParsedIntentSections {
  const normalizedIntent = normalizeWhitespace(intent);
  const summary = normalizeWhitespace(normalizedIntent.split(/[:.;]/)[0] ?? normalizedIntent);
  const sections: IntentSection[] = [];
  const seen = new Set<string>();

  if (!normalizedIntent) {
    return { summary: '', sections: [], isLongForm: false };
  }

  if (/\n\s*\n/.test(intent)) {
    const blocks = intent.split(/\n\s*\n/).map((block) => block.trim()).filter(Boolean);
    for (let index = 0; index < blocks.length; index++) {
      const block = blocks[index];
      const lines = block.split('\n').map((line) => line.trim()).filter(Boolean);
      if (lines.length === 0) continue;
      if (lines.length === 1 && blocks.length > 1 && index === 0) continue;

      const heading = lines[0].endsWith(':') ? lines[0].slice(0, -1) : undefined;
      const body = heading ? lines.slice(1).join(' ') : lines.join(' ');
      buildSection(sections, seen, body || lines[0], 'paragraph', heading);
    }
  }

  if (sections.length === 0) {
    for (const match of normalizedIntent.matchAll(/([A-Z][A-Za-z0-9 /&-]{2,40}):\s*([^;.\n]+)(?=[;.]|$)/g)) {
      buildSection(sections, seen, match[2], 'headed', match[1]);
    }

    for (const match of normalizedIntent.matchAll(/(?:^|;\s*)(\d+[\)\.])\s*([^;]+?)(?=(?:;\s*\d+[\)\.])|$)/g)) {
      buildSection(sections, seen, match[2], 'enumerated');
    }
  }

  if (sections.length === 0 && /(?:;|\. )/.test(normalizedIntent) && normalizedIntent.length > 180) {
    const sentences = normalizedIntent
      .split(/;\s*|\.\s+(?=[A-Z])/)
      .map((sentence) => sentence.trim())
      .filter((sentence) => sentence.length > 20);
    for (const sentence of sentences) {
      buildSection(sections, seen, sentence, 'sentence');
    }
  }

  return {
    summary,
    sections,
    isLongForm: sections.length >= 2,
  };
}

function overlapCount(a: string[], b: string[]): number {
  const setB = new Set(b);
  return a.reduce((count, token) => count + (setB.has(token) ? 1 : 0), 0);
}

function matchesAny(keywords: string[], tokens: string[]): boolean {
  const set = new Set(tokens);
  return keywords.some((keyword) => set.has(keyword));
}

function scoreSectionForSlot(section: IntentSection, slot: Slot): number {
  const slotTokens = tokenize(`${slot.intent} ${slot.description} ${slot.name}`);
  let score = overlapCount(slotTokens, section.keywords);

  if (slot.intent === 'metrics-display' && matchesAny(METRIC_KEYWORDS, section.keywords)) {
    score += 4;
  }

  if (slot.name === 'sidebar' || slot.intent === 'navigation-panel') {
    if (matchesAny(SIDEBAR_KEYWORDS, section.keywords)) score += 4;
  }

  if (slot.name === 'main-content' || slot.intent === 'data-display' || slot.intent === 'data-list') {
    if (matchesAny(MAIN_CONTENT_KEYWORDS, section.keywords)) score += 3;
    if (!matchesAny(METRIC_KEYWORDS, section.keywords) && !matchesAny(SIDEBAR_KEYWORDS, section.keywords)) {
      score += 1;
    }
  }

  if (slot.name === 'header' && section.index === 0) {
    score += 2;
  }

  return score;
}

function describeSection(section: IntentSection): string {
  return section.heading ? `${section.heading}: ${section.body}` : section.body;
}

function classifyDashboardSectionZone(section: IntentSection): DashboardSectionSlot['zone'] {
  const explicitMetricSignals = overlapCount(EXPLICIT_METRIC_KEYWORDS, section.keywords);
  const metricSignals = overlapCount(METRIC_KEYWORDS, section.keywords);
  const sidebarSignals = overlapCount(SIDEBAR_KEYWORDS, section.keywords);
  const mainSignals = overlapCount(MAIN_CONTENT_KEYWORDS, section.keywords);

  if (explicitMetricSignals > 0) {
    return 'metrics';
  }

  if (sidebarSignals > 0 && sidebarSignals > mainSignals) {
    return 'sidebar';
  }

  if (mainSignals > 0) {
    return 'main';
  }

  if (metricSignals > 1) {
    return 'metrics';
  }

  if (sidebarSignals > 0) {
    return 'sidebar';
  }

  if (metricSignals > 0) {
    return 'metrics';
  }

  return 'main';
}

function inferDashboardSectionIntent(
  section: IntentSection,
  zone: DashboardSectionSlot['zone'],
): string {
  if (zone === 'metrics') {
    return 'metrics-display';
  }

  if (overlapCount(TABLE_KEYWORDS, section.keywords) > 0) {
    return 'data-table';
  }

  if (overlapCount(LIST_KEYWORDS, section.keywords) > 0) {
    return 'data-list';
  }

  if (zone === 'sidebar' || overlapCount(STATUS_KEYWORDS, section.keywords) > 0) {
    return 'metadata-display';
  }

  return 'data-display';
}

function buildDashboardSlotName(
  zone: DashboardSectionSlot['zone'],
  index: number,
): string {
  switch (zone) {
    case 'metrics':
      return index === 0 ? 'metrics' : `metrics-section-${index}`;
    case 'main':
      return index === 0 ? 'main-content' : `main-section-${index}`;
    case 'sidebar':
      return index === 0 ? 'sidebar' : `sidebar-section-${index}`;
  }
}

function buildDashboardSlotDescription(
  zone: DashboardSectionSlot['zone'],
  title: string | undefined,
): string {
  if (title) {
    return `${title} dashboard section`;
  }

  switch (zone) {
    case 'metrics':
      return 'Metric display cards';
    case 'main':
      return 'Primary dashboard content';
    case 'sidebar':
      return 'Supporting dashboard side content';
  }
}

function buildDashboardSectionSlot(
  section: IntentSection,
  zone: DashboardSectionSlot['zone'],
  index: number,
): DashboardSectionSlot {
  const title = section.heading ?? deriveHeading(section.body);
  return {
    slotName: buildDashboardSlotName(zone, index),
    description: buildDashboardSlotDescription(zone, title),
    intent: inferDashboardSectionIntent(section, zone),
    required: true,
    title,
    zone,
    context: [describeSection(section)],
  };
}

export function buildDashboardSectionPlan(parsed: ParsedIntentSections): DashboardSectionPlan {
  if (!parsed.isLongForm) {
    return {
      expanded: false,
      metrics: [],
      main: [],
      sidebar: [],
      slots: [],
    };
  }

  const bucketed: Record<DashboardSectionSlot['zone'], IntentSection[]> = {
    metrics: [],
    main: [],
    sidebar: [],
  };

  for (const section of parsed.sections) {
    const zone = classifyDashboardSectionZone(section);
    if (bucketed[zone].length >= MAX_DASHBOARD_SECTIONS[zone]) continue;
    bucketed[zone].push(section);
  }

  const metrics = bucketed.metrics.map((section, index) => buildDashboardSectionSlot(section, 'metrics', index));
  const main = bucketed.main.map((section, index) => buildDashboardSectionSlot(section, 'main', index));
  const sidebar = bucketed.sidebar.map((section, index) => buildDashboardSectionSlot(section, 'sidebar', index));

  return {
    expanded: metrics.length > 1 || main.length > 1 || sidebar.length > 1,
    metrics,
    main,
    sidebar,
    slots: [...metrics, ...main, ...sidebar],
  };
}

export function buildSlotContextOverridesFromSections(
  slots: Slot[],
  parsed: ParsedIntentSections,
): Map<string, string[]> {
  const overrides = new Map<string, string[]>();
  if (!parsed.isLongForm) return overrides;

  for (const slot of slots) {
    if (slot.name === 'header') {
      overrides.set(slot.name, [parsed.summary]);
      continue;
    }

    const ranked = parsed.sections
      .map((section) => ({ section, score: scoreSectionForSlot(section, slot) }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score || a.section.index - b.section.index)
      .slice(0, slot.name === 'main-content' ? 2 : 1)
      .map((entry) => entry.section.heading ? `${entry.section.heading}: ${entry.section.body}` : entry.section.body);

    if (ranked.length > 0) {
      overrides.set(slot.name, ranked);
    }
  }

  return overrides;
}

export function prefersDashboardLayout(parsed: ParsedIntentSections): boolean {
  if (!parsed.isLongForm) return false;

  const sectionKeywords = parsed.sections.flatMap((section) => section.keywords);
  const metricSignals = overlapCount(METRIC_KEYWORDS, sectionKeywords);
  const mainSignals = overlapCount(MAIN_CONTENT_KEYWORDS, sectionKeywords);

  return parsed.sections.length >= 3 && (metricSignals > 0 || mainSignals > 1);
}
