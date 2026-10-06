/**
 * Observation beside the design (Sprint 204 m05): the rows of a Stage1-against-Forge comparison that are
 * about the object on screen, stored on the version so they travel with its lineage, the way Sprint 203
 * stores context.
 *
 * The rows are computed by lib/observation.ts from a Stage1 run the caller names by filesystem path,
 * read through structuredData.fetch; Forge opens no other product's store to get them. The Forge side
 * of each row is the version's OWN schema for its context, not a fresh composition of the same object,
 * so the row is about the design the reader is looking at.
 *
 * Staleness follows the rule Sprint 203 arrived at: a row is marked when it was gathered for an earlier
 * version and carried forward by an edit — the design moved and the observation did not. It is NOT
 * "captured before this version was composed": a capture always precedes the preview that reads it, so
 * that rule would mark every row on every fresh version and the mark would carry no information.
 * Nothing is re-dated; every row keeps the capture time Stage1 gave it.
 *
 * The record is evidence for review. It carries no action, proposal or approval state, and there is no
 * queue: a person reads the difference and decides outside Forge.
 */
import { ToolError } from '../errors/tool-error.js';
import { listObjects } from '../objects/object-loader.js';
import { COMPOSED_CONTEXTS, computeObservation, type ForgeContext, type ObservationRecord, type ObservationRow } from './observation.js';

export interface StoredObservationRow extends ObservationRow {
  /** Gathered for an earlier version and carried here by an edit. */
  staleForVersion: boolean;
}

export interface StoredObservation {
  object: string;
  urn: string;
  /** The version's view context; `workflow` shows every screen of the object. */
  context: string;
  nature: ObservationRecord['nature'];
  judgement: string;
  requiresHumanAdjudication: boolean;
  run: ObservationRecord['stage1'];
  rules: Record<string, string>;
  /** What was looked for, so a panel with no rows says "nothing found" rather than leaving it to guess. */
  searched: { screens: string[]; observedRoutes: number; observedScreens: number; found: number };
  rows: StoredObservationRow[];
  attachedAt: string;
  attachedToVersion: number;
}

const ORDER: Record<ObservationRow['category'], number> = { disagreeing: 0, agreeing: 1, 'observed-only': 2, 'composed-only': 3 };

/**
 * Compare the version on screen against a Stage1 run and keep the rows about its object. Refusals are
 * lib/observation.ts's typed codes and are thrown before anything is stored.
 */
export async function observeForVersion(
  runPath: string,
  version: { object: string; urn: string; context: string; version: number; schema: unknown },
  now: string = new Date().toISOString(),
): Promise<StoredObservation> {
  if (!version.object || !listObjects().includes(version.object)) {
    throw new ToolError('OODS-V210', `design.preview: this composition shows ${JSON.stringify(version.object || null)}, which is not an object the registry holds, so there is nothing to compare an observation against. Nothing was written.`, { object: version.object || null });
  }
  const screens: ForgeContext[] = version.context === 'workflow'
    ? [...COMPOSED_CONTEXTS]
    : (COMPOSED_CONTEXTS as readonly string[]).includes(version.context) ? [version.context as ForgeContext] : [];
  const schemas = screens.length === 1 ? { [`${version.object}:${screens[0]}`]: version.schema } : undefined;
  const record = await computeObservation({ runPath, objects: [version.object], ...(schemas ? { schemas } : {}) });
  const rows = record.rows
    .filter(row => row.forge.object === version.object && screens.includes(row.forge.context as ForgeContext))
    .sort((a, b) => ORDER[a.category] - ORDER[b.category] || a.id.localeCompare(b.id))
    .map(row => ({ ...row, staleForVersion: false }));
  return {
    object: version.object,
    urn: version.urn,
    context: version.context,
    nature: record.nature,
    judgement: record.judgement,
    requiresHumanAdjudication: record.requiresHumanAdjudication,
    run: record.stage1,
    rules: record.rules,
    searched: { screens: screens.map(screen => `${version.object} ${screen}`), observedRoutes: record.scale.observedRoutes, observedScreens: record.scale.observedScreens, found: rows.length },
    rows,
    attachedAt: now,
    attachedToVersion: version.version,
  };
}

/** Carry a parent's observation onto the version an edit records: every row marked, nothing re-dated. */
export function carryObservationForward(observation: StoredObservation, version: number): StoredObservation {
  return { ...observation, attachedToVersion: version, rows: observation.rows.map(row => ({ ...row, staleForVersion: true })) };
}
