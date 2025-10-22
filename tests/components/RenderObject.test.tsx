import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { RenderObject } from '../../src/components/RenderObject.js';
import { renderReport } from '../../src/components/renderReport.js';
import { buildRenderContext } from '../../src/context/buildRenderContext.js';
import { composeExtensions } from '../../src/compositor/composeExtensions.js';
import { resolveTraitExtensions } from '../../src/traits/adapter.js';
import type { ObjectSpec, TraitAdapter } from '../../src/types/render-context.js';
import { collectContributionExtensions } from '../../src/engine/contributions/index.js';

interface UserData {
  readonly id: string;
  readonly name: string;
  readonly status: 'active' | 'inactive';
}

type UserTrait = TraitAdapter<UserData>;

const identityTrait: UserTrait = {
  id: 'IdentityTrait',
  view: () => [
    {
      id: 'user-header',
      region: 'pageHeader',
      type: 'section',
      render: ({ data }) => <h1 data-user-id={data.id}>{data.name}</h1>,
    },
    {
      id: 'user-main',
      region: 'main',
      type: 'section',
      render: ({ data }) => (
        <section className="user-overview">
          <p>Status: {data.status}</p>
        </section>
      ),
    },
  ],
};

const timelineTrait: UserTrait = {
  id: 'TimelineTrait',
  view: () => [
    {
      id: 'user-timeline',
      region: 'contextPanel',
      type: 'section',
      render: () => (
        <aside className="user-timeline">
          <h2>Recent Activity</h2>
          <ul>
            <li>Signed in</li>
            <li>Updated profile</li>
          </ul>
        </aside>
      ),
    },
  ],
};

const statusBadgeTrait: UserTrait = {
  id: 'StatusBadgeTrait',
  view: (ctx) => {
    const isActive = ctx.data.status === 'active';
    const badgeClass = isActive ? 'badge--success' : 'badge--muted';
    return [
      {
        id: 'status-badge',
        region: 'viewToolbar',
        type: 'action',
        render: () => <span className={`status-badge ${badgeClass}`}>{ctx.data.status}</span>,
      },
    ];
  },
};

const baseObject: ObjectSpec<UserData> = {
  id: 'user',
  name: 'User',
  traits: [identityTrait, statusBadgeTrait],
};

const baseData: UserData = {
  id: 'user-123',
  name: 'Ada Lovelace',
  status: 'active',
};

function renderDetail(object: ObjectSpec<UserData>) {
  return renderToStaticMarkup(
    <RenderObject object={object} context="detail" data={baseData} />
  );
}

describe('<RenderObject>', () => {
  it('composes trait extensions so new traits update output without touching templates', () => {
    const baselineMarkup = renderDetail(baseObject);
    const withTimeline: ObjectSpec<UserData> = {
      ...baseObject,
      traits: [...(baseObject.traits ?? []), timelineTrait],
    };

    const timelineMarkup = renderDetail(withTimeline);

    expect(baselineMarkup).not.toEqual(timelineMarkup);
    expect(baselineMarkup).not.toContain('user-timeline');
    expect(timelineMarkup).toContain('user-timeline');
  });

  it('renders deterministically for identical object and data inputs', () => {
    const firstRender = renderDetail(baseObject);
    const secondRender = renderDetail(baseObject);

    expect(firstRender).toEqual(secondRender);
  });

  it('produces debug report mapping regions and trait contributions', () => {
    const object: ObjectSpec<UserData> = {
      ...baseObject,
      traits: [...(baseObject.traits ?? []), timelineTrait],
    };

    const context = buildRenderContext<UserData>({
      object,
      data: baseData,
    });

    const baseExtensions = resolveTraitExtensions(object, context);
    const contributionExtensions = collectContributionExtensions<UserData>({
      object,
      context: 'detail',
      renderContext: context,
    });
    const extensions = [...baseExtensions, ...contributionExtensions];
    const regions = composeExtensions<UserData>(extensions, context);
    const report = renderReport(object, 'detail', regions, extensions);

    const pageHeader = report.regions.find((entry) => entry.region === 'pageHeader');
    const contextPanel = report.regions.find((entry) => entry.region === 'contextPanel');

    expect(pageHeader?.extensionIds).toEqual(['user-header']);
    expect(contextPanel?.extensionIds).toEqual(['user-timeline']);

    const traitIds = report.traits.map((entry) => entry.id);
    expect(traitIds).toContain('IdentityTrait');
    expect(traitIds).toContain('StatusBadgeTrait');
    expect(traitIds).toContain('TimelineTrait');

    const badgeTrait = report.traits.find((entry) => entry.id === 'StatusBadgeTrait');
    expect(badgeTrait?.extensionIds).toEqual(['status-badge']);
  });
});
