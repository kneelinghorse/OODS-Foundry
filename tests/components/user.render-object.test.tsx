import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Fragment, createElement } from 'react';
import type { ReactNode } from 'react';
import { RenderObject } from '../../src/components/RenderObject.js';
import { buildRenderContext } from '../../src/context/buildRenderContext.js';
import { composeExtensions } from '../../src/compositor/composeExtensions.js';
import { resolveTraitExtensions } from '../../src/traits/adapter.js';
import { REGION_ORDER } from '../../src/types/regions.js';
import type { ObjectSpec } from '../../src/types/render-context.js';
import activeUserData from '../../src/fixtures/user/active.json';
import { createUserObjectSpec } from '../../src/objects/user/object.js';
import type { UserRecord } from '../../src/objects/user/types.js';
import type { ContextKind } from '../../src/contexts/index.js';
import { collectContributionExtensions } from '../../src/engine/contributions/index.js';

const activeUser = activeUserData as UserRecord;

function renderRegionContent(content: ReactNode): string {
  if (content === undefined || content === null || content === false) {
    return '';
  }

  return renderToStaticMarkup(createElement(Fragment, null, content));
}

function renderContextMarkup(
  object: ObjectSpec<UserRecord>,
  data: UserRecord,
  view: ContextKind = 'detail'
): Record<string, string> {
  const context = buildRenderContext<UserRecord>({ object, data });
  const baseExtensions = resolveTraitExtensions(object, context);
  const contributionExtensions = collectContributionExtensions<UserRecord>({
    object,
    context: view,
    renderContext: context,
  });
  const regions = composeExtensions([...baseExtensions, ...contributionExtensions], context);

  return REGION_ORDER.reduce<Record<string, string>>((result, region) => {
    result[region] = renderRegionContent(regions[region]);
    return result;
  }, {});
}

describe('User view integration', () => {
  it('renders without throwing across core contexts', () => {
    const markup = renderToStaticMarkup(
      createElement(RenderObject, {
        object: createUserObjectSpec(),
        context: 'detail',
        data: activeUser,
      })
    );

    expect(markup).toContain('data-view-context="detail"');
  });

  it('only alters the pageHeader region when Taggable trait is removed', () => {
    const withTags = createUserObjectSpec({ includeTaggable: true });
    const withoutTags = createUserObjectSpec({ includeTaggable: false });

    const withMarkup = renderContextMarkup(withTags, activeUser);
    const withoutMarkup = renderContextMarkup(withoutTags, activeUser);

    REGION_ORDER.forEach((region) => {
      if (region === 'pageHeader') {
        expect(withMarkup[region]).not.toEqual(withoutMarkup[region]);
        expect(withMarkup[region]).toMatchSnapshot('pageHeader-with-tags');
        expect(withoutMarkup[region]).toMatchSnapshot('pageHeader-without-tags');
      } else {
        expect(withMarkup[region]).toEqual(withoutMarkup[region]);
      }
    });
  });
});
