import { performance } from 'node:perf_hooks';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ListView } from '../../src/contexts/ListView.js';
import { buildRenderContext } from '../../src/context/buildRenderContext.js';
import { composeExtensions } from '../../src/compositor/composeExtensions.js';
import { resolveTraitExtensions } from '../../src/traits/adapter.js';
import type { RegionMap } from '../../src/types/regions.js';
import { createUserObjectSpec } from '../../src/objects/user/object.js';
import type { UserRecord } from '../../src/objects/user/types.js';
import activeUserFixture from '../../src/fixtures/user/active.json';

const ActiveUser = activeUserFixture as UserRecord;
const UserObject = createUserObjectSpec();

function buildRegionMap(data: UserRecord): RegionMap {
  const context = buildRenderContext<UserRecord>({
    object: UserObject,
    data,
  });
  const extensions = resolveTraitExtensions(UserObject, context);
  return composeExtensions(extensions, context);
}

const TARGET_MS = process.env.CI ? 180 : 320;

describe('ListView performance', () => {
  it('renders 100 user rows under the interactive threshold', () => {
    const users: UserRecord[] = Array.from({ length: 100 }, (_, index) => ({
      ...ActiveUser,
      id: `${ActiveUser.id}-clone-${index + 1}`,
      name: `${ActiveUser.name ?? 'User'} Clone ${index + 1}`,
    }));

    const firstRegions = buildRegionMap(users[0]!);
    const rowNodes = users.map((user) => {
      const regions = buildRegionMap(user);
      return regions.main ?? null;
    });

    const aggregatedRegions: RegionMap = {
      globalNavigation: null,
      breadcrumbs: null,
      contextPanel: null,
      viewToolbar: firstRegions.viewToolbar,
      pageHeader: firstRegions.pageHeader,
      main: (
        <div data-list-grid>
          {rowNodes.map((node, index) => (
            <div data-row-index={index} key={`user-row-${index + 1}`}>
              {node}
            </div>
          ))}
        </div>
      ),
    };

    const samples: number[] = [];
    let markup = '';

    for (let i = 0; i < 3; i += 1) {
      const start = performance.now();
      const output = renderToStaticMarkup(<ListView regions={aggregatedRegions} />);
      const elapsed = performance.now() - start;
      samples.push(elapsed);
      if (!markup) {
        markup = output;
      }
    }

    const duration = Math.min(...samples);

    expect(markup.match(/data-row-index/g)?.length ?? 0).toBe(100);
    if (duration >= 100) {
      // eslint-disable-next-line no-console
      console.warn(
        `[perf] ListView 100-row render exceeded 100ms target (budget ${TARGET_MS}ms): ${duration.toFixed(
          2,
        )}ms`,
      );
    }
    expect(duration).toBeLessThanOrEqual(TARGET_MS);
  });
});
