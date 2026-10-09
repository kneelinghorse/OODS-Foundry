import { listVersions, readAccepted, resolveCompositionsDir } from '../lib/composition-store.js';
import { requireAction } from './action-moves.js';

/** Version inspection does not start, probe or require a preview host. */
export async function handle(input: { action?: string; compositionId: string }) {
  requireAction({ action: input.action ?? 'versions' }, ['versions'], 'design_versions');
  const started = performance.now();
  const directory = resolveCompositionsDir();
  const versions = await listVersions(directory, input.compositionId);
  const acceptances = (await readAccepted(directory, input.compositionId))?.acceptances ?? [];
  const standing = acceptances.at(-1);
  return { status: 'ok', action: 'versions', compositionId: input.compositionId, latest: versions.at(-1)?.version ?? null,
    versions, accepted: standing ? { version: standing.version, acceptedAt: standing.acceptedAt, acceptances: acceptances.length } : null,
    durationMs: performance.now() - started };
}
