/**
 * s213-m02 (#2350): capability sentences on the surfaces Forge serves are checked against the tool ledger and the receipts, not
 * only generated from them. Each rule names a kind of capability claim, finds the sentences that make it, and allows
 * them only as far as the evidence supports: the frameworks the served runtime sweep generated and ran, what the ledger
 * says artifact.certify covers, the real-client preview runs on record, and so on. When evidence grows (a Claude Desktop
 * receipt, an HTML runtime cell), the matching rule allows more without an edit here. `pnpm docs:claims -- --check` runs
 * it over every surface; an injected unsupported sentence fails it (tests/verification/capability-claims.s213.test.ts).
 */
import fs from 'node:fs';
import { verifyPackedFidelity } from '../product-reality/s215-packed-receipts.js';
import { verifyHtmlReceipts } from '../product-reality/s215-html-receipts.js';
import { verifyFidelityProof } from '../product-reality/s215-fidelity-receipts.js';
import { createHash } from 'node:crypto';
import path from 'node:path';
// @ts-expect-error -- the link checker is native ESM.
import { checkLinks, reachable } from './check-links.mjs';

export type Surface = { file: string; text: string; definedBy?: string };
export type Evidence = {
  /** Frameworks with passing cells in the served runtime sweep (packages/mcp-server/registry/runtime-cells.v1.json). */
  frameworks: string[];
  /** Whether the ledger still records that artifact.certify covers chart specifications only. */
  certifyChartsOnly: boolean;
  /** Whether the ledger still records design.compose matching sentences against keyword tables. */
  composeKeywordTables: boolean;
  /** Files beside the README in the folder that holds real-host preview receipts (Claude Desktop, Cursor). */
  observedPreviewHosts: string[];
  /** SDK basic-host observation with explicit UI override; never a Claude Desktop/Cursor receipt. */
  sdkPreviewHost?: boolean;
  /** Whether the packed-runtime proof of a team's own objects and traits passed (s213-m03). */
  ownDefinitions: boolean;
  /** Whether the source-checkout proof that a brand's three files make it a brand everywhere passed (s213-m04). */
  brandRegistry: boolean;
  /** Whether the source-checkout proof of a brand made from a team's tokens through brand.intake passed (s213-m05). */
  brandIntake: boolean;
  /** Whether the packed-runtime proof of a team's brand built outside the runtime passed (s213-m06). */
  teamBrands: boolean;
  /** Named external libraries proven by the component journey receipt (s214). */
  componentLibraries?: string[];
  ownComponents?: boolean;
  fidelityViews?: boolean;
  packedFidelity?: boolean;
  htmlMeasurement?: { cells: number; pass: number; fail: number };
  componentContractReports?: boolean;
};
export type Finding = { file: string; rule: string; sentence: string };
type Rule = { id: string; why: string; flags: (sentence: string, evidence: Evidence) => boolean };

