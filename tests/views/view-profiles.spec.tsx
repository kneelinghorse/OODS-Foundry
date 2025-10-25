// @vitest-environment jsdom
import { render } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
  ViewContainer,
  buildViewContainerAttributes,
} from '../../src/engine/render/ViewContainer.js';
import type { RegionMap } from '../../src/types/regions.js';

const BASE_REGIONS: RegionMap = Object.freeze({
  globalNavigation: null,
  pageHeader: <header>Header</header>,
  breadcrumbs: [null, false],
  viewToolbar: ['Action'],
  main: [null, <section>Main content</section>],
  contextPanel: false,
});

describe('view profiles', () => {
  it('builds consistent container attributes for regions with sparse content', () => {
    const attrs = buildViewContainerAttributes('detail', BASE_REGIONS, '  detail-view  ');
    expect(attrs['data-view']).toBe('detail');
    expect(attrs['data-view-profile']).toBe('detail');
    expect(attrs['data-view-context']).toBe('detail');
    expect(attrs.className).toBe('detail-view');

    expect(attrs['data-view-has-globalnavigation']).toBe('false');
    expect(attrs['data-view-has-pageheader']).toBe('true');
    expect(attrs['data-view-has-breadcrumbs']).toBe('false');
    expect(attrs['data-view-has-viewtoolbar']).toBe('true');
    expect(attrs['data-view-has-main']).toBe('true');
    expect(attrs['data-view-has-contextpanel']).toBe('false');
  });

  it('memoizes container attributes until dependencies change', () => {
    const spy = vi.fn((attributes) => {
      return <div data-testid="view-container" {...attributes} />;
    });

    const { rerender } = render(
      <ViewContainer context="list" regions={BASE_REGIONS} className="list-view">
        {spy}
      </ViewContainer>
    );

    expect(spy).toHaveBeenCalledTimes(1);
    const firstCall = spy.mock.calls[0]?.[0];
    expect(firstCall).toBeDefined();

    rerender(
      <ViewContainer context="list" regions={BASE_REGIONS} className="list-view">
        {spy}
      </ViewContainer>
    );

    expect(spy).toHaveBeenCalledTimes(2);
    const secondCall = spy.mock.calls[1]?.[0];
    expect(secondCall).toBe(firstCall);

    rerender(
      <ViewContainer context="list" regions={{ ...BASE_REGIONS, viewToolbar: null }} className="list-view">
        {spy}
      </ViewContainer>
    );

    expect(spy).toHaveBeenCalledTimes(3);
    const thirdCall = spy.mock.calls[2]?.[0];
    expect(thirdCall).not.toBe(firstCall);
    expect(thirdCall?.['data-view-has-viewtoolbar']).toBe('false');
  });
});