const UI_FRAMEWORKS = ['React', 'Vue', 'Svelte', 'Angular', 'SwiftUI', 'Flutter', 'SolidJS', 'Solid', 'Lit', 'Ember', 'Qwik', 'Preact', 'Jetpack Compose'];
const HTML_QUALIFIERS = /\b(outline|without data|static|refused|refuses|placeholder|not a generation target)\b|\bHTML-mapped\b/i;
const HOST_QUALIFIERS = /\b(documentation|not yet tried|not been tried|has not been tried|test hosts?|could|no Claude Desktop or Cursor run|never observed)\b/i;
const TEAM_DEFINITIONS = /\b(your|a team's|team's|their) own\b[^.;]*?\b(objects?|traits?)\b/i;
const BRAND_REGISTRY = /\bbrand registry\b|\bbrands folder\b|\badd (its|a brand's) three files\b/i;
const DENIES_BRAND_REGISTRY = /\bonly brands A and B\b|\b(accepts|pass|takes|select|edits?|exports?[^.]*for) brands? A or B\b|\bbrand \(?A\|B\b|\bbrand:\s*'A'\s*\|\s*'B'|\bA\/B (source|light(-scope)? tokens|themes)\b|\bnew brand\b[^.]*\bediting Forge's source\b|\bediting Forge's source\b[^.]*\bbrand\b/i;
const BRAND_INTAKE = /\b(?:brand[._]intake|brand_create)\b[^.]*\b(creat(e|es|ed|ing)|writes? a brand|makes? a brand)\b|\b(creat(e|es|ing)|mak(e|es|ing)) a brand from (your|a team's|their) own\b/i;
const DENIES_BRAND_INTAKE = /\b(?:brand[._]intake|brand_create)\b[^.]*\b(preview[- ]only|dry[- ]run only|no brand creation|never creates|(a|consumable) delta|envelope hash)\b|\bpreview[- ]only\b[^.]*\bintake\b|\bintake\b[^.]*\bpreview[- ]only\b|\benvelope ?hash\b|\bno (brand[- ]creation|preset-loading) path\b|\bno tool loads (them|the presets)\b|\bpresets?\b[^.]*\bnot shipped\b/i;
const TEAM_BRANDS = /\b(your|a team's|team's|their) own\b[^.;]*\bbrands?\b|\bbrands? of yours\b|~\/\.oods-foundry\/brands\b/i;
const DENIES_TEAM_BRANDS = /\b(your|a team's|team's|their) own\b[^.;]*\bbrands?\b[^.;]*\b(not supported|needs? a source checkout)\b|\bnpm runtime does not ship\b|\bruntime ships no token build\b/i;
const DENIES_TEAM_DEFINITIONS = /\b(your|a team's|team's|their) own\b[^.;]*?\b(objects?|traits?)\b[^.;]*\b(not supported|needs? a source checkout|in a source checkout|no folder)\b|\bsource checkout\b[^.]*\b(you add your own|a team's own)\b|\bno folder for a team's own objects\b/i;

export const CAPABILITY_RULES: readonly Rule[] = Object.freeze([
  {
    id: 'compose-confidence',
    why: 'Keyword composition cannot promise measured placement scores where the current composer omits them.',
    flags: (sentence, evidence) => evidence.composeKeywordTables
      && /per-slot confidence|component chosen, its confidence|confidence score for every/i.test(sentence)
      && !/omitt|missing|not inferred|when available|only recorded/i.test(sentence),
  },
  {
    id: 'fidelity-inputs',
    why: 'Current source-bound fidelity proof covers Forge objects and shipped fixtures; the old blanket denial is stale.',
    flags: (sentence, evidence) => evidence.fidelityViews === true
      && /fidelity[._]preview.*not a Forge object|named fixtures are not shipped/i.test(sentence)
      && !/historical|legacy input|older archive/i.test(sentence),
  },
  {
    id: 'generation-target',
    why: 'A sentence that says Forge generates a UI framework must name only frameworks the runtime sweep generated and ran.',
    flags: (sentence, evidence) => {
      if (!/\bgenerat(e|es|ed|ing|ion)\b/i.test(sentence)) return false;
      const named = UI_FRAMEWORKS.filter(name => new RegExp(`\\b${name}\\b`).test(sentence));
      return named.some(name => !evidence.frameworks.includes(name.toLowerCase()));
    },
  },
  {
    id: 'html-generation',
    why: 'HTML output is a static sample document; browser coverage must be measured separately before a sentence claims framework parity.',
    flags: (sentence, evidence) => !evidence.frameworks.includes('html') && /\bgenerat(e|es|ed|ing|ion)\b/i.test(sentence)
      && /\b(React|Vue)\b/.test(sentence) && /\bHTML\b/.test(sentence) && !HTML_QUALIFIERS.test(sentence),
  },
  {
    id: 'certify-scope',
    why: 'artifact.certify certifies chart specifications only; a certifying sentence that names no chart claims more.',
    // "Certifies X" or "X is certified" where X is a screen, app, page, component, code or output rather than a chart.
    // Reviews and sprints are certified too, and nouns ("a certification you disagree with") claim nothing.
    flags: (sentence, evidence) => evidence.certifyChartsOnly && !sentence.startsWith('|') && !/\b(never|not|cannot|does not|doesn't)\s+certif/i.test(sentence) && (
      /\bcertif(y|ies|ied)\s+(the |every |each |its |your |all |any |generated |composed |a |an )*(screens?|apps?|applications?|pages?|components?|code|HTML|documents?|UI|output|everything|what it (produced|made|generated))\b/i.test(sentence)
      || /\b(screens?|apps?|applications?|pages?|components?|code|HTML|documents?|UI|output)\s+(is|are|gets?|was|were)\s+(also\s+)?certified\b/i.test(sentence)),
  },
  {
    id: 'natural-language',
    why: 'design.compose matches intent sentences against keyword tables; "natural language" claims understanding it does not have.',
    flags: (sentence, evidence) => evidence.composeKeywordTables
      && /natural[- ]language\b[^.]*\b(intent|desired UI|request|prompt)\b|\b(intent|compose|composition)\b[^.]*\bnatural[- ]language\b/i.test(sentence)
      && !/\bnot\b[^.]*natural[- ]language|natural[- ]language[^.]*\bnot\b/i.test(sentence),
  },
  {
    id: 'proof-tier',
    why: 'Where a test file sits is not proof; "product-reality" or a "proof tier" must not label a tool.',
    flags: sentence => /\bproof tiers?\b|\bevidence tiers?\b|(?<![/\w-])product-reality(?![/\w-])/i.test(sentence),
  },
  {
    id: 'preview-in-client',
    why: 'An embedded preview claim needs a receipt for that named host; the SDK observation requires its explicit UI override.',
    flags: (sentence, evidence) => {
      if (HOST_QUALIFIERS.test(sentence)) return false;
      if (!/\b(inside|in) the (conversation|chat)\b|\brenders? (the )?(preview |MCP )?apps?\b/i.test(sentence)) return false;
      if (/MCP Apps SDK reference host/i.test(sentence)) return !evidence.sdkPreviewHost || !sentence.includes('OODS_MCP_APPS_UI=1');
      return [['Claude Desktop', 'claude-desktop'], ['Cursor', 'cursor']].some(([name, receipt]) => sentence.includes(name)
        && !evidence.observedPreviewHosts.some(file => file.toLowerCase().startsWith(receipt)));
    },
  },
  {
    id: 'own-definitions',
    why: "A team's own objects and traits load from its own folders as far as the packed-runtime proof shows (s213-m03): without that receipt no sentence may say they work, and with it a sentence saying they need a source checkout or are unsupported is stale.",
    flags: (sentence, evidence) => {
      const denies = DENIES_TEAM_DEFINITIONS.test(sentence);
      return evidence.ownDefinitions ? denies : TEAM_DEFINITIONS.test(sentence) && !denies;
    },
  },
  {
    id: 'brand-registry',
    why: "Brands come from the brands folder as far as the source-checkout proof shows (s213-m04): without that receipt no sentence may say so, and with it a sentence that limits the brands to A and B or says a new brand means editing Forge's source is stale. From the npm package a team's own brand is a later mission's claim.",
    flags: (sentence, evidence) => evidence.brandRegistry ? DENIES_BRAND_REGISTRY.test(sentence) : BRAND_REGISTRY.test(sentence),
  },
  {
    id: 'brand-intake',
    why: "brand.intake makes a brand from a team's values (template, validate, create) as far as the source-checkout proof shows (s213-m05): without that receipt no sentence may say it creates a brand, and with it a sentence calling it preview-only, delta-only or unable to create a brand, or the presets unshipped, is stale. From the npm package, create is m06's claim.",
    flags: (sentence, evidence) => {
      const denies = DENIES_BRAND_INTAKE.test(sentence);
      return evidence.brandIntake ? denies : BRAND_INTAKE.test(sentence) && !denies;
    },
  },
  {
    id: 'team-brands',
    why: "A team's own brands work from the npm package (kept and built in ~/.oods-foundry/brands, outside the runtime) as far as the packed-runtime proof shows (s213-m06): without that receipt no sentence may say so, and with it a sentence saying they are unsupported from npm or need a source checkout is stale.",
    flags: (sentence, evidence) => {
      const denies = DENIES_TEAM_BRANDS.test(sentence);
      return evidence.teamBrands ? denies : TEAM_BRANDS.test(sentence) && !denies;
    },
  },
  {
    id: 'governed-undefined',
    why: '"Governed" means the component-contracts predicate; a page that counts governed components must say what that means.',
    flags: () => false, // Whole-surface rule, applied in checkSurface.
  },
  {
    id: 'own-components',
    why: 'Substitution claims require the packed npm journeys on both Node versions; they never imply new-component support.',
    flags: (sentence, evidence) => {
      const denial = /not supported|unsupported|comes in a later release|needs? a source checkout|not yet|cannot|does not|no new.component/i.test(sentence);
      if (/new components?[^.;]*(beyond|outside|catalog)|add[^.;]*components?[^.;]*Forge (does not|doesn't) (have|ship)/i.test(sentence)) return !denial;
      const team = /(?:your|a team's|team's|their) (?:own )?components?\b|team.component substitution/i.test(sentence);
      return team && (evidence.ownComponents ? denial : !denial);
    },
  },
  {
    id: 'component-library',
    why: 'Named third-party component support requires a passing component-journey receipt; a fixture library proves only itself.',
    flags: (sentence, evidence) => {
      if (/\b(not supported|unsupported|not proven|not yet|no receipt|no claim)\b/i.test(sentence)) return false;
      const names = ['Material UI', 'Ant Design', 'Chakra UI'];
      return names.some(name => sentence.toLowerCase().includes(name.toLowerCase()) && !(evidence.componentLibraries ?? []).includes(name))
        && /\b(map|mapping|substitut(e|es|ion)|components?|supports?|generat(e|es|ion))\b/i.test(sentence);
    },
  },
  {
    id: 'component-contract-report',
    why: 'Team-component contract report claims require the real-browser m04 receipt, including changed-byte and non-conforming controls.',
    flags: (sentence, evidence) => !evidence.componentContractReports
      && /\b(team|mapped|substitut\w*)\b/i.test(sentence) && /\b(contract|shared.scenario)\b/i.test(sentence) && /\b(reports?|checks?|scenarios?)\b/i.test(sentence)
      && !/\b(not yet|not provided|not supported|follow separately|no report)\b/i.test(sentence),
  },
  {
    id: 'html-browser-measurement',
    why: 'HTML browser claims require every measured receipt and must preserve named semantic failures; measurement is not universal parity.',
    flags: (sentence, evidence) => /\bHTML\b/.test(sentence) && /\b(measured|browser.proven|parity|\d+ (?:cells|passes))\b/i.test(sentence)
      && !/\b(not yet|not measured|no .*parity|not universal|no universal|does not claim)\b/i.test(sentence)
      && (!evidence.htmlMeasurement || evidence.htmlMeasurement.fail > 0 && /\b(all|every|full|universal)\b[^.;]*\b(pass|parity|equivalent)\b/i.test(sentence)),
  },
  {
    id: 'packed-fidelity',
    why: 'Packed HTML/diagram/wireframe journey claims require matching npm receipts on both Node versions and unchanged readiness.',
    flags: (sentence, evidence) => /\b(packed|npm|package)\b/i.test(sentence) && /\b(HTML|diagram|wireframe)s?\b/i.test(sentence)
      && /\b(proven|verified|journey|works?|generates?|draws?)\b/i.test(sentence)
      && !/\b(not yet|pending|planned|not proven|not verified|historical)\b/i.test(sentence) && !evidence.packedFidelity,
  },
  {
    id: 'fidelity-drawings',
    why: 'Relationship diagrams and composed wireframes require source-bound Linux output and screenshot receipts; they do not prove live applications or referential integrity.',
    flags: (sentence, evidence) => /\b(draws?|renders?|generates?)\b/i.test(sentence)
      && /\b(relationship diagrams?|composed (?:screen |component |tree |page )?wireframes?|wireframes? of composed)\b/i.test(sentence)
      && !/\b(not yet|does not|cannot|historical|legacy|planned)\b/i.test(sentence)
      && (!evidence.fidelityViews || /\b(live referential integrity|live applications?|certified)\b/i.test(sentence)),
  },
  {
    id: 'known-overstatement',
    why: 'Sentences the capability accounting (2026-09-23) found false, kept out once corrected.',
    flags: sentence => [
      /runnable[- ]artifact gate|minimum gate for a runnable artifact/i,
      /Invoice\/Usage detail HTML/i,
      /\bcomplete document\b/i,
      /preview by default and write only with/i,
      /presets?\b[^.]*\bapplied to any brand/i,
      /compiled with the real toolchains/i,
      /resolves to trait terms/i,
      /certifies what it (produced|made)/i,
      /\ball \d+ tools\b/i,
      /installGuide/,
    ].some(pattern => pattern.test(sentence)),
  },
]);

/** Sentences of one surface: tags and entities dropped from HTML, one sentence per line elsewhere. */
export function sentences(file: string, text: string): string[] {
  const plain = file.endsWith('.html')
    ? text.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&rsquo;/g, "'")
    : text;
  return plain.split(/\n{1,}|(?<=[.!?])\s+(?=[A-Z`"*(])/).map(sentence => sentence.replace(/\s+/g, ' ').trim()).filter(sentence => sentence.length > 0);
}

export function checkSurface(surface: Surface, evidence: Evidence): Finding[] {
  const findings: Finding[] = [];
  for (const sentence of sentences(surface.file, surface.text)) {
    for (const rule of CAPABILITY_RULES) if (rule.flags(sentence, evidence)) findings.push({ file: surface.file, rule: rule.id, sentence });
  }
  // GOVERNED_DEFINITION (component-contracts) opens with "a versioned contract": the page must carry the definition, be
  // shown with a page that does (the npm description sits above the package README), or link the component index that
  // states it.
  const definedBy = surface.definedBy ?? surface.text;
  const linksIndex = /\]\((\.\.\/)*(components\/)?README\.md\)|\]\(\.\/README\.md\)/.test(surface.text) && (surface.file.startsWith('docs/components/') || /components\/README\.md/.test(surface.text));
  if (/\bgoverned components?\b/i.test(surface.text) && !definedBy.includes('versioned contract') && !linksIndex) {
    findings.push({ file: surface.file, rule: 'governed-undefined', sentence: 'uses "governed components" without the definition' });
  }
  return findings;
}

/** The SDK receipt proves one host with an override, not automatic negotiation or another client. */
export function hasSdkPreviewReceipt(root: string): boolean {
  try {
    const folder = path.join(root, 'artifacts/product-reality/sprint-218/m03/sdk-host');
    const read = (file: string) => JSON.parse(fs.readFileSync(path.join(folder, file), 'utf8'));
    const receipt = read('receipt.json');
    if (receipt.status !== 'pass' || receipt.builderSelfCertified !== false
      || receipt.upstream?.head !== '92f46a574568a3ddac7600343b7d3c4c4ed7b588' || !receipt.files) return false;
    for (const [file, hash] of Object.entries(receipt.files)) {
      if (path.isAbsolute(file) || file.split('/').includes('..')) return false;
      if (`sha256:${createHash('sha256').update(fs.readFileSync(path.join(folder, file))).digest('hex')}` !== hash) return false;
    }
    for (const file of ['upstream-host.json', 'upstream-host.patch', 'packed-identity.json', 'runtime-manifest.json']) {
      if (receipt.provenance?.[file] !== `sha256:${createHash('sha256').update(fs.readFileSync(path.join(folder, '..', file))).digest('hex')}`) return false;
    }
    for (const name of ['default', 'forced']) {
      if (!receipt.files[`${name}/receipt.json`]) return false;
      const phase = read(`${name}/receipt.json`), forced = name === 'forced';
      if (phase.status !== 'pass' || phase.builderSelfCertified !== false || phase.forced !== forced
        || phase.initialize?.params?.clientInfo?.name !== 'MCP Apps Host'
        || JSON.stringify(phase.initialize.params.capabilities) !== '{}'
        || Boolean(phase.previewToolMetadata?.ui?.resourceUri) !== forced || phase.pageErrors?.length !== 0) return false;
      const messages = Object.keys(receipt.files).filter(file => file.startsWith(`${name}/`) && /-(request|response)\.json$/.test(file)).map(read);
      if (!messages.some(message => message.method === 'initialize' && JSON.stringify(message) === JSON.stringify(phase.initialize))) return false;
      if (!messages.some(message => message.method === 'tools/call' && message.id === phase.previewCallId && message.params?.name === 'design_preview')) return false;
      const result = messages.find(message => message.id === phase.previewCallId && message.result);
      if (!result || result.error || result.result.isError || !result.result.content?.some((item: any) => item.type === 'text' && JSON.parse(item.text).status === 'ok')) return false;
      const shots = forced ? ['conversation-react', 'conversation-vue', 'conversation-message'] : ['text-fallback'];
      if (shots.some(shot => !receipt.files[`${name}/${shot}.png`])) return false;
      if (forced && (JSON.stringify(phase.frameworks) !== '["react","vue"]' || !phase.appMessages
        || !phase.negotiation.some((line: string) => line.includes('not advertised') && line.includes('OODS_MCP_APPS_UI=1'))
        || !phase.conversationText?.includes('Review the renewal summary wording'))) return false;
    }
    return true;
  } catch { return false; }
}

/** A pass label alone cannot allow a contract-report claim: both frameworks and both negative controls are bound. */
export function hasComponentContractReceipt(root: string): boolean {
  try {
    const folder = path.join(root, 'artifacts/product-reality/sprint-214/m04/browser');
    const receipt = JSON.parse(fs.readFileSync(path.join(folder, 'receipt.json'), 'utf8'));
    if (receipt.status !== 'pass') return false;
    for (const framework of ['react', 'vue']) {
      const cases = ['conforming', 'broken', 'changed-bytes'].map(kind => {
        const name = `${framework}-${kind}.json`, bytes = fs.readFileSync(path.join(folder, name));
        if (receipt.cases?.[name] !== `sha256:${createHash('sha256').update(bytes).digest('hex')}`) throw new Error('Report bytes differ');
        return JSON.parse(bytes.toString());
      });
      const [conforming, broken, changed] = cases;
      if (cases.some(result => result.status !== 'ok')) return false;
      if (conforming.componentContracts?.length !== 3 || conforming.componentContracts.some((report: any) => !report.browser || !report.source.packageContentHash || report.summary.met === 0 || report.summary.unmet !== 0)) return false;
      const original = conforming.componentContracts.find((report: any) => report.component === 'Button');
      for (const result of [broken, changed]) {
        const report = result.componentContracts?.find((report: any) => report.component === 'Button');
        if (!report?.browser || !report.obligations.some((row: any) => row.id === 'role' && row.status === 'unmet') || !result.warnings.some((row: any) => row.code === 'OODS-V218')) return false;
      }
      const mutated = changed.componentContracts.find((report: any) => report.component === 'Button');
      if (mutated.source.export !== original.source.export || mutated.source.packageContentHash === original.source.packageContentHash || mutated.adapterContentHash === original.adapterContentHash) return false;
    }
    return true;
  } catch { return false; }
}

/** Check the actual packed journey files, not just its pass label. Every generated artifact/report and shot is bound. */
export function hasOwnComponentsReceipt(root: string): boolean {
  try {
    const folder = path.join(root, 'artifacts/product-reality/sprint-214/m06');
    const receipt = JSON.parse(fs.readFileSync(path.join(folder, 'team-components/receipt.json'), 'utf8'));
    if (receipt.status !== 'pass' || receipt.builderSelfCertified !== false || receipt.journeys?.length !== 2 || !receipt.files || Object.keys(receipt.files).length < 20) return false;
    for (const [file, hash] of Object.entries(receipt.files)) {
      if (path.isAbsolute(file) || file.split('/').includes('..')) return false;
      if (`sha256:${createHash('sha256').update(fs.readFileSync(path.join(folder, file))).digest('hex')}` !== hash) return false;
    }
    const nodes = new Set<string>(); const tarballs = new Set<string>();
    for (const file of receipt.journeys) {
      if (!receipt.files[file]) return false;
      const journey = JSON.parse(fs.readFileSync(path.join(folder, file), 'utf8'));
      if (journey.status !== 'pass' || journey.builderSelfCertified !== false) return false;
      nodes.add(journey.node); tarballs.add(journey.tarball.sha256);
      for (const name of ['team-library-maps-outside-runtime-default-and-override', 'substituted-preview-preserves-packed-readiness', 'react-and-vue-generate-install-build-mount']) {
        if (!journey.steps.some((step: any) => step.name === name && step.status === 'pass')) return false;
      }
      const preview = journey.steps.find((step: any) => step.name === 'substituted-preview-preserves-packed-readiness').detail;
      if (preview.before.status !== 'verified' || preview.after.status !== 'verified' || preview.packageFilesUnchanged < 1) return false;
      const cells = journey.steps.find((step: any) => step.name === 'react-and-vue-generate-install-build-mount').detail.cells;
      for (const framework of ['react', 'vue']) {
        const cell = cells.find((cell: any) => cell.framework === framework);
        for (const theme of ['light', 'dark', 'hc']) {
          const row = cell?.themes.find((row: any) => row.theme === theme);
          if (!row || !['strict-typecheck', 'vite-build', 'mounted-1440'].every(gate => row.gates.includes(gate))) return false;
          const generationPath = path.posix.join(path.posix.dirname(file), row.generationFile);
          if (receipt.files[generationPath] !== row.generationSha256) return false;
          const generated = JSON.parse(fs.readFileSync(path.join(folder, generationPath), 'utf8'));
          if (generated.status !== 'ok' || generated.artifact.contentHash !== row.artifactHash || generated.artifact.substitutions.length < 2) return false;
          if (generated.componentContracts.length < 2 || generated.componentContracts.some((report: any) => !report.browser || !report.source.packageContentHash || report.summary.met === 0 || report.summary.unmet !== 0)) return false;
        }
      }
      const indexPath = path.posix.join(path.posix.dirname(file), 'screens/index.json');
      if (!receipt.files[indexPath]) return false;
      const screens = JSON.parse(fs.readFileSync(path.join(folder, indexPath), 'utf8'));
      if (screens.length < 10 || screens.some((screen: any) => receipt.files[path.posix.join(path.posix.dirname(file), 'screens', screen.file)] !== screen.sha256)) return false;
    }
    return [...nodes].some(node => /^v24\./.test(node)) && nodes.has('v20.11.1') && tarballs.size === 1;
  } catch { return false; }
}

function htmlMeasurement(root: string): Evidence['htmlMeasurement'] {
  try {
    const ledger = JSON.parse(fs.readFileSync(path.join(root, 'packages/mcp-server/registry/html-cells.v1.json'), 'utf8'));
    return verifyHtmlReceipts(root, ledger).length ? undefined : ledger.summary;
  } catch { return undefined; }
}

/** The evidence the rules read, from the ledgers and receipts in this checkout. */
export function collectEvidence(root: string): Evidence {
  const json = <T>(file: string): T => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8')) as T;
  const runtime = json<{ rows: Array<{ framework: string; status: string }> }>('packages/mcp-server/registry/runtime-cells.v1.json');
  const ledger = json<{ rows: Array<{ name: string; caveats: Array<{ reason: string }> }> }>('packages/mcp-server/registry/tool-capability-ledger.v1.json');
  const caveats = (tool: string) => ledger.rows.find(row => row.name === tool)?.caveats.map(caveat => caveat.reason) ?? [];
  const hosts = 'artifacts/product-reality/sprint-202/m05/hosts';
  const ownDefinitions = 'artifacts/product-reality/sprint-213/m03/own-objects/receipt.json';
  const brandRegistry = 'artifacts/product-reality/sprint-213/m04/brand-c/receipt.json';
  const brandIntake = 'artifacts/product-reality/sprint-213/m05/team-brand/receipt.json';
  const teamBrands = 'artifacts/product-reality/sprint-213/m06/npm-brand/receipt.json';
  const componentsPath = 'artifacts/product-reality/sprint-214/m06/team-components/receipt.json';
  const components = fs.existsSync(path.join(root, componentsPath)) ? json<{ status?: string; libraries?: string[] }>(componentsPath) : null;
  return {
    ownComponents: hasOwnComponentsReceipt(root),
    fidelityViews: verifyFidelityProof(root),
    packedFidelity: verifyPackedFidelity(root),
    htmlMeasurement: htmlMeasurement(root),
    componentContractReports: hasComponentContractReceipt(root),
    componentLibraries: components?.status === 'pass' ? components.libraries ?? [] : [],
    frameworks: [...new Set(runtime.rows.filter(row => row.status === 'pass').map(row => row.framework))].sort(),
    certifyChartsOnly: caveats('artifact.certify').some(reason => reason.startsWith('Certifies chart specifications only')),
    composeKeywordTables: caveats('design.compose').some(reason => reason.includes('matched against keyword tables')),
    sdkPreviewHost: hasSdkPreviewReceipt(root),
    observedPreviewHosts: fs.readdirSync(path.join(root, hosts)).filter(name => name !== 'README.md').sort(),
    ownDefinitions: fs.existsSync(path.join(root, ownDefinitions)) && json<{ status?: string }>(ownDefinitions).status === 'pass',
    brandRegistry: fs.existsSync(path.join(root, brandRegistry)) && json<{ status?: string }>(brandRegistry).status === 'pass',
    brandIntake: fs.existsSync(path.join(root, brandIntake)) && json<{ status?: string }>(brandIntake).status === 'pass',
    teamBrands: fs.existsSync(path.join(root, teamBrands)) && json<{ status?: string }>(teamBrands).status === 'pass',
  };
}

/**
 * Every surface Forge serves to people or agents, as text: every page a reader reaches within two links of the entry
 * pages (the link checker's reachable set), the package pages, and what the adapter and policies serve. History is not a
 * claim: docs/history, the changelogs (past releases in the past tense) and sprint receipts are left out.
 */
export function claimSurfaces(root: string): Surface[] {
  const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');
  const reached = [...(reachable(checkLinks({ root }).edges) as Map<string, number>).keys()]
    .filter(file => !file.startsWith('docs/history/') && !file.startsWith('artifacts/') && !/(^|\/)CHANGELOG\.md$/.test(file));
  const markdown = [...new Set([...reached, 'FEEDBACK.md', 'packages/foundry/README.md', 'packages/foundry/QUICKSTART.md', 'packages/foundry/quickstart/team-components/README.md',
    'plugins/oods-foundry/skills/oods-foundry/SKILL.md', 'packages/foundry/skills/oods-foundry/SKILL.md',
    'plugins/oods-foundry/skills/oods-foundry/references/QUICKSTART.md', 'packages/foundry/skills/oods-foundry/references/QUICKSTART.md',
    ...['tokens', 'component-contracts', 'component-styles', 'components-react', 'components-vue'].map(name => `packages/${name}/README.md`), 'packages/foundry/OBJECTS-AND-TRAITS.md', 'packages/foundry/BRANDS.md', 'packages/foundry/COMPONENTS.md', 'packages/mcp-server/README.md', 'packages/mcp-bridge/README.md',
    'docs/components/README.md', 'docs/mcp/Tool-Specs.md', 'docs/mcp/Connections.md', 'docs/mcp/Bridge-API.md',
    ...fs.readdirSync(path.join(root, 'docs/api')).filter(name => name.endsWith('.md')).sort().map(name => `docs/api/${name}`)])].sort();
  const surfaces: Surface[] = markdown.map(file => ({ file, text: read(file) }));
  for (const file of ['plugins/oods-foundry/.claude-plugin/plugin.json', 'packages/foundry/server.json']) {
    surfaces.push({ file: `${file}#description`, text: JSON.parse(read(file)).description });
  }
  const marketplace = JSON.parse(read('plugins/.claude-plugin/marketplace.json')) as { metadata: { description: string }; plugins: Array<{ name: string; description: string }> };
  surfaces.push({ file: 'plugins/.claude-plugin/marketplace.json#description', text: marketplace.metadata.description });
  for (const plugin of marketplace.plugins) surfaces.push({ file: `plugins/.claude-plugin/marketplace.json#${plugin.name}`, text: plugin.description });
  surfaces.push({ file: 'packages/foundry/TOOL-REFERENCE.md', text: read('packages/foundry/TOOL-REFERENCE.md') });
  const descriptions = JSON.parse(read('packages/mcp-adapter/tool-descriptions.json')) as Record<string, string>;
  for (const [tool, text] of Object.entries(descriptions)) surfaces.push({ file: `packages/mcp-adapter/tool-descriptions.json#${tool}`, text });
  const agent = JSON.parse(read('configs/agent/policy.json')) as { tools: Array<{ name: string; description?: string }> };
  for (const tool of agent.tools) if (tool.description) surfaces.push({ file: `configs/agent/policy.json#${tool.name}`, text: tool.description });
  const server = JSON.parse(read('packages/mcp-server/src/security/policy.json')) as { rules: Array<{ tool: string; description?: string }> };
  for (const rule of server.rules) if (rule.description) surfaces.push({ file: `packages/mcp-server/src/security/policy.json#${rule.tool}`, text: rule.description });
  for (const config of fs.readdirSync(path.join(root, 'configs/agents')).filter(name => name.endsWith('.json')).sort()) {
    const document = JSON.parse(read(`configs/agents/${config}`)) as { summary?: string; notes?: string[] };
    surfaces.push({ file: `configs/agents/${config}`, text: [document.summary ?? '', ...(document.notes ?? [])].join('\n') });
  }
  for (const schema of fs.readdirSync(path.join(root, 'packages/mcp-server/src/schemas')).filter(name => name.endsWith('.input.json')).sort()) {
    const texts: string[] = [];
    const visit = (node: unknown): void => {
      if (!node || typeof node !== 'object') return;
      for (const [key, value] of Object.entries(node)) {
        if ((key === 'description' || key === '$comment') && typeof value === 'string') texts.push(value);
        else visit(value);
      }
    };
    visit(JSON.parse(read(`packages/mcp-server/src/schemas/${schema}`)));
    surfaces.push({ file: `packages/mcp-server/src/schemas/${schema}`, text: texts.join('\n') });
  }
  for (const name of ['foundry', 'tokens', 'component-contracts', 'component-styles', 'components-react', 'components-vue']) {
    const manifest = JSON.parse(read(`packages/${name}/package.json`)) as { description?: string };
    if (manifest.description) surfaces.push({ file: `packages/${name}/package.json#description`, text: manifest.description, definedBy: read(`packages/${name}/README.md`) });
  }
  return surfaces;
}

export function checkCapabilityClaims(root: string, evidence = collectEvidence(root), surfaces = claimSurfaces(root)): Finding[] {
  return surfaces.flatMap(surface => checkSurface(surface, evidence));
}
